import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GraduationCap, MessageCircle, BarChart3, BellRing, Check, Pencil } from 'lucide-react';
import { doc, getDoc, collection, getDocs, query, limit, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
// ui.css BEFORE any component that pulls in cohort.css (TeacherWeek,
// AddStudent) — the other order fails the CI build on CSS chunk order.
import '../components/ui/ui.css';
import {
  createInviteCode,
  buildJoinLink,
  inviteStudentByUid,
  nudgeStudent,
  NUDGE_RESULT_TEXT,
  updateTeacherProfile,
  TEACHER_SESSIONS_REQUIRED,
  TUTOR_SPECIALTIES,
} from '../utils/teacher';
import TutorBadge from '../components/TutorBadge';
import TeacherScheduler from '../components/TeacherScheduler';
import TeacherUpcoming from '../components/TeacherUpcoming';
import TeacherWeek from '../components/tutor/TeacherWeek';
import AddStudent from '../components/tutor/AddStudent';
import { isAdminUser } from '../constants';
import { bakuDateStr } from '../utils/sessionSchedule';
import { latestPracticeMs, timestampMs, weeklyPracticeMinutes, practiceWeekKey } from '../utils/practiceStats';
import { getPresence, lastSeenLabel } from '../utils/presence';
import { suggestTeacherCode } from '../utils/teacherCode';

// The dashboard used to be one long page of ten blocks (Polad 2026-10-23, item
// 7: "qarışıqlıq itsin"). Two tabs, each with one job: Today — a compact class
// summary, lessons this week, students, calls; Invite & profile — what is set
// up once. The Class tab became the summary card on Today (2026-11-10); an old
// `?tab=class` link simply lands on Today. `?tab=` keeps the choice.
const DASH_TABS = [
  { id: 'today', label: 'Today' },
  { id: 'setup', label: 'Invite & profile' },
];

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
  const [params, setParams] = useSearchParams();
  const dashTab = DASH_TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'today';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [myCode, setMyCode] = useState(null);
  const [checking, setChecking] = useState(true);
  const [copied, setCopied] = useState('');
  // null = hələ yüklənir; [] = yüklənib, boşdur. İkisini ayırmaq vacibdir —
  // əks halda boş roster əbədi "yüklənir" kimi görünərdi (Ranking dərsi).
  const [roster, setRoster] = useState(null);
  const [studentProfiles, setStudentProfiles] = useState({});
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [rosterError, setRosterError] = useState('');
  // Invites go by link, WhatsApp or "Pick from users" — the email form was
  // removed (Polad 2026-11-10). `inviting` = the uid being invited.
  const [inviting, setInviting] = useState(false);
  // The code is made from the teacher's name on first open (no "create a code"
  // step): 'idle' → 'working' → done, or 'failed' → the manual form below.
  const [autoCode, setAutoCode] = useState('idle');
  const [editingCode, setEditingCode] = useState(false);
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
      if (alive) setChecking(false);
    })();
    return () => { alive = false; };
  }, [user?.uid, eligible]);

  useEffect(() => {
    if (!user?.uid || !eligible) return undefined;
    const failed = () => setRosterError('Could not refresh student activity. Please reload to try again.');
    const stopRoster = onSnapshot(collection(db, 'teachers', user.uid, 'roster'), snap => {
      setRoster(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.status !== 'removed'));
    }, failed);
    const stopProfiles = onSnapshot(query(collection(db, 'users'), where('teacherId', '==', user.uid)), snap => {
      setStudentProfiles(Object.fromEntries(snap.docs.map(d => [d.id, d.data()])));
      setProfilesLoading(false);
    }, failed);
    return () => { stopRoster(); stopProfiles(); };
  }, [user?.uid, eligible]);

  // No code yet → make one from the name and go straight to the cabinet. A
  // taken code gets a new number (up to four tries); any other answer — not
  // eligible, rate limit, offline — falls back to the old manual form.
  useEffect(() => {
    if (checking || !eligible || myCode || autoCode !== 'idle') return undefined;
    let alive = true;
    setAutoCode('working');
    (async () => {
      const name = user?.name || user?.displayName || '';
      for (let i = 0; i < 4; i += 1) {
        const res = await createInviteCode(suggestTeacherCode(name));
        if (!alive) return;
        if (res.ok) { setMyCode(res.data.code); setRoster((r) => r || []); setAutoCode('done'); return; }
        if (res.error !== 'code-taken') break;
      }
      if (alive) setAutoCode('failed');
    })();
    return () => { alive = false; };
  }, [checking, eligible, myCode, autoCode, user?.name, user?.displayName]);

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
    setEditingCode(false);
    setCode('');
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
      ← Back
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
  if (checking || (!myCode && autoCode !== 'failed')) {
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
  const nowMs = Date.now();
  const students = (roster || []).map(s => {
    const p = studentProfiles[s.id] || {};
    // Presence is read from the PROFILE: the roster row has its own `status`
    // (active / inactive) and would hide the profile's online / busy.
    return {
      ...p, ...s,
      presence: getPresence(p, nowMs),
      seenMs: timestampMs(p.lastSeen),
      lastActiveAt: Math.max(timestampMs(s.lastActiveAt), timestampMs(p.lastPracticeAt), timestampMs(p.lastCallDate)),
    };
  })
    // Most recent practice first (Polad 2026-11-10 — replaces "online first"
    // from 2026-10-07: the teacher reads the list as "who worked lately");
    // never practised = newest joiner first. The green dot still marks who is
    // in the app right now.
    .sort((a, b) => (latestPracticeMs(b) - latestPracticeMs(a))
      || (timestampMs(b.joinedAt) - timestampMs(a.joinedAt)));
  // toLocaleDateString bəzi WebView-lərdə ay adını "M07" kimi verir —
  // ay adları əl ilə yazılıb.
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // What this student has actually done, in one line. Calls and graded
  // practice are counted separately because they are different things: a call
  // is time with a person, a report is a session AInur marked.
  const rosterStats = (s) => {
    const calls = Number(s.callCount ?? s.completedSessions) || 0;
    const reports = Number(s.scoreCount) || 0;
    const last = latestPracticeMs(s);
    if (!calls && !reports && !last) return { chips: [], when: `Joined ${fmtDate(s.joinedAt)} · nothing yet` };
    const week = weeklyPracticeMinutes(s);
    // This week first — it is what a reminder is about.
    const chips = [{ key: 'week', value: week, label: 'min this week', strong: week > 0 }];
    if (calls) chips.push({ key: 'calls', value: calls, label: calls === 1 ? 'call' : 'calls' });
    if (reports) chips.push({ key: 'reports', value: reports, label: reports === 1 ? 'report' : 'reports' });
    if (typeof s.lastScore === 'number' && Number.isFinite(s.lastScore)) chips.push({ key: 'score', value: Number(s.lastScore), label: '/100' });
    const when = [last && `Last practice ${fmtDate(last)}`, s.lastAnalysisAt && `report ${fmtDate(s.lastAnalysisAt)}`].filter(Boolean).join(' · ');
    return { chips, when };
  };

  const fmtDate = (ts) => {
    const ms = timestampMs(ts);
    if (!ms) return '—';
    const d = new Date(ms + 4 * 3600000);
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
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
  const weekAgo = Date.parse(`${practiceWeekKey()}T00:00:00+04:00`);
  const activeThisWeek = students.filter((s) => {
    const ms = latestPracticeMs(s);
    return ms >= weekAgo;
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

        <div className="ui-seg" role="tablist" aria-label="Teacher panel" style={{ marginBottom: 'var(--s-4)' }}>
          {DASH_TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={dashTab === t.id}
              className={`ui-seg-btn ${dashTab === t.id ? 'is-on' : ''}`}
              onClick={() => setParams(t.id === 'today' ? {} : { tab: t.id }, { replace: true })}>
              {t.label}
            </button>
          ))}
        </div>
        {rosterError && <p role="alert">{rosterError}</p>}

        {/* Class summary — what the old Class tab held, as one compact card at
            the top of Today (2026-11-10): who is active, the average, and the
            errors the class repeats. Hidden until someone has joined. */}
        {dashTab === 'today' && students.length > 0 && (
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '14px 16px', marginBottom: '16px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={16} strokeWidth={1.75} aria-hidden="true" /> Class summary
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '8px',
            }}>
              {[
                { label: 'Active this week', value: `${activeThisWeek}/${students.length}` },
                { label: 'Class average', value: classAvg ?? '—' },
                { label: 'With reports', value: scored.length },
              ].map((tile) => (
                <div key={tile.label} style={{
                  background: 'var(--bg-card)', borderRadius: '12px',
                  padding: '8px 6px', textAlign: 'center', minWidth: 0,
                }}>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>{tile.value}</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px' }}>{tile.label}</div>
                </div>
              ))}
            </div>

            {/* The class's most repeated error themes, one line of chips —
                cover them in the next lesson and the whole class is addressed. */}
            {topThemes.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginRight: '2px' }}>
                  Most repeated errors
                </span>
                {topThemes.map((th) => (
                  <span key={th.title} style={{
                    display: 'inline-flex', alignItems: 'baseline', gap: '4px',
                    padding: '3px 9px', borderRadius: '99px', background: 'var(--accent-soft)',
                    fontSize: '12px', fontWeight: 700, color: 'var(--accent)',
                  }}>
                    {th.title}
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{th.count}×</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Individual lessons from today to a week ahead, every student. */}
        {dashTab === 'today' && isAdminUser(user) && <AddStudent />}
        {dashTab === 'today' && <TeacherWeek uid={user?.uid} names={Object.fromEntries(students.map((s) => [s.id, s.name || s.displayName || 'Student']))} />}


        {/* Roster */}
        {dashTab === 'today' && (<>
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
              {'Send the invite link below to your students — they appear here as soon as they join.'}
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
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  padding: '14px 16px', cursor: 'pointer',
                  borderBottom: i < students.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{
                  position: 'relative',
                  width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--border), var(--accent-soft))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', fontWeight: 800, color: 'var(--accent)',
                }}>
                  {(s.displayName || '?').slice(0, 1).toUpperCase()}
                  {s.presence !== 'offline' && (
                    <span aria-hidden="true" style={{
                      position: 'absolute', right: '-1px', bottom: '-1px', width: '12px', height: '12px',
                      borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg-card)',
                    }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Name and status on one line, the numbers under it, the
                      reminder under those. One horizontal row left the text
                      ~20px once the button read "Already reminded today", so
                      it wrapped one word per line. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: '15px', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.displayName || 'Student'}
                      {Number(s.streak) > 0 && (
                        <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 800, marginLeft: '6px' }}>
                          {s.streak}-day streak
                        </span>
                      )}
                    </span>
                    <span style={{
                      fontSize: '11px', fontWeight: 800, padding: '3px 9px',
                      borderRadius: '99px', flexShrink: 0,
                      background: s.status === 'active' ? 'var(--success-bg)' : 'var(--warning-bg)',
                      color: s.status === 'active' ? 'var(--success-fg)' : 'var(--warning-fg)',
                    }}>
                      {s.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {/* Progress. completedSessions alone missed AInur practice;
                      scoreCount / lastAnalysisAt come from every analysis. */}
                  {(() => {
                    const r = rosterStats(s);
                    // The roster row carries lastNudgedOn (server-stamped), so
                    // after a reload the button already knows.
                    const state = nudged[s.id]
                      || (s.lastNudgedOn === bakuDateStr() ? 'already-nudged' : null);
                    const done = !!state && state !== 'sending';
                    // A short, quiet mark — the long "Already reminded today"
                    // piled up down the list as a wall of identical labels.
                    const short = { sent: 'Reminded', 'already-nudged': 'Reminded', 'already-practised': 'Practised today', 'no-devices': 'No device' }[state];
                    return (
                      <>
                        {r.chips.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                            {r.chips.map((c) => (
                              <span key={c.key} style={{
                                display: 'inline-flex', alignItems: 'baseline', gap: '4px',
                                padding: '3px 8px', borderRadius: '8px',
                                background: c.strong ? 'var(--accent-soft)' : 'var(--bg-secondary)',
                                fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)',
                              }}>
                                <b style={{ fontSize: '13px', fontWeight: 800, color: c.strong ? 'var(--accent)' : 'var(--text-primary)' }}>{c.value}</b>
                                {c.label}
                              </span>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                          <span style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                            <b style={{ fontWeight: 800, color: s.presence !== 'offline' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                              {s.presence === 'busy' ? 'In a call' : s.presence === 'online' ? 'Online'
                                : s.seenMs ? `Seen ${lastSeenLabel(s.seenMs, nowMs)}` : 'Not seen yet'}
                            </b>
                            {' · '}{r.when}
                          </span>
                          {/* stopPropagation: the whole row opens the student. */}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); sendNudge(s.id); }}
                            onKeyDown={(e) => e.stopPropagation()}
                            disabled={done || state === 'sending'}
                            title={(state && NUDGE_RESULT_TEXT[state]) || 'Remind this student to finish today’s practice'}
                            aria-label={`Remind ${s.displayName || 'this student'} to practise`}
                            style={{
                              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '5px',
                              padding: done ? '4px 6px' : '6px 12px', borderRadius: '99px',
                              cursor: done ? 'default' : 'pointer',
                              border: done ? '1px solid transparent' : '1px solid var(--accent-ring)',
                              background: done ? 'transparent' : 'var(--accent-soft)',
                              color: done ? 'var(--text-muted)' : 'var(--accent)',
                              fontSize: '12px', fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap',
                            }}
                          >
                            {state === 'sending'
                              ? '…'
                              : done
                                ? <><Check size={13} strokeWidth={3} aria-hidden="true" /> {short || state}</>
                                : <><BellRing size={13} strokeWidth={2} aria-hidden="true" /> Remind</>}
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '18px', flexShrink: 0 }}>›</span>
              </div>
            ))}
          </div>
        )}

        <p style={{
          fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center',
          marginTop: '14px', lineHeight: 1.5,
        }}>
          {'Tap a student to read their reports.'}
        </p>

        {/* Əl ilə zəng təyini — lövhə cütü təsadüfən qurur, müəllim isə
            konkret iki nəfəri seçir. İki şagirddən az olanda özü gizlənir. */}
        <TeacherUpcoming
          students={Object.entries(studentProfiles).map(([id, profile]) => ({ ...profile, id, displayName: profile.name }))}
          loading={profilesLoading}
          error={rosterError}
        />
        <TeacherScheduler students={students} />
        </>)}

        {/* Təyin ediləni geri almaq da təyin etmək qədər vacibdir: səhv cüt
            qurulanda teacherSetMatch onun üstünə yaza bilmir (hər ikisi boş
            olmalıdır), ona görə sökmək yolu olmasa müəllim ilişib qalır. */}


        {/* Invites and the tutor profile are set up once; the daily work
            (who practised, who to remind) lives on Today. Polad 2026-09-30. */}
        {dashTab === 'setup' && (<>
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
                🎓 Your tutor profile
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

        {/* The Video library card is gone from the panel (Polad 2026-11-10);
            /teacher/videos still opens for anyone who has the link. */}

        {/* Dəvət bölməsi */}
        <div style={{
          background: 'var(--accent-soft)',
          border: '1px solid var(--border)', borderRadius: '16px',
          padding: '18px', marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, flex: 1 }}>{'Your invite code'}</span>
            <span style={{
              fontSize: '22px', fontWeight: 900, letterSpacing: '2px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}>
              {myCode}
            </span>
            {/* The code was made from the name; this is where it is changed.
                The old code keeps working — links already sent do not die. */}
            <button type="button" aria-label="Change code"
              onClick={() => { setEditingCode((o) => !o); setCode(''); setError(''); }}
              style={{
                display: 'inline-flex', padding: '6px', borderRadius: '10px', cursor: 'pointer',
                border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)',
              }}>
              <Pencil size={15} aria-hidden="true" />
            </button>
          </div>
          {editingCode && (
            <form onSubmit={handleSubmit} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text" value={code} maxLength={12} placeholder="NEW CODE"
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                  aria-label="New invite code"
                  style={{ ...fieldStyle, flex: 1, fontWeight: 700, letterSpacing: '2px' }}
                />
                <button type="submit" disabled={loading || code.trim().length < 4}
                  style={{
                    padding: '0 16px', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: 800,
                    background: code.trim().length < 4 ? 'var(--bg-card)' : 'var(--accent)',
                    color: code.trim().length < 4 ? 'var(--text-muted)' : 'var(--text-on-accent)',
                    cursor: code.trim().length < 4 ? 'default' : 'pointer',
                  }}>
                  {loading ? '…' : 'Save'}
                </button>
              </div>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', margin: '6px 2px 0', lineHeight: 1.5 }}>
                4–12 letters or digits. Your current code keeps working.
              </p>
              {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--danger)', margin: '6px 2px 0' }}>{error}</p>}
            </form>
          )}
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
          {inviteMsg && (
            <p role="status" style={{
              margin: '10px 2px 0', fontSize: '13px', lineHeight: 1.5,
              color: inviteMsg.ok ? 'var(--text-secondary)' : 'var(--danger)',
            }}>
              {inviteMsg.text}
            </p>
          )}
        </div>
        </>)}
      </div>
    </div>
  );
}
