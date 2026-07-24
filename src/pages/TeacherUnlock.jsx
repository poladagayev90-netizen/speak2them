import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  createInviteCode,
  buildJoinLink,
  TEACHER_SESSIONS_REQUIRED,
} from '../utils/teacher';

// Müəllim funnel-i. Bu ekran qeydiyyatda "müəllim" seçdirmir — istifadəçi
// normal danışır, öz analizini alır və yalnız 3 sessiyadan sonra bura açılır.
// Satan şey elə budur: müəllim ÖZ səsinin analizini görüb "şagirdim də bunu
// alacaq" deyir. Ona görə kilidli halda da nə alacağını göstəririk.
export default function TeacherUnlock({ user }) {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [myCode, setMyCode] = useState(null);
  const [checking, setChecking] = useState(true);
  const [copied, setCopied] = useState('');

  const done = Number(user?.completedSessions) || 0;
  const eligible = user?.teacherEligible === true;
  const remaining = Math.max(0, TEACHER_SESSIONS_REQUIRED - done);

  // Mövcud kodu teachers/{uid}-dən oxu. inviteCodes kolleksiyası clientə
  // bağlıdır, ona görə kod müəllimin öz sənədində saxlanılır.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.uid || user.role !== 'teacher') { setChecking(false); return; }
      try {
        const snap = await getDoc(doc(db, 'teachers', user.uid));
        if (alive && snap.exists()) setMyCode(snap.data().inviteCode || null);
      } catch { /* qayda ilə bağlıdırsa sadəcə forma göstərilir */ }
      if (alive) setChecking(false);
    })();
    return () => { alive = false; };
  }, [user?.uid, user?.role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) return;
    setError('');
    setLoading(true);
    const result = await createInviteCode(trimmed);
    if (!result.ok) {
      setError(result.errorText);
      setLoading(false);
      return;
    }
    setMyCode(result.data.code);
    setLoading(false);
  };

  const copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(''), 1800);
    } catch {
      setError('Kopyalana bilmədi — mətni əl ilə seçin.');
    }
  };

  // Mövcud .auth-page/.auth-card sinifləri işlədilir (Redeem.jsx ilə eyni):
  // onlar --bg-card / --border dəyişənlərinə bağlıdır, ona görə dark mode-da
  // da düzgün görünür. Əl ilə yazılmış ağ fon burada mətni görünməz edirdi.
  const cardStyle = { maxWidth: '440px', width: '100%' };
  const back = (
    <button
      type="button"
      onClick={() => navigate('/profile')}
      style={{
        width: '100%', background: 'none', border: 'none',
        color: 'var(--text-secondary, #888)', fontSize: '14px',
        marginTop: '16px', cursor: 'pointer',
      }}
    >
      ← Geri
    </button>
  );

  // ─── 1. Hələ kilidli ───────────────────────────────────────────
  if (!eligible) {
    const pct = Math.min(100, (done / TEACHER_SESSIONS_REQUIRED) * 100);
    return (
      <div className="auth-page" style={{ alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
        <div className="auth-card" style={cardStyle}>
          <div style={{ fontSize: '46px', textAlign: 'center' }}>🎓</div>
          <h2 style={{ textAlign: 'center', marginBottom: '6px' }}>Müəllim rejimi</h2>
          <p style={{
            textAlign: 'center', color: 'var(--text-secondary, #888)',
            fontSize: '15px', lineHeight: 1.5, marginBottom: '20px',
          }}>
            Şagirdlərinizi izləmək üçün əvvəlcə özünüz danışın.
            {' '}<strong>{TEACHER_SESSIONS_REQUIRED} sessiya</strong> tamamlayın —
            öz analizinizi görəcəksiniz, şagirdiniz də məhz onu alacaq.
          </p>

          <div style={{
            background: 'linear-gradient(135deg, #7c6ff722, #5b4de822)',
            border: '1px solid #7c6ff755', borderRadius: '16px',
            padding: '18px', marginBottom: '18px',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: '14px', fontWeight: 700, marginBottom: '10px',
            }}>
              <span>Proqres</span>
              <span>{done} / {TEACHER_SESSIONS_REQUIRED}</span>
            </div>
            <div style={{
              height: '10px', borderRadius: '99px',
              background: 'rgba(124,111,247,0.18)', overflow: 'hidden',
            }}>
              <div style={{
                width: `${pct}%`, height: '100%', borderRadius: '99px',
                background: 'linear-gradient(90deg, #7c6ff7, #5b4de8)',
                transition: 'width .4s ease',
              }} />
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary, #888)', marginTop: '10px', marginBottom: 0 }}>
              {remaining === 0
                ? 'Hazırdır — səhifəni yeniləyin.'
                : `Daha ${remaining} sessiya qaldı. Sessiya = 2 dəqiqədən uzun zəng.`}
            </p>
          </div>

          <button type="button" className="btn-primary" onClick={() => navigate('/')}>
            Danışmağa başla 🎙️
          </button>
          {back}
        </div>
      </div>
    );
  }

  // ─── 2. Açıqdır, kod hazırdır ──────────────────────────────────
  if (myCode) {
    const link = buildJoinLink(myCode);
    const shareText = `Salam! SpeakLab-da İngilis dili danışıq praktikası üçün mənim şagird kodum: ${myCode}\n${link}`;
    return (
      <div className="auth-page" style={{ alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
        <div className="auth-card" style={cardStyle}>
          <div style={{ fontSize: '46px', textAlign: 'center' }}>🎉</div>
          <h2 style={{ textAlign: 'center', marginBottom: '6px' }}>Kodunuz hazırdır</h2>
          <p style={{
            textAlign: 'center', color: 'var(--text-secondary, #888)',
            fontSize: '15px', marginBottom: '20px',
          }}>
            Şagirdləriniz bu kodu daxil edəndə siyahınıza əlavə olunacaq.
          </p>

          <div style={{
            background: 'linear-gradient(135deg, #7c6ff722, #5b4de822)',
            border: '1px solid #7c6ff755', borderRadius: '16px',
            padding: '20px', marginBottom: '14px', textAlign: 'center',
          }}>
            <div style={{
              fontSize: '30px', fontWeight: 900, letterSpacing: '3px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}>
              {myCode}
            </div>
          </div>

          <button type="button" className="btn-primary" onClick={() => copy(myCode, 'code')}>
            {copied === 'code' ? '✅ Kopyalandı' : '📋 Kodu kopyala'}
          </button>

          <button
            type="button"
            onClick={() => copy(link, 'link')}
            style={{
              width: '100%', marginTop: '10px', padding: '14px',
              background: 'none', border: '1px solid var(--border, #e6e6ef)',
              borderRadius: '14px', cursor: 'pointer',
              color: 'var(--text-primary)', fontSize: '15px', fontWeight: 700,
            }}
          >
            {copied === 'link' ? '✅ Link kopyalandı' : '🔗 Dəvət linkini kopyala'}
          </button>

          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block', width: '100%', marginTop: '10px', padding: '14px',
              border: '1px solid #25D36655', borderRadius: '14px',
              color: '#25D366', fontSize: '15px', fontWeight: 700,
              textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box',
            }}
          >
            💬 WhatsApp-da paylaş
          </a>

          <p style={{
            fontSize: '13px', color: 'var(--text-secondary, #888)',
            marginTop: '16px', marginBottom: 0, textAlign: 'center', lineHeight: 1.5,
          }}>
            Şagird siyahınız və hesabatlar tezliklə burada görünəcək.
          </p>
          {back}
        </div>
      </div>
    );
  }

  // ─── 3. Açıqdır, kod hələ yoxdur ───────────────────────────────
  return (
    <div className="auth-page" style={{ alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div className="auth-card" style={cardStyle}>
        <div style={{ fontSize: '46px', textAlign: 'center' }}>🔓</div>
        <h2 style={{ textAlign: 'center', marginBottom: '6px' }}>Müəllim rejimi açıldı</h2>
        <p style={{
          textAlign: 'center', color: 'var(--text-secondary, #888)',
          fontSize: '15px', lineHeight: 1.5, marginBottom: '20px',
        }}>
          {TEACHER_SESSIONS_REQUIRED} sessiyanı tamamladınız. İndi şagirdlərinizin
          sizə qoşulması üçün bir kod seçin.
        </p>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>Şagird kodunuz</label>
          <input
            type="text"
            placeholder="MƏS: AYTAC01"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={12}
            disabled={checking}
            required
          />
          <p style={{
            fontSize: '13px', color: 'var(--text-secondary, #888)',
            marginTop: '-6px', marginBottom: '14px',
          }}>
            4–12 hərf və ya rəqəm. Şagirdlərinizin yadda saxlaya biləcəyi bir şey seçin.
          </p>
          <button type="submit" className="btn-primary" disabled={loading || code.trim().length < 4}>
            {loading ? 'Yaradılır...' : 'Kodu yarat'}
          </button>
        </form>
        {back}
      </div>
    </div>
  );
}
