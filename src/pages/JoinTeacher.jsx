import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from '../components/Logo';
import {
  claimTeacherCode,
  ageFromBirthDate,
  readCodeFromLocation,
  getPendingJoinCode,
  clearPendingJoinCode,
  MIN_LINK_AGE,
  ADULT_AGE,
} from '../utils/teacher';

// Şagirdin müəllimə qoşulma ekranı. Link (/join?c=KOD) və ya əl ilə kod.
// Yaş + razılıq burada toplanır; server onu YENİDƏN yoxlayır — bu forma
// yalnız istifadəçiyə düzgün sualı vaxtında vermək üçündür.
export default function JoinTeacher({ user }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [code, setCode] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [consent, setConsent] = useState(false);
  const [guardianConsent, setGuardianConsent] = useState(false);
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

  const age = ageFromBirthDate(birthDate);
  const isMinor = age !== null && age < ADULT_AGE;
  const tooYoung = age !== null && age < MIN_LINK_AGE;

  const canSubmit = code.trim().length >= 4
    && age !== null
    && !tooYoung
    && consent
    && (!isMinor || guardianConsent)
    && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    const result = await claimTeacherCode({
      code: code.trim().toUpperCase(),
      birthDate,
      consent,
      guardianConsent,
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
          <h2 style={{ marginBottom: '8px' }}>Müəlliminiz var</h2>
          <p className="auth-sub" style={{ marginBottom: '20px' }}>
            Siz artıq bir müəllimə bağlısınız. Dəyişiklik üçün müəlliminizlə əlaqə saxlayın.
          </p>
          <button type="button" className="btn-primary" onClick={dismiss}>
            Ana səhifə
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
          <h2 style={{ marginBottom: '8px' }}>Qoşuldunuz!</h2>
          <p className="auth-sub" style={{ marginBottom: '20px' }}>
            Müəlliminiz artıq proqresinizi görə biləcək. İndi danışıq praktikasına başlayın —
            hər zəngdən sonra öz analizinizi alacaqsınız.
          </p>
          <button type="button" className="btn-primary" onClick={() => navigate('/')}>
            Başlayaq 🚀
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

        <h2 style={{ textAlign: 'center', marginBottom: '8px' }}>Müəlliminizə qoşulun 🎓</h2>
        <p className="auth-sub" style={{ textAlign: 'center', marginBottom: '20px' }}>
          Müəlliminizin verdiyi kodu daxil edin. Bundan sonra o, danışıq proqresinizi görə biləcək.
        </p>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>Müəllim kodu</label>
          <input
            type="text"
            placeholder="MƏS: AYTAC01"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={12}
            required
          />

          <label>Doğum tarixiniz</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            required
          />
          {tooYoung && (
            <p style={{ color: '#e5484d', fontSize: '13px', marginTop: '-6px', marginBottom: '12px' }}>
              Bu xidmət {MIN_LINK_AGE} yaşdan yuxarı istifadəçilər üçündür.
            </p>
          )}

          <div style={{ marginTop: '6px', marginBottom: '4px' }}>
            {checkboxRow(consent, setConsent, (
              <>Müəllimimin danışıq proqresimi və zəng analizlərimi görməsinə razıyam.</>
            ), 'consent')}

            {/* Yalnız 18 yaşdan kiçiklərə görünür — məhz bu yaş qrupu üçün
                hesabat valideynə göstərilir. */}
            {isMinor && !tooYoung && checkboxRow(guardianConsent, setGuardianConsent, (
              <>18 yaşım tamam deyil və valideynim/qəyyumum bu razılıqdan xəbərdardır.</>
            ), 'guardian')}
          </div>

          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            {loading ? 'Qoşulur...' : 'Müəllimə qoşul'}
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
          İndi yox
        </button>
      </div>
    </div>
  );
}
