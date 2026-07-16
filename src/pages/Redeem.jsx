import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { redeemCourseCode, SUPPORT_WHATSAPP } from '../utils/redeem';
import { DEFAULT_SESSION_CONFIG, getNextSessionDay } from '../utils/sessionSchedule';
import { formatAzDate } from '../utils/courseProgress';
import Logo from '../components/Logo';

export default function Redeem({ user }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSupport, setShowSupport] = useState(false);
  // Uğurlu redemption-dan sonra xoş-gəldin məlumatı; null = hələ form ekranı.
  const [welcome, setWelcome] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setError('');
    setShowSupport(false);
    setLoading(true);

    const result = await redeemCourseCode(trimmed);

    if (!result.ok) {
      setError(result.errorText);
      setShowSupport(!!result.showSupport);
      setLoading(false);
      return;
    }

    // Kohort kartı + ilk sessiya tarixi. Bunlar bəzək məlumatıdır — oxunma
    // alınmasa da aktivləşmə uğurludur, ekran sadəcə daha az detal göstərir.
    let cohort = null;
    let nextSession = null;
    try {
      const snap = await getDoc(doc(db, 'cohorts', result.data.cohortId));
      if (snap.exists()) cohort = snap.data();
    } catch {}
    try {
      const cfgSnap = await getDoc(doc(db, 'appConfig', 'session'));
      const cfg = cfgSnap.exists()
        ? { ...DEFAULT_SESSION_CONFIG, ...cfgSnap.data() }
        : DEFAULT_SESSION_CONFIG;
      nextSession = getNextSessionDay(cfg);
    } catch {}

    setWelcome({
      alreadyActive: !!result.data.alreadyActive,
      cohortName: (cohort && (cohort.name || cohort.title)) || 'SpeakLab kursu',
      memberCount: cohort ? Number(cohort.memberCount) || 0 : 0,
      nextSession,
    });
    setLoading(false);
  };

  if (welcome) {
    return (
      <div className="auth-page" style={{ alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
        <div className="auth-card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '52px', marginBottom: '8px' }}>🎉</div>
          <h2 style={{ marginBottom: '8px' }}>
            {welcome.alreadyActive ? 'Kursunuz artıq aktivdir!' : 'Xoş gəldiniz!'}
          </h2>
          <p className="auth-sub" style={{ marginBottom: '20px' }}>
            28 mövzuluq danışıq kursuna qoşuldunuz.
          </p>

          <div style={{
            background: 'linear-gradient(135deg, #7c6ff722, #5b4de822)',
            border: '1px solid #7c6ff755',
            borderRadius: '16px', padding: '18px', marginBottom: '20px', textAlign: 'left',
          }}>
            <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>
              🧪 {welcome.cohortName}
            </div>
            {welcome.memberCount > 0 && (
              <div style={{ fontSize: '14px', color: 'var(--text-secondary, #aaa)', marginBottom: '6px' }}>
                👥 {welcome.memberCount} iştirakçı
              </div>
            )}
            {welcome.nextSession && (
              <div style={{ fontSize: '14px', color: 'var(--text-secondary, #aaa)' }}>
                📅 İlk sessiya: {formatAzDate(welcome.nextSession.dateStr)},{' '}
                {String(welcome.nextSession.time.hour).padStart(2, '0')}:
                {String(welcome.nextSession.time.minute).padStart(2, '0')}
              </div>
            )}
          </div>

          <button type="button" className="btn-primary" onClick={() => navigate('/')}>
            Başlayaq 🚀
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page" style={{ alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div className="auth-card" style={{ maxWidth: '400px', width: '100%' }}>
        <div className="auth-logo" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <Logo width={160} />
        </div>

        <h2 style={{ textAlign: 'center', marginBottom: '8px' }}>Kodunuz var? 🎟️</h2>
        <p className="auth-sub" style={{ textAlign: 'center', marginBottom: '20px' }}>
          Kurs kodunuzu daxil edin — 28 mövzuluq danışıq kursu və tam giriş aktivləşsin.
        </p>

        {error && (
          <div className="error-box">
            {error}
            {showSupport && (
              <a
                href={`${SUPPORT_WHATSAPP}?text=${encodeURIComponent('Salam! Kurs koduma görə yazıram.')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block', marginTop: '8px', color: '#25D366', fontWeight: 700 }}
              >
                💬 WhatsApp-da bizə yazın
              </a>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label>Kurs kodu</label>
          <input
            type="text"
            placeholder="MƏS: SPEAK-A2-01"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={40}
            required
          />
          <button type="submit" className="btn-primary" disabled={loading || code.trim().length < 4}>
            {loading ? 'Yoxlanılır...' : 'Aktivləşdir'}
          </button>
        </form>

        <p className="auth-footer" style={{ marginTop: '16px' }}>
          Kodunuz yoxdur?{' '}
          <a
            href={`${SUPPORT_WHATSAPP}?text=${encodeURIComponent('Salam! SpeakLab kursuna qoşulmaq istəyirəm.')}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Bizə yazın
          </a>
        </p>

        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            width: '100%', background: 'none', border: 'none',
            color: 'var(--text-secondary, #888)', fontSize: '14px',
            marginTop: '12px', cursor: 'pointer',
          }}
        >
          ← Geri
        </button>
      </div>
    </div>
  );
}
