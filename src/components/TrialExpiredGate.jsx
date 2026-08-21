import React, { useState } from 'react';
import { Hourglass, GraduationCap } from 'lucide-react';
import { redeemCourseCode, SUPPORT_WHATSAPP } from '../utils/redeem';
import Logo from './Logo';

// Trial-ı bitmiş userin gördüyü tam-ekran görünüş (server getAgoraToken-da
// onsuz da bloklayır — bu, həmin vəziyyətin dostyana in-app əksidir).
// "Ölü divar" deyil: kod sahəsi elə buradadır, kodu olmayana WhatsApp CTA.
// Uğurlu redemption App.js-dəki canlı user sinxronu ilə mode-u 'course' edir
// və bu ekran özü yox olur — heç bir reload/yönləndirmə lazım deyil.
export default function TrialExpiredGate() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSupport, setShowSupport] = useState(false);
  const [activated, setActivated] = useState(false);

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
    // Canlı user sinxronu bu ekranı bir-iki saniyəyə söndürəcək.
    setActivated(true);
    setLoading(false);
  };

  return (
    <div className="auth-page" style={{ alignItems: 'center', justifyContent: 'center', padding: '40px 16px', minHeight: '80vh' }}>
      <div className="auth-card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        <div className="auth-logo" style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <Logo width={140} />
        </div>

        {activated ? (
          <>
            <div style={{ marginBottom: '8px', color: 'var(--accent)' }}><Hourglass size={44} strokeWidth={1.5} /></div>
            <h2 style={{ marginBottom: '8px' }}>Your application has been sent.</h2>
            <p className="auth-sub">One moment, opening the app. The course starts once an admin approves it.</p>
          </>
        ) : (
          <>
            <div style={{ marginBottom: '8px', color: 'var(--accent)' }}><GraduationCap size={42} strokeWidth={1.5} /></div>
            <h2 style={{ marginBottom: '8px' }}>Your trial has ended</h2>
            <p className="auth-sub" style={{ marginBottom: '20px' }}>
              Your free trial has ended. Join a cohort to continue: apply with a code, and once an admin approves it the 30-topic live speaking course begins. Your profile and progress stay exactly as they are.
            </p>

            {error && (
              <div className="error-box" style={{ textAlign: 'left' }}>
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

            <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
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

            <a
              href={`${SUPPORT_WHATSAPP}?text=${encodeURIComponent('Hi! My trial has ended and I would like to join the course.')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                marginTop: '14px', padding: '12px', borderRadius: '14px',
                border: '1px solid #25D36655', color: '#25D366',
                textDecoration: 'none', fontSize: '14px', fontWeight: 700,
              }}
            >
              💬 No code? Message us
            </a>

            <p style={{ fontSize: '12px', color: 'var(--text-secondary, var(--text-muted))', marginTop: '16px' }}>
              Your Profile section stays open for account settings.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
