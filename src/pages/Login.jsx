import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';

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

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">🎙️ Speak2Them</div>
        <h2>Welcome back</h2>
        <p className="auth-sub">Practice English with real people around the world</p>

        {error && <div className="error-box">{error}</div>}
        {resetSent && (
          <div className="success-box">
            If an account exists for <strong>{normalizedEmail}</strong>, a reset link was sent.
            Check inbox and spam. Sender is usually <strong>noreply@speak2them-64f2b.firebaseapp.com</strong>.
          </div>
        )}

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