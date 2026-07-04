import React, { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Capacitor } from '@capacitor/core';
import { tgUser, isTelegramWebApp } from '../telegram';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';

export default function Register() {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio]           = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);

      await updateProfile(user, { displayName: name });

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name,
        email,
        bio,
        telegramId: tgUser?.id ? String(tgUser.id) : '',
        online: true,
        rating: 0,
        ratingCount: 0,
        surveyDone: false,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
      });

      navigate('/survey');
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  const handleGoogleRegister = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          name: user.displayName || 'User',
          email: user.email || '',
          photo: user.photoURL || '',
          bio: '',
          telegramId: tgUser?.id ? String(tgUser.id) : '',
          online: true,
          rating: 0,
          ratingCount: 0,
          surveyDone: false,
          createdAt: serverTimestamp(),
          lastSeen: serverTimestamp(),
        });
      }
      navigate('/survey');
    } catch (err) {
      console.error('[GoogleRegister]', err);
      setError('Google auth error: ' + (err.message || 'Unknown error'));
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ padding: '40px 32px', position: 'relative', overflow: 'hidden' }}>
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
          <div className="auth-logo" style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
            <Logo width={160} />
          </div>
          <h2 style={{ fontSize: '32px', marginBottom: '8px', lineHeight: '1.2' }}>Start Speaking <br/><span style={{ color: '#7c6ff7' }}>Today</span></h2>
          <p className="auth-sub" style={{ fontSize: '15px', marginBottom: '32px' }}>Join the fastest growing English community.</p>

          {error && <div className="error-box">{error}</div>}

          {!isTelegramWebApp && !Capacitor.isNativePlatform() && (
          <button 
            onClick={handleGoogleRegister} 
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: '#ffffff',
              color: '#1e1e30',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              marginBottom: '20px'
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

        <div style={{ textAlign: 'center', marginBottom: '20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
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

          <label>Short Bio <span className="optional">(optional)</span></label>
          <textarea
            placeholder="Tell others about yourself..."
            value={bio}
            onChange={e => setBio(e.target.value)}
            rows={3}
          />

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating account...' : 'Get Started'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
        </div>
      </div>
    </div>
  );
}