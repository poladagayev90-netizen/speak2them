import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  ArrowLeft, ArrowRight, Check, CalendarDays, CalendarCheck, Globe2, GraduationCap,
  MessagesSquare, Target, UserRound, Clock, Pencil, Handshake, Phone, MessageCircle, Bell,
} from 'lucide-react';
import { auth, db } from '../firebase';
import { Button } from '../components/ui';
import Logo from '../components/Logo';
import { deviceTimeZone } from '../utils/appLanguage';
import {
  WEEK_DAYS, cellsToRanges, rangesToCells, formatLocalNow, formatOffsetVsBaku,
  cityOf, totalHours, formatMinutes, offsetVsBaku,
} from '../utils/timezone';
import { usePopularTimes } from '../hooks/useMyPlan';
import { popularBlocks } from '../utils/myWeek';
import {
  ONBOARDING_VERSION, GOALS, LEVELS, AGE_BANDS, COUNTRIES, TOPICS, WEEKLY_TARGETS, labelOf,
  PHONE_CODES, dialCodeFor, normalizeWhatsApp,
} from '../utils/onboarding';
import { PROFILE_MODES, paintCell } from '../utils/weekProfile';
import { needsIntro } from '../utils/intro';
import useBackButton from '../hooks/useBackButton';
import { pushPermission, askPush } from '../utils/pushOptIn';
import TimeGrid, { PaintModes } from '../components/plan/TimeGrid';
import useFirstRunCopy from '../hooks/useFirstRunCopy';
import './Onboarding.css';

// One question per screen. The order is deliberate: the easy, identity
// questions first (goal, level, age, place) so that by the time the learner
// reaches the availability grid — the one that takes effort — they are
// already invested, and the grid can speak in their own clock.
//
// The charter comes right before the grid: how planned practice works is what
// gives "when are you free?" and "how many a week?" their weight. Learners who
// onboarded before it existed (version 1) are brought back straight to it.
// The WhatsApp number follows the charter (version 3): the team writes when a
// practice needs sorting out. Version-2 learners are asked only that step.
// The «what do you like to talk about» step was dropped (2026-10-14, Polad:
// not needed). Topics a learner already chose are kept and saved as they are.
// Notifications follow the number (2026-10-15): a practice is booked for a
// newcomer right after the wizard, and 9 of 14 newcomers had no way to hear
// about it. The step is passed over where nothing can be asked (already on,
// blocked, or a browser without push).
const STEPS = ['welcome', 'goal', 'level', 'age', 'place', 'charter', 'phone', 'notify', 'availability', 'target', 'summary'];
// Bump when the charter text changes in substance; accepting it again is then asked.
const CHARTER_VERSION = 1;

// Grid rows: whole hours 07:00–24:00 in the learner's own time.
const HOURS = Array.from({ length: 17 }, (_, i) => i + 7);

// Labels come from firstRunCopy (`preset.<id>`).
const PRESETS = [
  { id: 'weekday-evenings', days: [1, 2, 3, 4, 5], hours: [19, 20, 21] },
  { id: 'weekend-days', days: [6, 0], hours: [11, 12, 13, 14] },
  { id: 'late', days: [1, 2, 3, 4, 5, 6, 0], hours: [22, 23] },
];

const draftKey = (uid) => `slk_onboarding_draft_${uid}`;

// A stored "+905321234567" → the code in the list and the rest to show.
function splitWhatsApp(number) {
  const n = String(number || '');
  const hit = [...PHONE_CODES].sort((a, b) => b.code.length - a.code.length).find((c) => n.startsWith(`+${c.code}`));
  return hit ? { code: hit.code, rest: n.slice(hit.code.length + 1) } : { code: null, rest: n };
}

function readDraft(uid) {
  try {
    const raw = sessionStorage.getItem(draftKey(uid));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function allTimeZones() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') return Intl.supportedValuesOf('timeZone');
  } catch { /* old WebView */ }
  return COUNTRIES.map((c) => c.tz).filter(Boolean);
}

export default function Onboarding({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const uid = auth.currentUser?.uid || user?.uid;
  // The whole wizard speaks the learner's language (utils/firstRunLang.js) —
  // also when Plan opens one step of it to edit, so the two never disagree.
  // The VALUES saved stay English ('Speaking', 'Movies', 'B1 – Intermediate').
  const { lang, t } = useFirstRunCopy(user?.guideLanguage);
  const levelShort = (v) => LEVELS.find((l) => l.value === v)?.short;
  const levelName = (v) => (levelShort(v) ? `${levelShort(v)} – ${t(`level.${levelShort(v)}`)}` : v || '—');
  const goalLabel = (v) => (v ? t(`goal.${v}`) : '—');
  const ageLabel = (v) => (!v ? '—' : v === 'under18' || v === '35+' ? t(`age.${v}`) : labelOf(AGE_BANDS, v));
  const modes = PROFILE_MODES.map((m) => ({ ...m, label: t(`mode.${m.id}`), hint: t(`mode.${m.id}.hint`) }));

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tzPicker, setTzPicker] = useState(false);

  const [goal, setGoal] = useState('');
  const [level, setLevel] = useState('');
  const [ageBand, setAgeBand] = useState('');
  const [country, setCountry] = useState('');
  const [timeZone, setTimeZone] = useState(deviceTimeZone() || 'Asia/Baku');
  // The six busiest 2-hour blocks (appConfig/popularTimes), in this learner's
  // own clock: marked on the grid so a newcomer picks times others share.
  const popularTimes = usePopularTimes();
  const popularCells = useMemo(() => {
    const out = new Set();
    for (const b of popularBlocks(popularTimes, offsetVsBaku(timeZone)).slice(0, 6)) {
      const h = Math.floor(b.startMin / 60);
      out.add(`${b.day}-${h}`); out.add(`${b.day}-${h + 1}`);
    }
    return out;
  }, [popularTimes, timeZone]);
  const [cells, setCells] = useState(() => new Set());
  // The general week profile: «Maybe» and «Never» hours beside the free ones,
  // one state per cell (utils/weekProfile.js). `mode` = what a tap paints.
  const [maybeCells, setMaybeCells] = useState(() => new Set());
  const [neverCells, setNeverCells] = useState(() => new Set());
  const [mode, setMode] = useState('free');
  // Set once the three-kind grid has been on screen: saving then stamps
  // weekProfileAt, which retires Today's «Tell us your usual week» card.
  const [profileSeen, setProfileSeen] = useState(false);
  const [phoneCode, setPhoneCode] = useState('994');
  const [phoneRaw, setPhoneRaw] = useState('');
  const [weeklyTarget, setWeeklyTarget] = useState(0);
  const [topics, setTopics] = useState([]);
  const [charterAccepted, setCharterAccepted] = useState(false);
  // Plan → "Edit my free times" / "weekly target" on a finished onboarding.
  // Polad (2026-10-01): changing one answer walked the learner through three
  // more screens before anything saved, which read as "enter it all again".
  // In edit mode the step you came to edit saves on its own.
  const [editing, setEditing] = useState(false);
  // 'default' = can be asked; anything else (or not known yet) skips the step.
  const [push, setPush] = useState(null);
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    pushPermission().then((p) => { if (alive) setPush(p); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  // The answer given on the step itself keeps it on screen (with Continue).
  const [pushAnswered, setPushAnswered] = useState(false);

  // Load: a draft in this tab wins (the learner may have gone to the placement
  // test and come back); otherwise start from whatever they answered before.
  useEffect(() => {
    if (!uid) return undefined;
    let alive = true;
    (async () => {
      const draft = readDraft(uid);
      let userDoc = {};
      let prev = null;
      try {
        const [u, o] = await Promise.all([
          getDoc(doc(db, 'users', uid)),
          getDoc(doc(db, 'onboarding', uid)),
        ]);
        userDoc = u.exists() ? u.data() : {};
        prev = o.exists() ? o.data() : null;
      } catch { /* offline — the wizard still works from defaults */ }
      if (!alive) return;

      const src = draft || prev || {};
      setGoal(src.goal || userDoc.goal || '');
      setLevel(location.state?.placementLevel || src.level || userDoc.level || '');
      setAgeBand(src.ageBand || '');
      setCountry(src.country || '');
      if (src.timeZone) setTimeZone(src.timeZone);
      setCells(draft ? new Set(draft.cells || []) : rangesToCells(prev?.availability));
      setMaybeCells(draft ? new Set(draft.maybeCells || []) : rangesToCells(prev?.maybeAvailability));
      setNeverCells(draft ? new Set(draft.neverCells || []) : rangesToCells(prev?.busyAvailability));
      if (draft && draft.phoneRaw != null) {
        setPhoneCode(draft.phoneCode || '994');
        setPhoneRaw(draft.phoneRaw);
      } else if (prev?.whatsapp) {
        const { code, rest } = splitWhatsApp(prev.whatsapp);
        setPhoneCode(code || dialCodeFor(src.country));
        setPhoneRaw(rest);
      } else {
        setPhoneCode(dialCodeFor(src.country));
      }
      setWeeklyTarget(src.weeklyTarget || 0);
      setTopics(src.topics || (Array.isArray(userDoc.topics) ? userDoc.topics.filter((t) => TOPICS.includes(t)) : []));
      // Where to open: a deliberate jump (Plan → "Edit my free times") wins,
      // then a draft in this tab, then — for someone who onboarded before the
      // charter existed — the charter itself, with every answer still filled
      // in; someone who only lacks the WhatsApp number gets just that step.
      const jump = STEPS.indexOf(location.state?.jumpTo);
      const prevVersion = Number(prev?.version) || 0;
      const accepted = !!prev?.charterAcceptedAt && Number(prev?.charterVersion) >= CHARTER_VERSION;
      // A finished profile (version 2+) edits one step and saves; a missing
      // number is caught at saving (submit sends them to the phone step).
      let edit = jump >= 0 && accepted && prevVersion >= 2;
      if (jump >= 0) setStep(jump);
      else if (draft && Number.isInteger(draft.step)) setStep(Math.min(draft.step, STEPS.length - 1));
      else if (prev && prevVersion < ONBOARDING_VERSION) {
        if (accepted && prevVersion >= 2) { setStep(STEPS.indexOf('phone')); edit = true; }
        else setStep(STEPS.indexOf('charter'));
      }
      setCharterAccepted(accepted);
      setEditing(edit);
      setLoading(false);
    })();
    return () => { alive = false; };
    // Load once per mount. placementLevel is read here on purpose and not as a
    // dependency: it only matters on the return from /placement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Persist the draft so a trip to /placement, a reload, or the app being
  // backgrounded on Android never costs the learner their answers.
  useEffect(() => {
    if (loading || !uid) return;
    try {
      sessionStorage.setItem(draftKey(uid), JSON.stringify({
        step, goal, level, ageBand, country, timeZone, cells: [...cells], weeklyTarget, topics,
        maybeCells: [...maybeCells], neverCells: [...neverCells], phoneCode, phoneRaw,
      }));
    } catch { /* private mode */ }
  }, [loading, uid, step, goal, level, ageBand, country, timeZone, cells, weeklyTarget, topics, maybeCells, neverCells, phoneCode, phoneRaw]);

  const ranges = useMemo(() => cellsToRanges(cells), [cells]);
  const maybeRanges = useMemo(() => cellsToRanges(maybeCells), [maybeCells]);
  const neverRanges = useMemo(() => cellsToRanges(neverCells), [neverCells]);
  const dayCount = useMemo(() => new Set(ranges.map((r) => r.day)).size, [ranges]);
  const whatsapp = normalizeWhatsApp(phoneRaw, phoneCode);

  // A target larger than the number of days you are free cannot be kept, so
  // it cannot be chosen. This is the "picked five days, came on none" problem
  // stopped at the source: availability and commitment are separate answers.
  useEffect(() => {
    if (weeklyTarget > dayCount) setWeeklyTarget(0);
  }, [dayCount, weeklyTarget]);

  const id = STEPS[step];
  useEffect(() => { if (id === 'availability') setProfileSeen(true); }, [id]);
  const canNext = {
    welcome: true,
    goal: !!goal,
    level: !!level,
    age: !!ageBand,
    place: !!country && !!timeZone,
    charter: true,
    phone: !!whatsapp,
    notify: true,
    availability: cells.size > 0,
    target: weeklyTarget > 0,
    summary: true,
  }[id];

  const go = (delta) => {
    setDir(delta);
    setError('');
    setTzPicker(false);
    setStep((s) => {
      let next = Math.max(0, Math.min(STEPS.length - 1, s + delta));
      if (STEPS[next] === 'notify' && push !== 'default' && !pushAnswered) next += delta;
      return Math.max(0, Math.min(STEPS.length - 1, next));
    });
    window.scrollTo(0, 0);
  };

  const turnOnPush = async () => {
    if (pushBusy || !uid) return;
    setPushBusy(true);
    const status = await askPush(uid);
    setPushBusy(false);
    setPushAnswered(true);
    setPush(status);
    if (status === 'granted') go(1);
  };
  const jumpTo = (name) => { setDir(-1); setStep(STEPS.indexOf(name)); window.scrollTo(0, 0); };

  // Polad (2026-10-18): opening the wizard to change one answer and pressing
  // back landed on the step before it (6/11) — he only came to change the
  // number. Someone who came here to edit one answer leaves the way they came,
  // unsaved changes dropped; a pencil on the review returns to the review.
  const [fromReview, setFromReview] = useState(false);
  const cameToEdit = editing && STEPS.includes(location.state?.jumpTo);
  const leave = () => {
    try { sessionStorage.removeItem(draftKey(uid)); } catch { /* ignore */ }
    if (location.state?.returnTo) navigate(location.state.returnTo, { replace: true });
    else navigate(-1);
  };
  const editFromReview = (name) => { setFromReview(true); jumpTo(name); };
  const backToReview = () => { setFromReview(false); jumpTo('summary'); };
  const canBack = step > 0 || cameToEdit;
  const back = () => {
    if (fromReview && id !== 'summary') backToReview();
    else if (cameToEdit) leave();
    else go(-1);
  };
  // Android back does the same as the arrow; on the first step it falls
  // through to the app's own handling.
  useBackButton(() => {
    if (!canBack) return false;
    back();
    return true;
  });

  // A tap paints the chosen kind (or clears a cell already of that kind).
  const toggleCell = (key) => {
    const next = paintCell({ free: cells, maybe: maybeCells, never: neverCells }, key, mode);
    setCells(next.free); setMaybeCells(next.maybe); setNeverCells(next.never);
  };

  // Presets are free times; a preset hour stops being maybe/never.
  const applyPreset = (p) => {
    const keys = p.days.flatMap((d) => p.hours.map((h) => `${d}-${h}`));
    const allOn = keys.every((k) => cells.has(k));
    const next = new Set(cells);
    keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
    setCells(next);
    if (!allOn) {
      setMaybeCells((prev) => new Set([...prev].filter((k) => !keys.includes(k))));
      setNeverCells((prev) => new Set([...prev].filter((k) => !keys.includes(k))));
    }
  };

  const pickCountry = (c) => {
    setCountry(c.value);
    if (c.tz) setTimeZone(c.tz);
    // The WhatsApp code follows the country until a number has been typed.
    if (!phoneRaw.trim()) setPhoneCode(dialCodeFor(c.value));
  };

  const submit = async () => {
    if (!uid) { navigate('/login'); return; }
    // The number is required (version 3). Someone who came in through
    // another step's edit link and has none yet is sent to that step.
    if (!whatsapp) { jumpTo('phone'); setError(t('ob.phone.required')); return; }
    setSaving(true);
    setError('');
    try {
      const ref = doc(db, 'onboarding', uid);
      const existing = await getDoc(ref);
      const payload = {
        uid,
        goal,
        level,
        ageBand,
        country,
        timeZone,
        availability: ranges,
        maybeAvailability: maybeRanges,
        busyAvailability: neverRanges,
        ...(profileSeen ? { weekProfileAt: serverTimestamp() } : {}),
        whatsapp,
        weeklyTarget,
        topics,
        version: ONBOARDING_VERSION,
        // Passing the charter screen is the acceptance. Written once per
        // charter version; the planner can be limited to those who accepted.
        ...(charterAccepted ? {} : { charterVersion: CHARTER_VERSION, charterAcceptedAt: serverTimestamp() }),
        updatedAt: serverTimestamp(),
        ...(existing.exists() ? {} : { submittedAt: serverTimestamp() }),
      };
      await setDoc(ref, payload, { merge: true });
      // The user doc keeps only what matching already reads. Writing
      // onboardingVersion is what lifts the App.js gate, so it goes LAST: if
      // the availability write above failed, the learner is asked again.
      await setDoc(doc(db, 'users', uid), {
        goal,
        level,
        topics,
        surveyDone: true,
        surveySkipped: false,
        surveyUpdatedAt: serverTimestamp(),
        onboardingVersion: ONBOARDING_VERSION,
        onboardedAt: serverTimestamp(),
      }, { merge: true });
      try { sessionStorage.removeItem(draftKey(uid)); } catch { /* ignore */ }
      // Joining ends with a pointer to the team's WhatsApp — the same
      // full-screen layer, so it reads as the last step, not as an ad. It is
      // not a gate: "Continue to the app" is right there. Learners who are
      // exempt (already practising, have a teacher) go straight home.
      navigate(location.state?.returnTo || (needsIntro(user) ? '/intro' : '/'), { replace: true });
    } catch (e) {
      setError(t('ob.errSave'));
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="ob-page"><div className="ob-loading" aria-busy="true" /></div>;
  }

  const progress = step / (STEPS.length - 1);

  return (
    <div className="ob-page" lang={lang}>
      <header className="ob-top">
        <button
          type="button"
          className="ob-back"
          onClick={back}
          disabled={!canBack}
          aria-label={t('ob.back')}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="ob-progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
          <span style={{ transform: `scaleX(${Math.max(progress, 0.04)})` }} />
        </div>
        <span className="ob-count">{step + 1}/{STEPS.length}</span>
      </header>

      <main key={id} className={`ob-slide ${dir > 0 ? 'ob-slide--fwd' : 'ob-slide--back'}`}>
        {id === 'welcome' && (
          <div className="ob-welcome">
            <Logo width={170} />
            <h1 className="ob-title">{t('ob.welcome.title')}</h1>
            <p className="ob-sub">{t('ob.welcome.sub')}</p>
            <ul className="ob-points">
              <li><MessagesSquare size={18} /> {t('ob.welcome.p1')}</li>
              <li><CalendarDays size={18} /> {t('ob.welcome.p2')}</li>
              <li><GraduationCap size={18} /> {t('ob.welcome.p3')}</li>
            </ul>
            <p className="ob-note">{t('ob.welcome.note')}</p>
          </div>
        )}

        {id === 'goal' && (
          <Question icon={<Target size={20} />} title={t('ob.goal.title')} sub={t('ob.goal.sub')}>
            <div className="ob-options">
              {GOALS.map((g) => (
                <Option key={g.value} active={goal === g.value} onClick={() => setGoal(g.value)} label={t(`goal.${g.value}`)} hint={t(`goal.${g.value}.hint`)} />
              ))}
            </div>
          </Question>
        )}

        {id === 'level' && (
          <Question icon={<GraduationCap size={20} />} title={t('ob.level.title')} sub={t('ob.level.sub')}>
            <div className="ob-options">
              {LEVELS.map((l) => (
                <Option
                  key={l.value}
                  active={level === l.value}
                  onClick={() => setLevel(l.value)}
                  label={<><b className="ob-tag">{l.short}</b>{t(`level.${l.short}`)}</>}
                  hint={t(`level.${l.short}.hint`)}
                />
              ))}
            </div>
            <button type="button" className="ob-link" onClick={() => navigate('/placement')}>
              {t('ob.level.test')}
            </button>
          </Question>
        )}

        {id === 'age' && (
          <Question icon={<UserRound size={20} />} title={t('ob.age.title')} sub={t('ob.age.sub')}>
            <div className="ob-grid2">
              {AGE_BANDS.map((a) => (
                <Option key={a.value} active={ageBand === a.value} onClick={() => setAgeBand(a.value)} label={ageLabel(a.value)} center />
              ))}
            </div>
          </Question>
        )}

        {id === 'place' && (
          <Question icon={<Globe2 size={20} />} title={t('ob.place.title')} sub={t('ob.place.sub')}>
            <div className="ob-chips">
              {COUNTRIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`ob-chip ${country === c.value ? 'is-on' : ''}`}
                  onClick={() => pickCountry(c)}
                  aria-pressed={country === c.value}
                >
                  {t(`country.${c.value}`)}
                </button>
              ))}
            </div>
            <div className="ob-tz">
              <Clock size={18} />
              <div className="ob-tz-text">
                <span className="ob-tz-now">{t('ob.place.now')} <b>{formatLocalNow(timeZone)}</b></span>
                <span className="ob-tz-zone">{cityOf(timeZone)} · {formatOffsetVsBaku(timeZone)}</span>
              </div>
              <button type="button" className="ob-link ob-link--sm" onClick={() => setTzPicker((v) => !v)}>
                {tzPicker ? t('ob.place.done') : t('ob.place.change')}
              </button>
            </div>
            {tzPicker && (
              <select className="ob-select" value={timeZone} onChange={(e) => setTimeZone(e.target.value)} aria-label="Time zone">
                {allTimeZones().map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
              </select>
            )}
            <p className="ob-note">{t('ob.place.note')}</p>
          </Question>
        )}

        {id === 'charter' && (
          <Question icon={<Handshake size={20} />} title={t('ob.charter.title')} sub={t('ob.charter.sub')}>
            <ul className="ob-points ob-charter">
              <li><CalendarDays size={18} /> <span>{t('ob.charter.c1')}</span></li>
              <li><CalendarCheck size={18} /> <span>{t('ob.charter.c2')}</span></li>
              <li><Clock size={18} /> <span>{t('ob.charter.c3')}</span></li>
              <li><Phone size={18} /> <span>{t('ob.charter.c4')}</span></li>
            </ul>
          </Question>
        )}

        {id === 'phone' && (
          <Question
            icon={<MessageCircle size={20} />}
            title={t('ob.phone.title')}
            sub={t('ob.phone.sub')}
          >
            <div className="ob-phone">
              <select className="ob-select ob-phone-code" value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} aria-label="Country code">
                {PHONE_CODES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
              <input
                className="ob-select ob-phone-num"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="50 123 45 67"
                value={phoneRaw}
                onChange={(e) => { setPhoneRaw(e.target.value); setError(''); }}
                aria-label="WhatsApp number"
                aria-invalid={phoneRaw.trim() !== '' && !whatsapp}
              />
            </div>
            <p className="ob-summary-line">
              {whatsapp ? t('ob.phone.ok', { n: whatsapp }) : phoneRaw.trim() ? t('ob.phone.short') : t('ob.phone.hint')}
            </p>
            {error && <p className="ob-error" role="alert">{error}</p>}
          </Question>
        )}

        {id === 'notify' && (
          <Question
            icon={<Bell size={20} />}
            title={t('ob.notify.title')}
            sub={t('ob.notify.sub')}
          >
            {push === 'granted' && <p className="ob-summary-line">{t('ob.notify.done')}</p>}
            {pushAnswered && push === 'denied' && <p className="ob-summary-line">{t('ob.notify.blocked')}</p>}
          </Question>
        )}

        {id === 'availability' && (
          <Question
            icon={<CalendarDays size={20} />}
            title={t('ob.avail.title')}
            sub={t('ob.avail.sub', { city: cityOf(timeZone) })}
          >
            {/* Learners read Maybe / Never as two more things they had to fill
                in. The switch itself says it: Free «is enough», the other two
                «optional». What Maybe / Never mean shows only while one of them
                is picked — a longer explanation up front went unread. */}
            <PaintModes modes={modes} value={mode} onChange={setMode} />
            {mode !== 'free' && (
              <p className="ob-marking" aria-live="polite">
                <span>{t(mode === 'maybe' ? 'ob.avail.howMaybe' : 'ob.avail.howNever')}</span>
                <button type="button" className="ob-link ob-link--inline" onClick={() => setMode('free')}>
                  {t('ob.avail.backFree')}
                </button>
              </p>
            )}
            <div className="ob-presets">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" className="ob-chip ob-chip--sm" onClick={() => applyPreset(p)}>{t(`preset.${p.id}`)}</button>
              ))}
              {(cells.size > 0 || maybeCells.size > 0 || neverCells.size > 0) && (
                <button type="button" className="ob-chip ob-chip--sm ob-chip--ghost"
                  onClick={() => { setCells(new Set()); setMaybeCells(new Set()); setNeverCells(new Set()); }}>{t('ob.avail.clear')}</button>
              )}
            </div>
            <TimeGrid
              ariaLabel="Weekly availability"
              columns={WEEK_DAYS.map((d) => ({ key: d.day, label: t(`day.${d.day}`) }))}
              hours={HOURS}
              cell={(day, h) => {
                const key = `${day}-${h}`;
                const popular = popularCells.has(key);
                const kind = cells.has(key) ? 'free' : maybeCells.has(key) ? 'maybe' : neverCells.has(key) ? 'never' : null;
                return {
                  on: kind === 'free', maybe: kind === 'maybe', never: kind === 'never', popular,
                  label: `${t(`day.${day}`)} ${formatMinutes(h * 60)}${kind ? `, ${kind}` : ''}${popular ? ', popular' : ''}`,
                };
              }}
              onToggle={(day, h) => toggleCell(`${day}-${h}`)}
            />
            {popularCells.size > 0 && (
              <p className="ob-legend"><span className="ob-legend-dot" aria-hidden="true" /> {t('ob.avail.popular')}</p>
            )}
            {editing && (
              <p className="ob-note">{t('ob.avail.editing')}</p>
            )}
            <p className="ob-summary-line">
              {cells.size === 0
                ? t('ob.avail.none')
                : t(`ob.avail.summary.${dayCount === 1 ? 'one' : 'other'}`, { h: totalHours(ranges), d: dayCount })
                  + (maybeCells.size ? ` · ${t('ob.avail.maybe', { n: maybeCells.size })}` : '')
                  + (neverCells.size ? ` · ${t('ob.avail.never', { n: neverCells.size })}` : '')}
            </p>
          </Question>
        )}

        {id === 'target' && (
          <Question icon={<Target size={20} />} title={t('ob.target.title')} sub={t('ob.target.sub')}>
            <div className="ob-grid4">
              {WEEKLY_TARGETS.map((o) => {
                const disabled = o.value > dayCount;
                return (
                  <button
                    key={o.value}
                    type="button"
                    className={`ob-target ${weeklyTarget === o.value ? 'is-on' : ''}`}
                    onClick={() => setWeeklyTarget(o.value)}
                    disabled={disabled}
                    aria-pressed={weeklyTarget === o.value}
                  >
                    <b>{o.label}</b>
                    <span>{t(`target.${o.value}`)}</span>
                  </button>
                );
              })}
            </div>
            {dayCount < 4 && (
              <p className="ob-note">
                {t(`ob.target.limit.${dayCount === 1 ? 'one' : 'other'}`, { d: dayCount })}{' '}
                <button type="button" className="ob-link ob-link--inline" onClick={() => jumpTo('availability')}>{t('ob.target.addMore')}</button>
              </p>
            )}
          </Question>
        )}


        {id === 'summary' && (
          <Question icon={<Check size={20} />} title={t('ob.summary.title')} sub={t('ob.summary.sub')}>
            <dl className="ob-review">
              <Row editLabel={t('ob.edit')} label={t('row.goal')} value={goalLabel(goal)} onEdit={() => editFromReview('goal')} />
              <Row editLabel={t('ob.edit')} label={t('row.level')} value={levelName(level)} onEdit={() => editFromReview('level')} />
              <Row editLabel={t('ob.edit')} label={t('row.age')} value={ageLabel(ageBand)} onEdit={() => editFromReview('age')} />
              <Row editLabel={t('ob.edit')} label={t('row.location')} value={`${country ? t(`country.${country}`) : '—'} · ${cityOf(timeZone)}`} onEdit={() => editFromReview('place')} />
              <Row editLabel={t('ob.edit')} label={t('row.whatsapp')} value={whatsapp || '—'} onEdit={() => editFromReview('phone')} />
              <Row
                editLabel={t('ob.edit')}
                label={t('row.free')}
                value={(
                  <span className="ob-review-ranges">
                    {WEEK_DAYS.map((d) => {
                      const rs = ranges.filter((r) => r.day === d.day);
                      if (!rs.length) return null;
                      return (
                        <span key={d.day}>
                          <b>{t(`day.${d.day}`)}</b> {rs.map((r) => `${formatMinutes(r.startMin)}–${formatMinutes(r.endMin)}`).join(', ')}
                        </span>
                      );
                    })}
                    {maybeCells.size > 0 && <span className="ob-review-extra">{t('row.maybe', { n: maybeCells.size })}</span>}
                    {neverCells.size > 0 && <span className="ob-review-extra">{t('row.never', { n: neverCells.size })}</span>}
                  </span>
                )}
                onEdit={() => editFromReview('availability')}
              />
              <Row editLabel={t('ob.edit')} label={t('row.perWeek')} value={t('row.perWeekValue', { n: labelOf(WEEKLY_TARGETS, weeklyTarget) })} onEdit={() => editFromReview('target')} />
            </dl>
            {error && <p className="ob-error" role="alert">{error}</p>}
          </Question>
        )}
      </main>

      <footer className="ob-foot">
        {editing && (id === 'availability' || id === 'target' || id === 'phone') ? (
          // Fewer free days than the old target resets the target (the rule
          // above), so that one case goes through the target step first.
          id === 'availability' && weeklyTarget === 0 ? (
            <Button size="lg" full onClick={() => go(1)} disabled={!canNext} iconRight={<ArrowRight size={20} />}>
              {t('ob.continueTarget')}
            </Button>
          ) : (
            <>
              <Button size="lg" full onClick={submit} disabled={saving || !canNext} icon={<Check size={20} />}>
                {saving ? t('ob.saving') : t('ob.save')}
              </Button>
              <button type="button" className="ob-link ob-link--sm" onClick={() => { setEditing(false); jumpTo('summary'); }}>
                {t('ob.reviewAll')}
              </button>
            </>
          )
        ) : fromReview && id !== 'summary' ? (
          // A pencil on the review edits that one answer and goes back to the
          // review — not on through every later step. Fewer free days than the
          // target resets it, so that case passes the target step first.
          <Button
            size="lg"
            full
            onClick={() => (id === 'availability' && weeklyTarget === 0 ? go(1) : backToReview())}
            disabled={!canNext}
            iconRight={<ArrowRight size={20} />}
          >
            {t('ob.continue')}
          </Button>
        ) : id === 'notify' && push === 'default' ? (
          <>
            <Button size="lg" full onClick={turnOnPush} disabled={pushBusy} icon={<Bell size={20} />}>
              {t('ob.notify.on')}
            </Button>
            <button type="button" className="ob-link ob-link--sm" onClick={() => { setPushAnswered(true); go(1); }}>
              {t('ob.notify.later')}
            </button>
          </>
        ) : id === 'summary' ? (
          <Button size="lg" full onClick={submit} disabled={saving} icon={<Check size={20} />}>
            {saving ? t('ob.saving') : t('ob.confirm')}
          </Button>
        ) : (
          <Button size="lg" full onClick={() => go(1)} disabled={!canNext} iconRight={<ArrowRight size={20} />}>
            {id === 'welcome' ? t('ob.getStarted') : id === 'charter' ? t('ob.imIn') : t('ob.continue')}
          </Button>
        )}
      </footer>
    </div>
  );
}

function Question({ icon, title, sub, children }) {
  return (
    <section className="ob-q">
      <span className="ob-q-icon" aria-hidden="true">{icon}</span>
      <h1 className="ob-title">{title}</h1>
      {sub && <p className="ob-sub">{sub}</p>}
      <div className="ob-q-body">{children}</div>
    </section>
  );
}

function Option({ active, onClick, label, hint, center = false }) {
  return (
    <button
      type="button"
      className={`ob-option ${active ? 'is-on' : ''} ${center ? 'ob-option--center' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className="ob-option-text">
        <span className="ob-option-label">{label}</span>
        {hint && <span className="ob-option-hint">{hint}</span>}
      </span>
      {!center && <span className="ob-radio" aria-hidden="true">{active && <Check size={14} />}</span>}
    </button>
  );
}

function Row({ label, value, onEdit, editLabel = 'Edit' }) {
  return (
    <div className="ob-review-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
      <button type="button" className="ob-edit" onClick={onEdit} aria-label={`${editLabel} ${label}`}>
        <Pencil size={16} />
      </button>
    </div>
  );
}
