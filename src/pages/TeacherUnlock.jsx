import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase';
import {
  createInviteCode,
  buildJoinLink,
  inviteStudentByEmail,
  inviteStudentByUid,
  updateTeacherProfile,
  TEACHER_SESSIONS_REQUIRED,
  TUTOR_SPECIALTIES,
} from '../utils/teacher';
import TutorBadge from '../components/TutorBadge';

// Təsdiq vəziyyəti → müəllimə göstərilən mətn. Ton qəsdən yalnız izahedici və
// müsbətdir: müdafiə cümləsi ("şagirdinizi almırıq") qorxunu adlandırıb yaradır.
const VERIFICATION_TEXT = {
  verified: { text: 'Təsdiqlənib — adınızın yanında Tutor nişanı görünür.', color: 'var(--success)' },
  pending: { text: 'Baxılır — təsdiqdən sonra adınızın yanında Tutor nişanı görünəcək.', color: '#d97706' },
  rejected: { text: 'Profil natamamdır — məlumatları tamamlayıb yenidən göndərin.', color: 'var(--danger)' },
  none: { text: 'Profilinizi doldurun — SpeakLab tədris keyfiyyətinizi və məhsuldarlığınızı artıran alətdir.', color: 'var(--text-secondary)' },
};

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
  // Tutor profili. Başlanğıc dəyər user-dən bir dəfə (lazy initializer) götürülür
  // ki, effect-in asılılıq siyahısına user.name/bio girməsin və redaktə zamanı
  // sıfırlanma riski olmasın.
  const [profile, setProfile] = useState(() => ({
    displayName: user?.name || '',
    bio: user?.bio || '',
    specialties: [],
    yearsExperience: 0,
  }));
  const [verification, setVerification] = useState('none');
  const [profileOpen, setProfileOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null); // {ok, text}
  // İstifadəçi kataloqu — e-poçt yazmadan bir toxunuşla dəvət.
  const [directory, setDirectory] = useState(null);
  const [dirOpen, setDirOpen] = useState(false);
  const [dirSearch, setDirSearch] = useState('');
  const [invitedUids, setInvitedUids] = useState(() => new Set());

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
        if (alive && snap.exists()) {
          const d = snap.data();
          setMyCode(d.inviteCode || null);
          setVerification(d.verificationStatus || 'none');
          // Sənəddə profil varsa onu göstər; yoxdursa lazy initializer-dəki
          // user adı qalsın (boş forma yerinə hazır ad).
          if (d.displayName || d.bio || d.specialties || d.yearsExperience) {
            // Funksional forma qəsdəndir: `p.displayName` lazy initializer-dən
            // gələn user adıdır, ona görə effect-in user.name-dən asılılığı
            // (və deməli redaktə zamanı sıfırlanma riski) yaranmır.
            setProfile((p) => ({
              displayName: d.displayName || p.displayName,
              bio: d.bio || '',
              specialties: Array.isArray(d.specialties) ? d.specialties : [],
              yearsExperience: Number(d.yearsExperience) || 0,
            }));
          }
        }
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

  // Kataloq yalnız açılanda yüklənir — panelin ilk açılışını ağırlaşdırmasın.
  const openDirectory = async () => {
    setDirOpen((o) => !o);
    if (directory !== null) return;
    try {
      const qs = await getDocs(query(collection(db, 'users'), limit(200)));
      setDirectory(qs.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('[TeacherDirectory]', e);
      setDirectory([]);
    }
  };

  const inviteFromDirectory = async (u) => {
    setInviting(u.id);
    setInviteMsg(null);
    const res = await inviteStudentByUid(u.id);
    setInviting(false);
    if (!res.ok) {
      setInviteMsg({ ok: false, text: `${u.name || 'İstifadəçi'}: ${res.errorText}` });
      return;
    }
    setInvitedUids((prev) => new Set(prev).add(u.id));
    setInviteMsg({ ok: true, text: `${u.name || 'İstifadəçi'} adlı şagirdə dəvət göndərildi.` });
  };

  const toggleSpecialty = (s) => {
    setProfile((p) => {
      const has = p.specialties.includes(s);
      if (has) return { ...p, specialties: p.specialties.filter((x) => x !== s) };
      if (p.specialties.length >= 5) return p; // server də 5-də kəsir
      return { ...p, specialties: [...p.specialties, s] };
    });
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!profile.displayName.trim()) return;
    setSavingProfile(true);
    setProfileMsg(null);
    const res = await updateTeacherProfile({
      displayName: profile.displayName.trim(),
      bio: profile.bio.trim(),
      specialties: profile.specialties,
      yearsExperience: Number(profile.yearsExperience) || 0,
    });
    if (!res.ok) {
      setProfileMsg({ ok: false, text: res.errorText });
    } else {
      setVerification(res.data.verificationStatus || 'pending');
      setProfileMsg({
        ok: true,
        text: res.data.verificationStatus === 'verified'
          ? 'Profiliniz yeniləndi.'
          : 'Profiliniz təsdiqə göndərildi.',
      });
      setProfileOpen(false);
    }
    setSavingProfile(false);
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
                fontSize: '17px',
                fontWeight: 700,
                letterSpacing: '2px',
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                marginTop: '8px',
                outline: 'none',
              }}
            />
            {/* Əvvəl marginTop:-6px idi — ipucu input-un dibinə yapışırdı və
                bir yerdə oxunurdu. İndi ayrı sətir kimi nəfəs alır. */}
            <p style={{
              fontSize: '12.5px', lineHeight: 1.55,
              color: 'var(--text-secondary, #888)',
              margin: '10px 2px 18px',
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

  // ─── Sinif analitikası ────────────────────────────────────────
  // Mənbə roster sənədlərinin ÖZÜDÜR: analiz nəticələri serverdə
  // (processAnalysisQueue) buraya denormalizə olunur. Şagird başına callAnalysis
  // sorğusu etsəydik, rules-dakı get(users/{userId}) səbəbindən 30 şagird üçün
  // yüzlərlə əlavə oxu olardı — burada isə əlavə sorğu SIFIRDIR.
  const scored = students.filter((s) => Number(s.scoreCount) > 0);
  const classAvg = scored.length
    ? Math.round(scored.reduce(
      (sum, s) => sum + (Number(s.scoreSum) || 0) / Number(s.scoreCount), 0,
    ) / scored.length)
    : null;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const activeThisWeek = students.filter((s) => {
    const ms = s.lastActiveAt && s.lastActiveAt.toMillis ? s.lastActiveAt.toMillis() : 0;
    return ms > weekAgo;
  }).length;

  // Mövzu histoqramı. Açar `trim().toLowerCase()` ilə qurulur —
  // toLocaleLowerCase('az') İŞLƏDİLMİR: o, "I" hərfini "ı"ya çevirib ingilis
  // qrammatika başlıqlarını ("Articles", "Past Simple") tanınmaz hala salır.
  const themeCounts = new Map();
  students.forEach((s) => {
    (Array.isArray(s.recentThemes) ? s.recentThemes : []).forEach((raw) => {
      const title = String(raw || '').trim();
      if (!title) return;
      const key = title.toLowerCase();
      const prev = themeCounts.get(key);
      themeCounts.set(key, {
        title: prev ? prev.title : title,
        count: (prev ? prev.count : 0) + 1,
      });
    });
  });
  const topThemes = [...themeCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Nişanın həqiqət mənbəyi user.teacherVerified-dir (server-yazılı, canlı
  // sinxronlaşır); teachers sənədindəki status ondan geri qala bilər.
  const verifState = user?.teacherVerified ? 'verified' : (verification || 'none');
  const verifInfo = VERIFICATION_TEXT[verifState] || VERIFICATION_TEXT.none;
  const fieldStyle = {
    width: '100%', padding: '11px 12px', borderRadius: '12px',
    border: '1px solid var(--border)', background: 'var(--bg-input)',
    color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
  };

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="home-logo">{t('headers:teacherPanel')}</div>
      </div>
      {/* PC-də mərkəzlənmiş dar sütun, telefonda tam en. */}
      <div className="home-body" style={{ paddingBottom: '90px', maxWidth: '760px', margin: '0 auto', width: '100%' }}>

        {/* Tutor profili — nişanın arxasındakı məzmun. Yığcam status sətri +
            açılan forma: gündəlik işi (dəvət, roster) yuxarıdan itələməsin. */}
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '16px', marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)',
                display: 'flex', alignItems: 'center', flexWrap: 'wrap',
              }}>
                🎓 Tutor profiliniz
                {verifState === 'verified' && <TutorBadge />}
              </div>
              <div style={{ fontSize: '12px', color: verifInfo.color, marginTop: '4px', lineHeight: 1.5 }}>
                {verifInfo.text}
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setProfileOpen((o) => !o); setProfileMsg(null); }}
              style={{
                flexShrink: 0, padding: '8px 14px', borderRadius: '10px',
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {profileOpen ? 'Bağla' : 'Redaktə et'}
            </button>
          </div>

          {profileMsg && !profileOpen && (
            <div style={{
              marginTop: '10px', fontSize: '13px',
              color: profileMsg.ok ? 'var(--success)' : 'var(--danger)',
            }}>
              {profileMsg.ok ? '✅ ' : '⚠️ '}{profileMsg.text}
            </div>
          )}

          {profileOpen && (
            <form onSubmit={saveProfile} style={{ marginTop: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Profildə görünən ad
              </label>
              <input
                type="text"
                value={profile.displayName}
                onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
                maxLength={60}
                placeholder="Aytac Məmmədova"
                style={fieldStyle}
              />

              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', margin: '14px 0 6px' }}>
                İxtisas (5-ə qədər)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {TUTOR_SPECIALTIES.map((s) => {
                  const on = profile.specialties.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSpecialty(s)}
                      style={{
                        padding: '7px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                        cursor: 'pointer',
                        border: on ? '1px solid #0891b2' : '1px solid var(--border)',
                        background: on ? '#22d3ee22' : 'var(--bg-card)',
                        color: on ? '#0891b2' : 'var(--text-secondary)',
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>

              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', margin: '14px 0 6px' }}>
                Təcrübə (il)
              </label>
              <input
                type="number"
                min="0"
                max="60"
                value={profile.yearsExperience}
                onChange={(e) => setProfile((p) => ({ ...p, yearsExperience: e.target.value }))}
                style={{ ...fieldStyle, maxWidth: '140px' }}
              />

              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', margin: '14px 0 6px' }}>
                Haqqınızda
              </label>
              <textarea
                value={profile.bio}
                onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                maxLength={400}
                rows={3}
                placeholder="Nə tədris edirsiniz, kimlərlə işləyirsiniz?"
                style={{ ...fieldStyle, resize: 'vertical' }}
              />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right', marginTop: '4px' }}>
                {profile.bio.length}/400
              </div>

              {profileMsg && (
                <div style={{
                  marginTop: '10px', fontSize: '13px', lineHeight: 1.5,
                  color: profileMsg.ok ? 'var(--success)' : 'var(--danger)',
                }}>
                  {profileMsg.ok ? '✅ ' : '⚠️ '}{profileMsg.text}
                </div>
              )}

              <button
                type="submit"
                disabled={savingProfile || !profile.displayName.trim()}
                style={{
                  width: '100%', marginTop: '14px', padding: '12px', borderRadius: '12px', border: 'none',
                  background: (savingProfile || !profile.displayName.trim())
                    ? 'var(--bg-card)'
                    : 'linear-gradient(135deg, var(--accent), var(--accent-strong))',
                  color: (savingProfile || !profile.displayName.trim()) ? 'var(--text-muted)' : '#fff',
                  fontSize: '14px', fontWeight: 800,
                  cursor: (savingProfile || !profile.displayName.trim()) ? 'default' : 'pointer',
                }}
              >
                {savingProfile ? '...' : (verifState === 'verified' ? 'Yadda saxla' : 'Təsdiqə göndər')}
              </button>
            </form>
          )}
        </div>

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

        {/* İstifadəçi kataloqu — e-poçt yazmadan bir toxunuşla dəvət.
            Müəllimin şikayəti: "link atıram çatmır, e-poçtu tapa bilmirəm".
            Burada axtarıb düyməyə basmaq kifayətdir; dəvət şagirdin ekranına
            banner + push kimi düşür. */}
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '14px', marginBottom: '16px',
        }}>
          <button
            type="button"
            onClick={openDirectory}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                👥 İstifadəçilərdən seç
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Siyahıdan birbaşa dəvət göndərin — e-poçt yazmağa ehtiyac yoxdur
              </div>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '18px', flexShrink: 0 }}>
              {dirOpen ? '⌃' : '⌄'}
            </span>
          </button>

          {dirOpen && (
            <div style={{ marginTop: '12px' }}>
              <input
                type="text"
                value={dirSearch}
                onChange={(e) => setDirSearch(e.target.value)}
                placeholder="Ad ilə axtarın…"
                style={{ ...fieldStyle, marginBottom: '10px' }}
              />
              {directory === null ? (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('common:loading')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
                  {directory
                    .filter((u) => u.id !== user.uid && u.role !== 'teacher')
                    .filter((u) => !dirSearch
                      || String(u.name || '').toLowerCase().includes(dirSearch.trim().toLowerCase()))
                    .slice(0, 60)
                    .map((u) => {
                      const isMine = u.teacherId === user.uid;
                      const otherTeacher = !!u.teacherId && !isMine;
                      const sent = invitedUids.has(u.id);
                      return (
                        <div key={u.id} style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          background: 'var(--bg-card)', borderRadius: '11px', padding: '9px 11px',
                        }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg, #7c6ff733, #5b4de833)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, color: '#7c6ff7', fontSize: '13px',
                          }}>
                            {(u.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {u.name || 'İstifadəçi'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              {u.level || 'Səviyyə qeyd edilməyib'}
                            </div>
                          </div>
                          {isMine ? (
                            <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 700, flexShrink: 0 }}>
                              ✓ Şagirdiniz
                            </span>
                          ) : otherTeacher ? (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
                              Başqa müəllimdə
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => inviteFromDirectory(u)}
                              disabled={inviting === u.id || sent}
                              style={{
                                flexShrink: 0, padding: '7px 12px', borderRadius: '9px',
                                fontSize: '12px', fontWeight: 800,
                                cursor: (inviting === u.id || sent) ? 'default' : 'pointer',
                                border: sent ? '1px solid var(--border)' : 'none',
                                background: sent
                                  ? 'transparent'
                                  : 'linear-gradient(135deg, var(--accent), var(--accent-strong))',
                                color: sent ? 'var(--text-secondary)' : '#fff',
                              }}
                            >
                              {inviting === u.id ? '...' : sent ? 'Göndərildi' : 'Dəvət et'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sinif analitikası — panelin əsas faydası: müəllim hazır dərs planı alır */}
        {students.length > 0 && (
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '16px', marginBottom: '16px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
              📊 Sinfiniz bu həftə
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))',
              gap: '10px',
            }}>
              {[
                { label: 'Aktiv şagird', value: `${activeThisWeek}/${students.length}` },
                { label: 'Sinif ortalaması', value: classAvg ?? '—' },
                { label: 'Analiz edilən', value: scored.length },
              ].map((tile) => (
                <div key={tile.label} style={{
                  background: 'var(--bg-card)', borderRadius: '12px',
                  padding: '12px 8px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)' }}>{tile.value}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{tile.label}</div>
                </div>
              ))}
            </div>

            {topThemes.length > 0 ? (
              <>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: '16px 2px 8px' }}>
                  Ən çox təkrarlanan mövzular
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {topThemes.map((th, i) => (
                    <div key={th.title} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      background: 'var(--bg-card)', borderRadius: '10px', padding: '10px 12px',
                    }}>
                      <span style={{ fontSize: '13px', fontWeight: 900, color: '#7c6ff7', minWidth: '16px' }}>{i + 1}</span>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>
                        {th.title}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {th.count}×
                      </span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '10px 2px 0' }}>
                  Bu mövzuları növbəti dərsinizdə vurğulasanız, sinfinizin ən çox təkrarladığı
                  səhvləri bir dəfəyə həll edəcəksiniz.
                </p>
              </>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '14px 2px 0' }}>
                Şagirdləriniz danışdıqca burada sinfin ən çox təkrarladığı səhv mövzuları görünəcək.
              </p>
            )}
          </div>
        )}

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
