import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from '../components/Logo';
import {
  claimTeacherCode,
  readCodeFromLocation,
  getPendingJoinCode,
  clearPendingJoinCode,
} from '../utils/teacher';

// Şagirdin müəllimə qoşulma ekranı. Link (/join?c=KOD) və ya əl ilə kod.
// Yalnız razılıq toplanır (müəllim analizləri görəcək); server onu yenidən
// yoxlayır. Doğum tarixi sahəsi çıxarılıb — bax aşağıdakı şərh.
export default function JoinTeacher({ user }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [code, setCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Linkdən gələn kodu doldur. Native-də HashRouter olduğu üçün həm search,
  // həm hash yoxlanılır; Telegram-ın ?start=c_KOD forması da qəbul edilir.
  useEffect(() => {
    const fromUrl = readCodeFromLocation(
      location.search || window.location.search,
      window.location.hash,
    );
    // Qeydiyyatdan əvvəl link açılıbsa, kod localStorage-dən gəlir.
    const resolved = fromUrl || getPendingJoinCode();
    if (resolved) setCode(resolved);
  }, [location.search]);

  // Doğum tarixi sahəsi çıxarıldı — yeganə şərt kod + razılıqdır.
  const canSubmit = code.trim().length >= 4 && consent && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    const result = await claimTeacherCode({
      code: code.trim().toUpperCase(),
      consent,
    });
    if (!result.ok) {
      setError(result.errorText);
      setLoading(false);
      return;
    }
    clearPendingJoinCode();
    setDone(true);
    setLoading(false);
  };

  // "İndi yox" da kodu təmizləməlidir, əks halda hər açılışda bu ekrana
  // qayıtma dövrü yaranar.
  const dismiss = () => {
    clearPendingJoinCode();
    navigate('/');
  };

  // Artıq bağlıdırsa formanı ümumiyyətlə göstərmə.
  if (user?.teacherId && !done) {
    return (
      <div className="auth-page" style={{ alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
        <div className="auth-card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '52px', marginBottom: '8px' }}>🎓</div>
          <h2 style={{ marginBottom: '8px' }}>You have a teacher</h2>
          <p className="auth-sub" style={{ marginBottom: '20px' }}>
            You are already connected to a teacher. Contact them to change this.
          </p>
          <button type="button" className="btn-primary" onClick={dismiss}>
            Home
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="auth-page" style={{ alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
        <div className="auth-card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '52px', marginBottom: '8px' }}>🎉</div>
          <h2 style={{ marginBottom: '8px' }}>You are connected.</h2>
          <p className="auth-sub" style={{ marginBottom: '20px' }}>
            Your teacher can now see your progress. Start practising — you get your own report after every call.
          </p>
          <button type="button" className="btn-primary" onClick={() => navigate('/')}>
            Let us begin 🚀
          </button>
        </div>
      </div>
    );
  }

  const checkboxRow = (checked, onChange, children, key) => (
    <label
      key={key}
      style={{
        display: 'flex', gap: '10px', alignItems: 'flex-start',
        fontSize: '14px', lineHeight: 1.45, marginBottom: '12px',
        cursor: 'pointer', fontWeight: 400,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: '18px', height: '18px', marginTop: '1px', flexShrink: 0 }}
      />
      <span>{children}</span>
    </label>
  );

  return (
    <div className="auth-page" style={{ alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div className="auth-card" style={{ maxWidth: '420px', width: '100%' }}>
        <div className="auth-logo" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <Logo width={160} />
        </div>

        <h2 style={{ textAlign: 'center', marginBottom: '8px' }}>Connect with your teacher 🎓</h2>
        <p className="auth-sub" style={{ textAlign: 'center', marginBottom: '20px' }}>
          Enter the code your teacher gave you. They will then be able to see your speaking progress.
        </p>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>Teacher code</label>
          <input
            type="text"
            placeholder="E.G. AYTAC01"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={12}
            required
          />

          {/* Doğum tarixi sahəsi qəsdən yoxdur: əlavə sürtünmə yaradırdı və
              Google hesabı doğum tarixini vermir. Müəllimin analizə baxma
              icazəsi isə AÇIQ razılıq kimi qalır — funnel-in əsası budur. */}
          <div style={{ marginTop: '14px', marginBottom: '4px' }}>
            {checkboxRow(consent, setConsent, (
              <>I agree that my teacher can see my speaking progress and call analyses.</>
            ), 'consent')}
          </div>

          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            {loading ? 'Connecting...' : 'Connect to teacher'}
          </button>
        </form>

        <button
          type="button"
          onClick={dismiss}
          style={{
            width: '100%', background: 'none', border: 'none',
            color: 'var(--text-secondary, #888)', fontSize: '14px',
            marginTop: '12px', cursor: 'pointer',
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
