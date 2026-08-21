import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { redeemCourseCode, SUPPORT_WHATSAPP } from '../utils/redeem';
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

    // Kurs artıq admin idarəsindədir: kod = kohorta MÜRACİƏT. Vəziyyəti
    // serverin cavabından çıxarırıq (active > accepted > applied/pending).
    const state = result.data.alreadyActive
      ? 'active'
      : (result.data.status === 'accepted' ? 'accepted' : 'applied');

    let cohort = null;
    try {
      const snap = await getDoc(doc(db, 'cohorts', result.data.cohortId));
      if (snap.exists()) cohort = snap.data();
    } catch {}

    setWelcome({
      state,
      cohortName: (cohort && (cohort.name || cohort.title)) || 'SpeakLab kursu',
    });
    setLoading(false);
  };

  if (welcome) {
    const info = {
      active: { emoji: '', title: 'Your course is active.', text: 'You can follow your topic progress on the home screen.', btn: 'Let us begin' },
      accepted: { emoji: '', title: 'You have been accepted.', text: 'Waiting for the course to start. Topics open as soon as an admin starts it.', btn: 'Home' },
      applied: { emoji: '', title: 'Your application has been sent.', text: 'The course starts once an admin approves it. You will see it here and get a notification.', btn: 'Home' },
    }[welcome.state] || {};
    return (
      <div className="auth-page" style={{ alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
        <div className="auth-card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '52px', marginBottom: '8px' }}>{info.emoji}</div>
          <h2 style={{ marginBottom: '8px' }}>{info.title}</h2>
          <p className="auth-sub" style={{ marginBottom: '20px' }}>{info.text}</p>

          <div style={{
            background: 'var(--accent-soft)',
            border: '1px solid var(--border)',
            borderRadius: '16px', padding: '18px', marginBottom: '20px', textAlign: 'left',
          }}>
            <div style={{ fontSize: '16px', fontWeight: 800 }}>
              🧪 {welcome.cohortName}
            </div>
          </div>

          <button type="button" className="btn-primary" onClick={() => navigate('/')}>
            {info.btn}
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

        <h2 style={{ textAlign: 'center', marginBottom: '8px' }}>Kodunuz var?</h2>
        <p className="auth-sub" style={{ textAlign: 'center', marginBottom: '20px' }}>
          Enter your code to apply. Once an admin approves it, the 30-topic speaking course begins.
        </p>

        {error && (
          <div className="error-box">
            {error}
            {showSupport && (
              <a
                href={`${SUPPORT_WHATSAPP}?text=${encodeURIComponent('Hi! I am writing about my course code.')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block', marginTop: '8px', color: '#25D366', fontWeight: 700 }}
              >
                💬 Message us on WhatsApp
              </a>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label>Kurs kodu</label>
          <input
            type="text"
            placeholder="E.G. SPEAK-A2-01"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={40}
            required
          />
          <button type="submit" className="btn-primary" disabled={loading || code.trim().length < 4}>
            {loading ? 'Sending...' : 'Apply'}
          </button>
        </form>

        <p className="auth-footer" style={{ marginTop: '16px' }}>
          Kodunuz yoxdur?{' '}
          <a
            href={`${SUPPORT_WHATSAPP}?text=${encodeURIComponent('Hi! I would like to join the SpeakLab course.')}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Message us
          </a>
        </p>

        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            width: '100%', background: 'none', border: 'none',
            color: 'var(--text-secondary, var(--text-muted))', fontSize: '14px',
            marginTop: '12px', cursor: 'pointer',
          }}
        >
          ← Geri
        </button>
      </div>
    </div>
  );
}
