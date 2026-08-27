import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, MessageCircle, BarChart3, BellRing, Check } from 'lucide-react';
import { doc, getDoc, collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase';
import {
  createInviteCode,
  buildJoinLink,
  inviteStudentByEmail,
  inviteStudentByUid,
  nudgeStudent,
  NUDGE_RESULT_TEXT,
  updateTeacherProfile,
  TEACHER_SESSIONS_REQUIRED,
  TUTOR_SPECIALTIES,
} from '../utils/teacher';
import TutorBadge from '../components/TutorBadge';
import { bakuDateStr } from '../utils/sessionSchedule';

// Təsdiq vəziyyəti → müəllimə göstərilən mətn. Ton qəsdən yalnız izahedici və
// müsbətdir: müdafiə cümləsi ("şagirdinizi almırıq") qorxunu adlandırıb yaradır.
const VERIFICATION_TEXT = {
  verified: { text: 'Verified. The Tutor badge now appears next to your name.', color: 'var(--success)' },
  pending: { text: 'Under review. The Tutor badge will appear next to your name once approved.', color: 'var(--warning)' },
  rejected: { text: 'Your profile is incomplete. Fill in the details and submit again.', color: 'var(--danger)' },
  none: { text: 'Complete your profile. SpeakLab gives you the tools to teach and track your students.', color: 'var(--text-secondary)' },
};

// Müəllim Dashboard-u. İki giriş yolu var:
//   1) B2B2C onboarding: qeydiyyatda "I am a Teacher" seçən — role='teacher',
//      teacherEligible=true dərhal yazılır, bura birbaşa düşür.
//   2) Köhnə funnel: şagird kimi başlayıb 3 sessiyadan sonra açılan istifadəçi.
// Kod yaradılana qədər kod formu, sonra tam dashboard: dəvət linki + roster.
export default function TeacherUnlock({ user }) {
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
  // Per-student reminder state: uid -> 'sending' | one of NUDGE_RESULT_TEXT.
  // Kept per row rather than as one global flag so a teacher with twenty
  // students can see which of them they have already chased.
  const [nudged, setNudged] = useState({});
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
        text: `Invitation sent to ${res.data.studentName || email} — they will get a notification in the app.`,
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
      setInviteMsg({ ok: false, text: `${u.name || 'User'}: ${res.errorText}` });
      return;
    }
    setInvitedUids((prev) => new Set(prev).add(u.id));
    setInviteMsg({ ok: true, text: `Invitation sent to ${u.name || 'User'}.` });
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
          ? 'Your profile has been updated.'
          : 'Your profile has been submitted for review.',
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
      setError('Could not copy — please select the text manually.');
    }
  };

  const cardStyle = { maxWidth: '440px', width: '100%' };
  const back = (
    <button
      type="button"
      onClick={() => navigate('/profile')}
      style={{
        width: '100%', background: 'none', border: 'none',
        color: 'var(--text-secondary)', fontSize: '14px',
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
          <div style={{ textAlign: 'center', color: 'var(--accent)' }}><GraduationCap size={40} strokeWidth={1.5} /></div>
          <h2 style={{ textAlign: 'center', marginBottom: '6px' }}>Teacher mode</h2>
          <p style={{
            textAlign: 'center', color: 'var(--text-secondary)',
            fontSize: '15px', lineHeight: 1.5, marginBottom: '20px',
          }}>
            Speak first yourself, then you can follow your students.
            {' '}<strong>{TEACHER_SESSIONS_REQUIRED} sessiya</strong> and you will see your own report — exactly what your students receive.
          </p>

          <div style={{
            background: 'var(--accent-soft)',
            border: '1px solid var(--border)', borderRadius: '16px',
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
              background: 'var(--accent-soft)', overflow: 'hidden',
            }}>
              <div style={{
                width: `${pct}%`, height: '100%', borderRadius: '99px',
                background: 'linear-gradient(90deg, var(--accent), var(--accent-strong))',
                transition: 'width .4s ease',
              }} />
            </div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '10px', marginBottom: 0 }}>
              {remaining === 0
                ? 'Done — refresh the page.'
                : `${remaining} sessions to go. A session is a call longer than 2 minutes.`}
            </p>
          </div>

          <button type="button" className="btn-primary" onClick={() => navigate('/')}>
            Start speaking
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
          <div className="loading-logo" style={{ fontSize: '34px' }}></div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '12px', marginBottom: 0 }}>
            {'Loading...'}
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
          <div style={{ textAlign: 'center', color: 'var(--accent)' }}><GraduationCap size={40} strokeWidth={1.5} /></div>
          <h2 style={{ textAlign: 'center', marginBottom: '6px' }}>
            {isTeacher && done < TEACHER_SESSIONS_REQUIRED
              ? 'Welcome, teacher'
              : 'Teacher mode unlocked'}
          </h2>
          <p style={{
            textAlign: 'center', color: 'var(--text-secondary)',
            fontSize: '15px', lineHeight: 1.5, marginBottom: '20px',
          }}>
            Pick a code your students can join with. Your invite link and student list will live here.
          </p>

          {error && <div className="error-box">{error}</div>}

          <form onSubmit={handleSubmit}>
            <label>{'Your student code'}</label>
            <input
              type="text"
              placeholder="E.G. AYTAC01"
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
              fontSize: '12.5px', fontWeight: 600, lineHeight: 1.55,
              color: 'var(--text-secondary)',
              margin: '10px 2px 18px',
            }}>
              4–12 letters or digits. Choose something your students can remember.
            </p>
            <button type="submit" className="btn-primary" disabled={loading || code.trim().length < 4}>
              {loading ? 'Creating...' : 'Create code'}
            </button>
          </form>
          {back}
        </div>
      </div>
    );
  }

  // Bir şagirdə "bugünkü məşqi bitir" xatırlatması. Nəticə düymənin öz
  // üstündə qalır: müəllim "göndərildi" ilə "artıq məşq edib" arasındakı fərqi
  // görməlidir, yoxsa eyni şagirdi təkrar-təkrar dürtər.
  const sendNudge = async (studentUid) => {
    if (nudged[studentUid] === 'sending') return;
    setNudged((m) => ({ ...m, [studentUid]: 'sending' }));
    const res = await nudgeStudent(studentUid);
    const reason = res.ok ? (res.data?.reason || 'sent') : null;
    setNudged((m) => ({
      ...m,
      [studentUid]: reason || res.errorText || 'Could not send',
    }));
  };

  // ─── 4. Dashboard: dəvət + roster ──────────────────────────────
  const link = buildJoinLink(myCode);
  const shareText = `My SpeakLab student code for English speaking practice: ${myCode}\n${link}`;
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
        <div className="home-logo">{'Teacher panel'}</div>
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
              {profileOpen ? 'Close' : 'Edit'}
            </button>
          </div>

          {profileMsg && !profileOpen && (
            <div style={{
              marginTop: '10px', fontSize: '13px',
              color: profileMsg.ok ? 'var(--success)' : 'var(--danger)',
            }}>
              {profileMsg.ok ? ' ' : ' '}{profileMsg.text}
            </div>
          )}

          {profileOpen && (
            <form onSubmit={saveProfile} style={{ marginTop: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Name shown on your profile
              </label>
              <input
                type="text"
                value={profile.displayName}
                onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
                maxLength={60}
                placeholder="Aytac Mammadova"
                style={fieldStyle}
              />

              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', margin: '14px 0 6px' }}>
                Specialities (up to 5)
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
                        border: on ? '1px solid var(--ai)' : '1px solid var(--border)',
                        background: on ? 'var(--ai-soft)' : 'var(--bg-card)',
                        color: on ? 'var(--ai)' : 'var(--text-secondary)',
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>

              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', margin: '14px 0 6px' }}>
                Experience (years)
              </label>
              <input
                type="number"
                min="0"
                max="60"
                value={profile.yearsExperience}
                onChange={(e) => setProfile((p) => ({ ...p, yearsExperience: e.target.value }))}
                style={{ ...fieldStyle, maxWidth: '140px' }}
              />

              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', margin: '14px 0 6px' }}>
                About you
              </label>
              <textarea
                value={profile.bio}
                onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                maxLength={400}
                rows={3}
                placeholder="What do you teach, and who do you work with?"
                style={{ ...fieldStyle, resize: 'vertical' }}
              />
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right', marginTop: '4px' }}>
                {profile.bio.length}/400
              </div>

              {profileMsg && (
                <div style={{
                  marginTop: '10px', fontSize: '13px', lineHeight: 1.5,
                  color: profileMsg.ok ? 'var(--success)' : 'var(--danger)',
                }}>
                  {profileMsg.ok ? ' ' : ' '}{profileMsg.text}
                </div>
              )}

              <button
                type="submit"
                disabled={savingProfile || !profile.displayName.trim()}
                style={{
                  width: '100%', marginTop: '14px', padding: '12px', borderRadius: '12px', border: 'none',
                  background: (savingProfile || !profile.displayName.trim())
                    ? 'var(--bg-card)'
                    : 'var(--accent)',
                  color: (savingProfile || !profile.displayName.trim()) ? 'var(--text-muted)' : '#fff',
                  fontSize: '14px', fontWeight: 800,
                  cursor: (savingProfile || !profile.displayName.trim()) ? 'default' : 'pointer',
                }}
              >
                {savingProfile ? '...' : (verifState === 'verified' ? 'Yadda saxla' : 'Submit for review')}
              </button>
            </form>
          )}
        </div>

        {/* Dəvət bölməsi */}
        <div style={{
          background: 'var(--accent-soft)',
          border: '1px solid var(--border)', borderRadius: '16px',
          padding: '18px', marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700 }}>{'Your invite code'}</span>
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
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700,
              }}
            >
              {copied === 'link' ? `✅ ${'Copied'}` : 'Copy link'}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1, padding: '10px', borderRadius: '12px',
                border: '1px solid var(--accent-ring)', color: 'var(--accent)',
                fontSize: '13px', fontWeight: 700,
                textDecoration: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              <MessageCircle size={16} strokeWidth={1.75} aria-hidden="true" /> WhatsApp
            </a>
          </div>
        </div>

        {/* Birbaşa dəvət — linkin çatmadığı hallar üçün */}
        <form onSubmit={sendInvite} style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '16px', marginBottom: '16px',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            ✉️ Invite a student directly
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.5 }}>
            Enter the email your student signed up with — the invitation appears on their screen.
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
                  : 'var(--accent)',
                color: (inviting || !inviteEmail.trim()) ? 'var(--text-muted)' : '#fff',
                fontSize: '14px', fontWeight: 800,
                cursor: (inviting || !inviteEmail.trim()) ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {inviting ? '...' : 'Invite'}
            </button>
          </div>
          {inviteMsg && (
            <div style={{
              marginTop: '10px', fontSize: '13px', lineHeight: 1.5,
              color: inviteMsg.ok ? 'var(--success)' : 'var(--danger)',
            }}>
              {inviteMsg.ok ? ' ' : ' '}{inviteMsg.text}
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
                👥 Pick from users
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px' }}>
                Invite straight from the list — no email needed
              </div>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '18px', flexShrink: 0 }}>
              {dirOpen ? '' : ''}
            </span>
          </button>

          {dirOpen && (
            <div style={{ marginTop: '12px' }}>
              <input
                type="text"
                value={dirSearch}
                onChange={(e) => setDirSearch(e.target.value)}
                placeholder="Search by name…"
                style={{ ...fieldStyle, marginBottom: '10px' }}
              />
              {directory === null ? (
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{'Loading...'}</div>
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
                            background: 'linear-gradient(135deg, var(--border), var(--accent-soft))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, color: 'var(--accent)', fontSize: '13px',
                          }}>
                            {(u.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {u.name || 'User'}
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              {u.level || 'Level not set'}
                            </div>
                          </div>
                          {isMine ? (
                            <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 700, flexShrink: 0 }}>
                              ✓ Your student
                            </span>
                          ) : otherTeacher ? (
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>
                              With another teacher
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
                                  : 'var(--accent)',
                                color: sent ? 'var(--text-secondary)' : '#fff',
                              }}
                            >
                              {inviting === u.id ? '...' : sent ? 'Sent' : 'Invite'}
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
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={16} strokeWidth={1.75} aria-hidden="true" /> Your class this week
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))',
              gap: '10px',
            }}>
              {[
                { label: 'Active students', value: `${activeThisWeek}/${students.length}` },
                { label: 'Class average', value: classAvg ?? '—' },
                { label: 'Analysed', value: scored.length },
              ].map((tile) => (
                <div key={tile.label} style={{
                  background: 'var(--bg-card)', borderRadius: '12px',
                  padding: '12px 8px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)' }}>{tile.value}</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px' }}>{tile.label}</div>
                </div>
              ))}
            </div>

            {topThemes.length > 0 ? (
              <>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: '16px 2px 8px' }}>
                  Most repeated error themes
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {topThemes.map((th, i) => (
                    <div key={th.title} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      background: 'var(--bg-card)', borderRadius: '10px', padding: '10px 12px',
                    }}>
                      <span style={{ fontSize: '13px', fontWeight: 900, color: 'var(--accent)', minWidth: '16px' }}>{i + 1}</span>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>
                        {th.title}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {th.count}×
                      </span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '10px 2px 0' }}>
                  Cover these in your next lesson and you address the whole class at once.
                </p>
              </>
            ) : (
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '14px 2px 0' }}>
                As your students speak, the errors your class repeats most will appear here.
              </p>
            )}
          </div>
        )}

        {/* Roster */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          margin: '4px 2px 8px',
        }}>
          <span style={{ fontSize: '15px', fontWeight: 800 }}>{'My students'}</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {roster === null ? '' : `${students.length} ${'people'}`}
          </span>
        </div>

        {roster === null ? (
          <div className="empty-state" style={{ padding: '30px 20px', textAlign: 'center' }}>
            <div className="empty-icon"></div>
            <p style={{ color: 'var(--text-secondary)' }}>{'Loading...'}</p>
          </div>
        ) : students.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px 20px', textAlign: 'center' }}>
            <div className="empty-icon"></div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>
              {'No students yet.'}
            </p>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
              {'Send the link above to your students — they appear here as soon as they join.'}
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
                  background: 'linear-gradient(135deg, var(--border), var(--accent-soft))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', fontWeight: 800, color: 'var(--accent)',
                }}>
                  {(s.displayName || '?').slice(0, 1).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.displayName || 'Student'}
                    {Number(s.streak) > 0 && (
                      <span style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: 800, marginLeft: '6px' }}>
                        🔥{s.streak}
                      </span>
                    )}
                  </div>
                  {/* Proqres sətri: consumeTrialMinutes hər ≥2 dəq zəngdən sonra
                      roster-ə denormalizə yazır (sessiya sayı + son aktivlik). */}
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {Number(s.completedSessions) > 0
                      ? `${s.completedSessions} ${'sessions'} · ${'last'}: ${fmtDate(s.lastActiveAt)}`
                      : `${'Joined'}: ${fmtDate(s.joinedAt)} · ${'no calls yet'}`}
                  </div>
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '4px 10px',
                  borderRadius: '99px', flexShrink: 0,
                  background: s.status === 'active' ? 'var(--success-bg)' : 'var(--warning-bg)',
                  color: s.status === 'active' ? 'var(--success-fg)' : 'var(--warning-fg)',
                }}>
                  {s.status === 'active' ? 'Active' : 'Inactive'}
                </span>
                {/* Chasing a student used to mean leaving the app for WhatsApp.
                    stopPropagation because the whole row navigates to their
                    detail page — without it, reminding someone opens their
                    profile at the same time. */}
                {(() => {
                  // The roster row already carries lastNudgedOn (the server
                  // stamps it), so the button knows its own state after a
                  // reload instead of offering to send a reminder that the
                  // server will only refuse.
                  const state = nudged[s.id]
                    || (s.lastNudgedOn === bakuDateStr() ? 'already-nudged' : null);
                  const label = state && NUDGE_RESULT_TEXT[state];
                  const done = !!state && state !== 'sending';
                  return (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); sendNudge(s.id); }}
                      onKeyDown={(e) => e.stopPropagation()}
                      disabled={done || state === 'sending'}
                      title={label || state || 'Remind this student to finish today’s practice'}
                      aria-label={`Remind ${s.displayName || 'this student'} to practise`}
                      style={{
                        flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '6px 10px', borderRadius: '99px', cursor: done ? 'default' : 'pointer',
                        border: `1px solid ${done ? 'var(--border)' : 'var(--accent-ring)'}`,
                        background: done ? 'transparent' : 'var(--accent-soft)',
                        color: done ? 'var(--text-muted)' : 'var(--accent)',
                        fontSize: '11px', fontWeight: 700, fontFamily: 'inherit',
                        maxWidth: '46%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}
                    >
                      {state === 'sending'
                        ? '…'
                        : done
                          ? <><Check size={12} strokeWidth={3} aria-hidden="true" /> {label || state}</>
                          : <><BellRing size={12} strokeWidth={2} aria-hidden="true" /> Remind</>}
                    </button>
                  );
                })()}
                <span style={{ color: 'var(--text-secondary)', fontSize: '18px', flexShrink: 0 }}>›</span>
              </div>
            ))}
          </div>
        )}

        <p style={{
          fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center',
          marginTop: '14px', lineHeight: 1.5,
        }}>
          {'Student progress and analysis reports arrive here next.'}
        </p>
      </div>
    </div>
  );
}
