import React, { useState } from 'react';
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
            <div style={{ fontSize: '52px', marginBottom: '8px' }}>🎉</div>
            <h2 style={{ marginBottom: '8px' }}>Kurs aktivləşdi!</h2>
            <p className="auth-sub">Bir saniyə — hər şey açılır…</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>⏳</div>
            <h2 style={{ marginBottom: '8px' }}>Sınağınız bitdi</h2>
            <p className="auth-sub" style={{ marginBottom: '20px' }}>
              2 günlük pulsuz sınaq sona çatdı — bəyəndinizsə, davamı daha gözəldir.
              Kurs kodu ilə 28 mövzuluq canlı danışıq kursuna qoşulun. Profiliniz və
              bütün irəliləyişiniz olduğu kimi qalır.
            </p>

            {error && (
              <div className="error-box" style={{ textAlign: 'left' }}>
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

            <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
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
                {loading ? 'Yoxlanılır...' : 'Kursu aktivləşdir'}
              </button>
            </form>

            <a
              href={`${SUPPORT_WHATSAPP}?text=${encodeURIComponent('Salam! Sınağım bitdi, kursa qoşulmaq istəyirəm.')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                marginTop: '14px', padding: '12px', borderRadius: '14px',
                border: '1px solid #25D36655', color: '#25D366',
                textDecoration: 'none', fontSize: '14px', fontWeight: 700,
              }}
            >
              💬 Kodunuz yoxdur? Bizə yazın
            </a>

            <p style={{ fontSize: '12px', color: 'var(--text-secondary, #888)', marginTop: '16px' }}>
              Hesab əməliyyatları üçün Profil bölməsi açıq qalır.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
