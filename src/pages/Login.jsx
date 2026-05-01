import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch {
      setError('Email or password is incorrect.');
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email first.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError('');
    } catch {
      setError('Could not send reset email. Check your email address.');
    }
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
            ✅ Password reset email sent! Check your inbox.
          </div>
        )}

        <form onSubmit={handleLogin}>
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
            >
              Forgot password?
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