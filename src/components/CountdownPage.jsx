import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { LAUNCH_DATE } from '../constants';

export default function CountdownPage() {
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const distance = Math.max(0, LAUNCH_DATE - now);

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setCountdown({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email');
      return;
    }

    try {
      await addDoc(collection(db, 'waitlist'), {
        email: email.toLowerCase(),
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
      setEmail('');
      setTimeout(() => setSubmitted(false), 4000);
    } catch (err) {
      setError('Something went wrong. Try again.');
    }
  };

  const pad = (num) => String(num).padStart(2, '0');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0f1a 0%, #1e1e30 50%, #2d1b4e 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 20% 50%, rgba(124, 111, 247, 0.1) 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        textAlign: 'center',
        zIndex: 1,
        maxWidth: '500px',
        animation: 'fadeIn 0.8s ease-out',
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '20px',
          animation: 'float 3s ease-in-out infinite',
        }}>
          🚀
        </div>

        <h1 style={{
          fontSize: '32px',
          fontWeight: 700,
          color: '#fff',
          marginBottom: '8px',
          fontFamily: 'Inter, sans-serif',
          letterSpacing: '-1px',
        }}>
          Launch in
        </h1>

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          marginBottom: '32px',
          marginTop: '24px',
        }}>
          {[
            { value: countdown.days, label: 'Days' },
            { value: countdown.hours, label: 'Hours' },
            { value: countdown.minutes, label: 'Minutes' },
            { value: countdown.seconds, label: 'Seconds' },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '16px 12px',
              background: 'rgba(124, 111, 247, 0.1)',
              border: '1px solid rgba(124, 111, 247, 0.3)',
              borderRadius: '12px',
              minWidth: '90px',
              animation: 'pulse 2s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`,
            }}>
              <div style={{
                fontSize: '28px',
                fontWeight: 700,
                color: '#7c6ff7',
                fontFamily: 'Inter, monospace',
                letterSpacing: '2px',
              }}>
                {pad(item.value)}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#aaa',
                marginTop: '4px',
                fontWeight: 600,
              }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>

        <p style={{
          fontSize: '16px',
          color: '#bbb',
          marginBottom: '12px',
          fontFamily: 'Inter, sans-serif',
        }}>
          Speak2Them opens July 5, 2026
        </p>

        <p style={{
          fontSize: '13px',
          color: '#7c6ff7',
          marginBottom: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
        }}>
          🔥 Early users get advantage
        </p>

        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          marginBottom: '20px',
        }}>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: '14px 16px',
              background: 'rgba(124, 111, 247, 0.1)',
              border: '1px solid rgba(124, 111, 247, 0.3)',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif',
              outline: 'none',
              transition: 'all 0.3s',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#7c6ff7';
              e.target.style.background = 'rgba(124, 111, 247, 0.15)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(124, 111, 247, 0.3)';
              e.target.style.background = 'rgba(124, 111, 247, 0.1)';
            }}
          />

          <button
            type="submit"
            disabled={!email}
            style={{
              padding: '14px 24px',
              background: email
                ? 'linear-gradient(135deg, #7c6ff7, #5b4de8)'
                : 'linear-gradient(135deg, #2e2e50, #1e1e30)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: 700,
              cursor: email ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s',
              fontFamily: 'Inter, sans-serif',
            }}
            onMouseEnter={(e) => {
              if (email) e.target.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
            }}
          >
            {submitted ? '✅ Added to waitlist!' : 'Get Notified'}
          </button>

          {error && (
            <p style={{
              color: '#ef4444',
              fontSize: '13px',
              marginTop: '4px',
            }}>
              {error}
            </p>
          )}
        </form>

        <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#7c6ff7', fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>

        <p style={{
          fontSize: '12px',
          color: '#666',
          marginTop: '16px',
        }}>
          We'll notify you when we launch
        </p>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124, 111, 247, 0.1); }
          50% { box-shadow: 0 0 0 8px rgba(124, 111, 247, 0); }
        }
      `}</style>
    </div>
  );
}
