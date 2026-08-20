import React, { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, signInWithGoogle } from '../firebase';
import { Capacitor } from '@capacitor/core';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { getPendingJoinCode } from '../utils/teacher';

export default function Register() {
  // Müəllimin dəvət linki ilə gəlmişiksə rol SEÇİLMİR — dəvət olunan adam
  // tərifinə görə şagirddir. Əvvəl rol seçicisi burada da görünürdü və həmin
  // adam "I am a Teacher" seçəndə App.js gözləyən kodu SİLİRDİ (müəllim heç
  // vaxt şagird kimi qoşulmur qaydası), yəni müəllimin linki səssizcə ölürdü.
  // Müəllimin şikayəti ("link atıram, adam kabinetimə düşmür") məhz bu idi.
  const invitedByTeacher = !!getPendingJoinCode();
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  // B2B2C onboarding: rol qeydiyyatdan ƏVVƏL açıq seçilir. null = hələ
  // seçilməyib; seçilməyincə qeydiyyat düymələri bağlıdır. Rules bu sahənin
  // yalnız BİR DƏFƏ (yaradılışda/ilk yazıda) qoyulmasına icazə verir.
  const [role, setRole]         = useState(invitedByTeacher ? 'student' : null);
  const navigate = useNavigate();

  // Müəllim seçən üçün əlavə sahələr: teacherEligible dərhal true (3-sessiya
  // qapısı bu axında yoxdur), surveyDone true (şagird sorğusu müəllimə aid
  // deyil — əks halda Lobby onu sorğuya yönləndirərdi).
  const roleFields = role === 'teacher'
    ? { role: 'teacher', teacherEligible: true, surveyDone: true }
    : { role: 'student' };

  // Qeydiyyat bitəndə auth-state yarışı /register route-unun köhnə
  // <Navigate to="/" /> effektini bizim navigate-dən SONRA işlədə bilir və
  // müəllim Lobby-yə düşürdü. Rol bu açarla saxlanılır ki, route-un redirect
  // hədəfi də eyni yerə baxsın (App.js-də oxunur).
  const rememberPostRegRoute = () => {
    try { sessionStorage.setItem('slk_postreg_role', role); } catch { /* private mode */ }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    rememberPostRegRoute();

    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);

      await updateProfile(user, { displayName: name });

      // YARIŞ: App.js-in auth bootstrap-ı sənədi bizdən qabaq yarada bilər.
      // Onda bu tam setDoc UPDATE sayılır və mode/trialStartedAt update-guard-a
      // dəyib bütünlüklə rədd olunur — rol da itərdi. Fallback: yalnız icazəli
      // sahələri merge et (rol birdəfəlik qayda ilə keçir, trial sahələrini
      // onsuz da initTrialForNewUser trigger-i server tərəfdən doldurur).
      const userRef = doc(db, 'users', user.uid);
      try {
        await setDoc(userRef, {
          uid: user.uid,
          name,
          email,
          rating: 0,
          ratingCount: 0,
          surveyDone: false,
          // Kodsuz giriş = trial. Kurs kodu ilə redeemCode bunu 'course'-a keçirir.
          // trialStartedAt server-side 2 günlük yoxlamanın başlanğıc nöqtəsidir.
          mode: 'trial',
          trialStartedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          lastSeen: serverTimestamp(),
          ...roleFields,
        });
      } catch {
        await setDoc(userRef, { name, ...roleFields }, { merge: true });
      }

      navigate(role === 'teacher' ? '/teacher' : (invitedByTeacher ? '/join' : '/survey'));
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  const handleGoogleRegister = async () => {
    setError('');
    setLoading(true);
    rememberPostRegRoute();
    try {
      const result = await signInWithGoogle();
      if (!result) return; // redirect fallback — the page is navigating away
      const user = result.user;

      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        try {
          await setDoc(userRef, {
            uid: user.uid,
            name: user.displayName || 'User',
            email: user.email || '',
            photo: user.photoURL || '',
            bio: '',
            online: true,
            rating: 0,
            ratingCount: 0,
            surveyDone: false,
            // Kodsuz giriş = trial (redeemCode 'course'-a keçirir).
            mode: 'trial',
            trialStartedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            lastSeen: serverTimestamp(),
            ...roleFields,
          });
        } catch {
          // getDoc-dan sonra bootstrap sənədi yaratdısa (dar yarış pəncərəsi),
          // tam yazı update kimi rədd olunur — icazəli sahələri merge et.
          await setDoc(userRef, roleFields, { merge: true });
        }
      } else if (!snap.data().role) {
        // App.js-in auth bootstrap-ı sənədi bizdən qabaq yarada bilər (yarış).
        // Rules rolun yalnız İLK yazılışına icazə verir, ona görə yalnız rol
        // hələ yoxdursa merge edirik — mövcud user rolunu dəyişə bilməz.
        await setDoc(userRef, roleFields, { merge: true });
      }
      navigate(role === 'teacher' ? '/teacher' : (invitedByTeacher ? '/join' : '/survey'));
    } catch (err) {
      console.error('[GoogleRegister]', err);
      setError('Google auth error: ' + (err.message || 'Unknown error'));
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      {/* .auth-card default padding-i 40px-dir — rol seçimi ilə birlikdə bu,
          formanı ekrandan kənara çıxarırdı. Yalnız bu səhifədə sıxılır. */}
      <div className="auth-card" style={{ position: 'relative', overflow: 'hidden', padding: '16px 18px' }}>
        <div style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '150px',
          height: '150px',
          background: 'radial-gradient(circle, #7c6ff744 0%, transparent 70%)',
          borderRadius: '50%',
          zIndex: 0
        }}></div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="auth-logo" style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '6px' }}>
            <Logo width={116} />
          </div>
          {/* Rol seçimi əlavə olunandan sonra forma bir ekrana sığmırdı:
              başlıq tək sətirə salındı, alt yazı çıxarıldı, boşluqlar
              sıxıldı — scroll olmadan hamısı görünür. */}
          {/* The interface is English throughout; see feedbackLanguage.js for the
              one thing that is not. */}
          <h2 style={{ fontSize: '20px', marginBottom: '10px', lineHeight: '1.2' }}>
            Start <span style={{ color: 'var(--accent)' }}>speaking</span>
          </h2>

          {error && <div className="error-box">{error}</div>}

          {/* Müəllim dəvəti ilə gələn üçün rol seçimi göstərilmir — o, şagirddir. */}
          {invitedByTeacher && (
            <div style={{
              background: 'linear-gradient(135deg, #7c6ff722, #5b4de822)',
              border: '1px solid #7c6ff755', borderRadius: '12px',
              padding: '12px 14px', marginBottom: '12px',
              fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5,
            }}>
              🎓 You are joining through a teacher invitation — you will be connected right after you sign up.
            </div>
          )}

          {/* Rol seçimi — qeydiyyatın şərti. Sonradan dəyişilə bilmir
              (rules yalnız ilk yazılışa icazə verir), ona görə açıq seçimdir. */}
          {!invitedByTeacher && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {[
              { key: 'student', icon: '🎓', label: 'I am a Student', sub: 'Practice speaking' },
              { key: 'teacher', icon: '👩‍🏫', label: 'I am a Teacher', sub: 'Track my students' },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRole(opt.key)}
                style={{
                  flex: 1, padding: '10px 6px', borderRadius: '12px', cursor: 'pointer',
                  border: role === opt.key ? '2px solid #7c6ff7' : '1px solid var(--border)',
                  background: role === opt.key
                    ? 'linear-gradient(135deg, #7c6ff722, #5b4de822)'
                    : 'var(--bg-card)',
                  color: 'var(--text-primary)', textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '20px', marginBottom: '2px' }}>{opt.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>{opt.label}</div>
              </button>
            ))}
          </div>
          )}
          {!role && (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', margin: '0 0 10px' }}>
              Choose your role to continue
            </p>
          )}

          {!Capacitor.isNativePlatform() && (
          <button
            onClick={handleGoogleRegister}
            disabled={loading || !role}
            style={{
              width: '100%',
              backgroundColor: '#ffffff',
              color: '#1e1e30',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '10px',
              borderRadius: '12px',
              border: 'none',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              marginBottom: '10px'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Sign up with Google
          </button>
        )}

        <div style={{ textAlign: 'center', marginBottom: '10px', color: 'var(--text-secondary)', fontSize: '12px' }}>
          or register with email
        </div>

        <form onSubmit={handleRegister}>
          <label>Full Name</label>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />

          <label>Email</label>
          <input
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            minLength={6}
            required
          />

          <button type="submit" className="btn-primary" disabled={loading || !role}>
            {loading ? 'Creating account...' : 'Get Started'}
          </button>
        </form>

        <p className="auth-footer" style={{ marginTop: '10px', fontSize: '13px' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
        </div>
      </div>
    </div>
  );
}