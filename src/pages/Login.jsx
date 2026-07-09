import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, signInWithGoogle } from '../firebase';
import { Capacitor } from '@capacitor/core';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';

function getResetPasswordErrorMessage(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/missing-email':
      return 'Please enter your email first.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes, then try again.';
    case 'auth/user-not-found':
      return 'No account found with this email. Register first or double-check the spelling.';
    case 'auth/invalid-continue-uri':
    case 'auth/unauthorized-continue-uri':
      return 'Reset link is misconfigured. Contact support.';
    case 'auth/operation-not-allowed':
      return 'Email/password reset is disabled in Firebase. Enable Email/Password in the console.';
    default:
      return 'Could not send reset email. Try again in a few minutes.';
  }
}

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();

  const normalizedEmail = email.trim().toLowerCase();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setResetSent(false);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
      navigate('/');
    } catch {
      setError('Email or password is incorrect.');
    }
    setLoading(false);
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setResetSent(false);
    setError('');
  };

  const handleForgotPassword = async () => {
    if (!normalizedEmail) {
      setError('Please enter your email first.');
      return;
    }

    setError('');
    setResetSent(false);
    setResetLoading(true);

    try {
      await sendPasswordResetEmail(auth, normalizedEmail, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      });
      setResetSent(true);
    } catch (err) {
      console.error('[Login] Password reset failed:', err?.code, err?.message);
      setError(getResetPasswordErrorMessage(err?.code));
    }

    setResetLoading(false);
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await signInWithGoogle();
      if (!res) return; // redirect fallback — the page is navigating away
      const user = res.user;

      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          name: user.displayName || 'User',
          email: user.email || '',
          photo: user.photoURL || '',
          online: true,
          lastSeen: serverTimestamp()
        }, { merge: true });
      }
      navigate('/');
    } catch (err) {
      console.error('[GoogleLogin]', err);
      setError('Google auth error: ' + (err.message || 'Unknown error'));
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo" style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <Logo width={180} />
        </div>
        <h2>Welcome back</h2>
        <p className="auth-sub">Practice English with real people around the world</p>

        {error && <div className="error-box">{error}</div>}
        {resetSent && (
          <div className="success-box">
            If an account exists for <strong>{normalizedEmail}</strong>, a reset link was sent.
            Check inbox and spam. Sender is usually <strong>noreply@speak2them-64f2b.firebaseapp.com</strong>.
          </div>
        )}

        {!Capacitor.isNativePlatform() && (
          <button 
            onClick={handleGoogleLogin} 
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
            Sign in with Google
          </button>
        )}

        <div style={{ textAlign: 'center', marginBottom: '20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          or continue with email
        </div>

        <form onSubmit={handleLogin}>
          <label>Email</label>
          <input
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={handleEmailChange}
            required
          />
          <label>Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <div style={{ textAlign: 'right', marginTop: '8px' }}>
            <button
              type="button"
              className="btn-forgot"
              onClick={handleForgotPassword}
              disabled={resetLoading || loading}
            >
              {resetLoading ? 'Sending...' : 'Forgot password?'}
            </button>
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="auth-footer">
          No account? <Link to="/register">Register for free</Link>
        </p>
      </div>
    </div>
  );
}