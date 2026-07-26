import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import {
  createInviteCode,
  buildJoinLink,
  inviteStudentByEmail,
  TEACHER_SESSIONS_REQUIRED,
} from '../utils/teacher';

// Müəllim Dashboard-u. İki giriş yolu var:
//   1) B2B2C onboarding: qeydiyyatda "I am a Teacher" seçən — role='teacher',
//      teacherEligible=true dərhal yazılır, bura birbaşa düşür.
//   2) Köhnə funnel: şagird kimi başlayıb 3 sessiyadan sonra açılan istifadəçi.
// Kod yaradılana qədər kod formu, sonra tam dashboard: dəvət linki + roster.
export default function TeacherUnlock({ user }) {
  const { t } = useTranslation(['headers', 'ranking', 'teacher', 'common']);
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [myCode, setMyCode] = useState(null);
  const [checking, setChecking] = useState(true);
  const [copied, setCopied] = useState('');
  // null = hələ yüklənir; [] = yüklənib, boşdur. İkisini ayırmaq vacibdir —
  // əks halda boş roster əbədi "yüklənir" kimi görünərdi (Ranking dərsi).
  const [roster, setRoster] = useState(null);
  // Birbaşa dəvət: kod paylaşmaq həmişə işləmir (link itir, kod səhv yazılır).
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState(null); // {ok, text}

  const done = Number(user?.completedSessions) || 0;
  const isTeacher = user?.role === 'teacher';
  const eligible = user?.teacherEligible === true || isTeacher;
  const remaining = Math.max(0, TEACHER_SESSIONS_REQUIRED - done);

  // Mövcud kodu teachers/{uid}-dən oxu (inviteCodes clientə bağlıdır, kod
  // müəllimin öz sənədində saxlanılır), ardınca roster-i çək.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.uid || !eligible) { setChecking(false); return; }
      try {
        const snap = await getDoc(doc(db, 'teachers', user.uid));
        if (alive && snap.exists()) setMyCode(snap.data().inviteCode || null);
      } catch { /* teachers sənədi hələ yoxdursa forma göstərilir */ }
      try {
        const rs = await getDocs(collection(db, 'teachers', user.uid, 'roster'));
        if (alive) setRoster(rs.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch {
        if (alive) setRoster([]); // sənəd yoxdursa oxu icazəsi də yoxdur — boş say
      }
      if (alive) setChecking(false);
    })();
    return () => { alive = false; };
  }, [user?.uid, eligible]);

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
    setRoster((r) => r || []);
    setLoading(false);
  };

  const sendInvite = async (e) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    setInviteMsg(null);
    const res = await inviteStudentByEmail(email);
    if (!res.ok) {
      setInviteMsg({ ok: false, text: res.errorText });
    } else {
      setInviteMsg({
        ok: true,
        text: `${res.data.studentName || email} adlı şagirdə dəvət göndərildi — tətbiqdə bildiriş alacaq.`,
      });
      setInviteEmail('');
    }
    setInviting(false);
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

  // ─── 1. Şagird üçün hələ kilidli (köhnə funnel yolu) ───────────
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

  // ─── 2. Kod hələ yüklənir ──────────────────────────────────────
  // Bu gate OLMADAN hər dashboard açılışında kod formu ~0.2 saniyə yanıb-sönür:
  // myCode Firestore-dan asinxron gəlir, ilk render-də isə hələ null olur və
  // aşağıdakı "kod yarat" ekranı göstərilir. Kodu olan müəllim üçün bu ekran
  // heç vaxt görünməməlidir.
  if (checking) {
    return (
      <div className="auth-page" style={{ alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
        <div className="auth-card" style={{ ...cardStyle, textAlign: 'center' }}>
          <div className="loading-logo" style={{ fontSize: '34px' }}>🎙️</div>
          <p style={{ color: 'var(--text-secondary, #888)', fontSize: '14px', marginTop: '12px', marginBottom: 0 }}>
            {t('common:loading')}
          </p>
        </div>
      </div>
    );
  }

  // ─── 3. Açıqdır, kod hələ yoxdur — kod formu ───────────────────
  if (!myCode) {
    return (
      <div className="auth-page" style={{ alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
        <div className="auth-card" style={cardStyle}>
          <div style={{ fontSize: '46px', textAlign: 'center' }}>🔓</div>
          <h2 style={{ textAlign: 'center', marginBottom: '6px' }}>
            {isTeacher && done < TEACHER_SESSIONS_REQUIRED
              ? t('teacher:welcomeTeacher')
              : t('teacher:unlockedTitle')}
          </h2>
          <p style={{
            textAlign: 'center', color: 'var(--text-secondary, #888)',
            fontSize: '15px', lineHeight: 1.5, marginBottom: '20px',
          }}>
            Şagirdlərinizin sizə qoşulması üçün bir kod seçin — dəvət linkiniz
            və şagird siyahınız burada olacaq.
          </p>

          {error && <div className="error-box">{error}</div>}

          <form onSubmit={handleSubmit}>
            <label>{t('teacher:yourStudentCode')}</label>
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
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '16px',
                fontWeight: 600,
                marginTop: '8px',
                outline: 'none',
              }}
            />
            <p style={{
              fontSize: '13px', color: 'var(--text-secondary, #888)',
              marginTop: '-6px', marginBottom: '14px',
            }}>
              4–12 hərf və ya rəqəm. Şagirdlərinizin yadda saxlaya biləcəyi bir şey seçin.
            </p>
            <button type="submit" className="btn-primary" disabled={loading || code.trim().length < 4}>
              {loading ? t('teacher:creatingCode') : t('teacher:createCode')}
            </button>
          </form>
          {back}
        </div>
      </div>
    );
  }

  // ─── 4. Dashboard: dəvət + roster ──────────────────────────────
  const link = buildJoinLink(myCode);
  const shareText = `Salam! SpeakLab-da İngilis dili danışıq praktikası üçün mənim şagird kodum: ${myCode}\n${link}`;
  const students = roster || [];
  // toLocaleDateString('az-AZ') bəzi WebView-lərdə ay adını "M07" kimi verir —
  // ay adları əl ilə yazılıb.
  const AZ_MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avq', 'sen', 'okt', 'noy', 'dek'];
  const fmtDate = (ts) => {
    const ms = ts && ts.toMillis ? ts.toMillis() : (typeof ts === 'string' ? Date.parse(ts) : null);
    if (!ms) return '—';
    const d = new Date(ms);
    return `${d.getDate()} ${AZ_MONTHS[d.getMonth()]}`;
  };

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="home-logo">{t('headers:teacherPanel')}</div>
      </div>
      {/* PC-də mərkəzlənmiş dar sütun, telefonda tam en. */}
      <div className="home-body" style={{ paddingBottom: '90px', maxWidth: '760px', margin: '0 auto', width: '100%' }}>

        {/* Dəvət bölməsi */}
        <div style={{
          background: 'linear-gradient(135deg, #7c6ff722, #5b4de822)',
          border: '1px solid #7c6ff755', borderRadius: '16px',
          padding: '18px', marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700 }}>{t('teacher:inviteCode')}</span>
            <span style={{
              fontSize: '22px', fontWeight: 900, letterSpacing: '2px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}>
              {myCode}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => copy(link, 'link')}
              style={{
                flex: 1, padding: '10px', borderRadius: '12px', cursor: 'pointer',
                border: '1px solid #7c6ff755', background: 'var(--bg-card)',
                color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700,
              }}
            >
              {copied === 'link' ? `✅ ${t('common:copied')}` : t('teacher:copyLink')}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1, padding: '10px', borderRadius: '12px',
                border: '1px solid #25D36655', color: '#25D366',
                fontSize: '13px', fontWeight: 700, textAlign: 'center',
                textDecoration: 'none',
              }}
            >
              💬 WhatsApp
            </a>
          </div>
        </div>

        {/* Birbaşa dəvət — linkin çatmadığı hallar üçün */}
        <form onSubmit={sendInvite} style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '16px', marginBottom: '16px',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            ✉️ Şagirdi birbaşa dəvət et
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.5 }}>
            Şagirdin tətbiqdə qeydiyyatdan keçdiyi e-poçtu yazın — dəvət onun ekranına düşəcək.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="sagird@gmail.com"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              style={{
                flex: 1, padding: '11px 12px', borderRadius: '12px',
                border: '1px solid var(--border)', background: 'var(--bg-input)',
                color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              style={{
                padding: '11px 16px', borderRadius: '12px', border: 'none',
                background: (inviting || !inviteEmail.trim())
                  ? 'var(--bg-card)'
                  : 'linear-gradient(135deg, var(--accent), var(--accent-strong))',
                color: (inviting || !inviteEmail.trim()) ? 'var(--text-muted)' : '#fff',
                fontSize: '14px', fontWeight: 800,
                cursor: (inviting || !inviteEmail.trim()) ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {inviting ? '...' : 'Dəvət et'}
            </button>
          </div>
          {inviteMsg && (
            <div style={{
              marginTop: '10px', fontSize: '13px', lineHeight: 1.5,
              color: inviteMsg.ok ? 'var(--success)' : 'var(--danger)',
            }}>
              {inviteMsg.ok ? '✅ ' : '⚠️ '}{inviteMsg.text}
            </div>
          )}
        </form>

        {/* Roster */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          margin: '4px 2px 8px',
        }}>
          <span style={{ fontSize: '15px', fontWeight: 800 }}>{t('teacher:myStudents')}</span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {roster === null ? '' : `${students.length} ${t('common:people')}`}
          </span>
        </div>

        {roster === null ? (
          <div className="empty-state" style={{ padding: '30px 20px', textAlign: 'center' }}>
            <div className="empty-icon">⏳</div>
            <p style={{ color: 'var(--text-secondary)' }}>{t('common:loading')}</p>
          </div>
        ) : students.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px 20px', textAlign: 'center' }}>
            <div className="empty-icon">🪺</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>
              {t('teacher:noStudents')}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {t('teacher:noStudentsHint')}
            </p>
          </div>
        ) : (
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '16px', overflow: 'hidden',
          }}>
            {students.map((s, i) => (
              <div
                key={s.id}
                onClick={() => navigate(`/teacher/student/${s.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/teacher/student/${s.id}`); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '13px 16px', cursor: 'pointer',
                  borderBottom: i < students.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{
                  width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #7c6ff733, #5b4de833)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', fontWeight: 800, color: '#7c6ff7',
                }}>
                  {(s.displayName || '?').slice(0, 1).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.displayName || 'Şagird'}
                    {Number(s.streak) > 0 && (
                      <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 800, marginLeft: '6px' }}>
                        🔥{s.streak}
                      </span>
                    )}
                  </div>
                  {/* Proqres sətri: consumeTrialMinutes hər ≥2 dəq zəngdən sonra
                      roster-ə denormalizə yazır (sessiya sayı + son aktivlik). */}
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {Number(s.completedSessions) > 0
                      ? `${s.completedSessions} ${t('teacher:sessions')} · ${t('teacher:lastActive')}: ${fmtDate(s.lastActiveAt)}`
                      : `${t('teacher:joined')}: ${fmtDate(s.joinedAt)} · ${t('teacher:notCalledYet')}`}
                  </div>
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '4px 10px',
                  borderRadius: '99px', flexShrink: 0,
                  background: s.status === 'active' ? '#22c55e22' : '#f59e0b22',
                  color: s.status === 'active' ? '#16a34a' : '#d97706',
                }}>
                  {s.status === 'active' ? t('teacher:active') : t('teacher:inactive')}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '18px', flexShrink: 0 }}>›</span>
              </div>
            ))}
          </div>
        )}

        <p style={{
          fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center',
          marginTop: '14px', lineHeight: 1.5,
        }}>
          {t('teacher:reportsSoon')}
        </p>
      </div>
    </div>
  );
}
