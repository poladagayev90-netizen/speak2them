import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  ArrowLeft, ArrowRight, Check, CalendarDays, Globe2, GraduationCap,
  MessagesSquare, Target, UserRound, Clock, Pencil,
} from 'lucide-react';
import { auth, db } from '../firebase';
import { Button } from '../components/ui';
import Logo from '../components/Logo';
import { deviceTimeZone } from '../utils/appLanguage';
import {
  WEEK_DAYS, cellsToRanges, rangesToCells, formatLocalNow, formatOffsetVsBaku,
  cityOf, totalHours, formatMinutes,
} from '../utils/timezone';
import {
  ONBOARDING_VERSION, GOALS, LEVELS, AGE_BANDS, COUNTRIES, TOPICS, WEEKLY_TARGETS, labelOf,
} from '../utils/onboarding';
import './Onboarding.css';

// One question per screen. The order is deliberate: the easy, identity
// questions first (goal, level, age, place) so that by the time the learner
// reaches the availability grid — the one that takes effort — they are
// already invested, and the grid can speak in their own clock.
const STEPS = ['welcome', 'goal', 'level', 'age', 'place', 'availability', 'target', 'topics', 'summary'];

// Grid rows: whole hours 07:00–24:00 in the learner's own time.
const HOURS = Array.from({ length: 17 }, (_, i) => i + 7);

const PRESETS = [
  { id: 'weekday-evenings', label: 'Weekday evenings', days: [1, 2, 3, 4, 5], hours: [19, 20, 21] },
  { id: 'weekend-days', label: 'Weekend daytime', days: [6, 0], hours: [11, 12, 13, 14] },
  { id: 'late', label: 'Late evenings', days: [1, 2, 3, 4, 5, 6, 0], hours: [22, 23] },
];

const draftKey = (uid) => `slk_onboarding_draft_${uid}`;

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
  const [cells, setCells] = useState(() => new Set());
  const [weeklyTarget, setWeeklyTarget] = useState(0);
  const [topics, setTopics] = useState([]);

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
      setWeeklyTarget(src.weeklyTarget || 0);
      setTopics(src.topics || (Array.isArray(userDoc.topics) ? userDoc.topics.filter((t) => TOPICS.includes(t)) : []));
      if (draft && Number.isInteger(draft.step)) setStep(Math.min(draft.step, STEPS.length - 1));
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
      }));
    } catch { /* private mode */ }
  }, [loading, uid, step, goal, level, ageBand, country, timeZone, cells, weeklyTarget, topics]);

  const ranges = useMemo(() => cellsToRanges(cells), [cells]);
  const dayCount = useMemo(() => new Set(ranges.map((r) => r.day)).size, [ranges]);

  // A target larger than the number of days you are free cannot be kept, so
  // it cannot be chosen. This is the "picked five days, came on none" problem
  // stopped at the source: availability and commitment are separate answers.
  useEffect(() => {
    if (weeklyTarget > dayCount) setWeeklyTarget(0);
  }, [dayCount, weeklyTarget]);

  const id = STEPS[step];
  const canNext = {
    welcome: true,
    goal: !!goal,
    level: !!level,
    age: !!ageBand,
    place: !!country && !!timeZone,
    availability: cells.size > 0,
    target: weeklyTarget > 0,
    topics: topics.length > 0,
    summary: true,
  }[id];

  const go = (delta) => {
    setDir(delta);
    setError('');
    setTzPicker(false);
    setStep((s) => Math.max(0, Math.min(STEPS.length - 1, s + delta)));
    window.scrollTo(0, 0);
  };
  const jumpTo = (name) => { setDir(-1); setStep(STEPS.indexOf(name)); window.scrollTo(0, 0); };

  const toggleCell = (key) => {
    setCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const applyPreset = (p) => {
    setCells((prev) => {
      const next = new Set(prev);
      const keys = p.days.flatMap((d) => p.hours.map((h) => `${d}-${h}`));
      const allOn = keys.every((k) => next.has(k));
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
      return next;
    });
  };

  const toggleTopic = (t) => {
    setTopics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : prev.length >= 3 ? prev : [...prev, t]));
  };

  const pickCountry = (c) => {
    setCountry(c.value);
    if (c.tz) setTimeZone(c.tz);
  };

  const submit = async () => {
    if (!uid) { navigate('/login'); return; }
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
        weeklyTarget,
        topics,
        version: ONBOARDING_VERSION,
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
      navigate('/', { replace: true });
    } catch (e) {
      setError('Your answers were not saved. Check your connection and try again.');
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="ob-page"><div className="ob-loading" aria-busy="true" /></div>;
  }

  const progress = step / (STEPS.length - 1);

  return (
    <div className="ob-page">
      <header className="ob-top">
        <button
          type="button"
          className="ob-back"
          onClick={() => go(-1)}
          disabled={step === 0}
          aria-label="Back"
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
            <h1 className="ob-title">A place to speak English, every week</h1>
            <p className="ob-sub">
              You practise with real partners at times that suit you, and every
              conversation turns into a report of what to work on next.
            </p>
            <ul className="ob-points">
              <li><MessagesSquare size={18} /> Real conversations with learners at your level</li>
              <li><CalendarDays size={18} /> A weekly plan built around your free time</li>
              <li><GraduationCap size={18} /> Feedback after each practice</li>
            </ul>
            <p className="ob-note">A few questions help us find the right partners for you. It takes about two minutes.</p>
          </div>
        )}

        {id === 'goal' && (
          <Question icon={<Target size={20} />} title="What brings you here?" sub="Pick the one that matters most right now.">
            <div className="ob-options">
              {GOALS.map((g) => (
                <Option key={g.value} active={goal === g.value} onClick={() => setGoal(g.value)} label={g.label} hint={g.hint} />
              ))}
            </div>
          </Question>
        )}

        {id === 'level' && (
          <Question icon={<GraduationCap size={20} />} title="How do you speak today?" sub="Your level decides who you practise with. You can change it later.">
            <div className="ob-options">
              {LEVELS.map((l) => (
                <Option
                  key={l.value}
                  active={level === l.value}
                  onClick={() => setLevel(l.value)}
                  label={<><b className="ob-tag">{l.short}</b>{l.value.split('– ')[1]}</>}
                  hint={l.hint}
                />
              ))}
            </div>
            <button type="button" className="ob-link" onClick={() => navigate('/placement')}>
              Not sure? Take the 3-minute level test
            </button>
          </Question>
        )}

        {id === 'age' && (
          <Question icon={<UserRound size={20} />} title="How old are you?" sub="We use this to match you with suitable partners. Only the SpeakLab team sees it.">
            <div className="ob-grid2">
              {AGE_BANDS.map((a) => (
                <Option key={a.value} active={ageBand === a.value} onClick={() => setAgeBand(a.value)} label={a.label} center />
              ))}
            </div>
          </Question>
        )}

        {id === 'place' && (
          <Question icon={<Globe2 size={20} />} title="Where are you?" sub="Your partners may be in another country, so we plan every practice in your own time.">
            <div className="ob-chips">
              {COUNTRIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`ob-chip ${country === c.value ? 'is-on' : ''}`}
                  onClick={() => pickCountry(c)}
                  aria-pressed={country === c.value}
                >
                  {c.value}
                </button>
              ))}
            </div>
            <div className="ob-tz">
              <Clock size={18} />
              <div className="ob-tz-text">
                <span className="ob-tz-now">Your time now: <b>{formatLocalNow(timeZone)}</b></span>
                <span className="ob-tz-zone">{cityOf(timeZone)} · {formatOffsetVsBaku(timeZone)}</span>
              </div>
              <button type="button" className="ob-link ob-link--sm" onClick={() => setTzPicker((v) => !v)}>
                {tzPicker ? 'Done' : 'Change'}
              </button>
            </div>
            {tzPicker && (
              <select className="ob-select" value={timeZone} onChange={(e) => setTimeZone(e.target.value)} aria-label="Time zone">
                {allTimeZones().map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
              </select>
            )}
            <p className="ob-note">If the time above is not your clock right now, tap Change.</p>
          </Question>
        )}

        {id === 'availability' && (
          <Question
            icon={<CalendarDays size={20} />}
            title="When are you usually free?"
            sub={`Tap the hours you could speak for 20–30 minutes. Times are in your time (${cityOf(timeZone)}).`}
          >
            <div className="ob-presets">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" className="ob-chip ob-chip--sm" onClick={() => applyPreset(p)}>{p.label}</button>
              ))}
              {cells.size > 0 && (
                <button type="button" className="ob-chip ob-chip--sm ob-chip--ghost" onClick={() => setCells(new Set())}>Clear</button>
              )}
            </div>
            <div className="ob-week" role="group" aria-label="Weekly availability">
              <div className="ob-week-row ob-week-head" aria-hidden="true">
                <span />
                {WEEK_DAYS.map((d) => <span key={d.day}>{d.short}</span>)}
              </div>
              {HOURS.map((h) => (
                <div key={h} className="ob-week-row">
                  <span className="ob-week-hour" aria-hidden="true">{String(h).padStart(2, '0')}</span>
                  {WEEK_DAYS.map((d) => {
                    const key = `${d.day}-${h}`;
                    const on = cells.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`ob-cell ${on ? 'is-on' : ''}`}
                        aria-pressed={on}
                        aria-label={`${d.short} ${formatMinutes(h * 60)}`}
                        onClick={() => toggleCell(key)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="ob-summary-line">
              {cells.size === 0
                ? 'Choose at least one hour.'
                : `${totalHours(ranges)} h a week across ${dayCount} ${dayCount === 1 ? 'day' : 'days'}`}
            </p>
          </Question>
        )}

        {id === 'target' && (
          <Question icon={<Target size={20} />} title="How many practices a week will you keep?" sub="Being free is not the same as committing. Choose the number you can really keep — every booked practice has a partner waiting for you.">
            <div className="ob-grid4">
              {WEEKLY_TARGETS.map((t) => {
                const disabled = t.value > dayCount;
                return (
                  <button
                    key={t.value}
                    type="button"
                    className={`ob-target ${weeklyTarget === t.value ? 'is-on' : ''}`}
                    onClick={() => setWeeklyTarget(t.value)}
                    disabled={disabled}
                    aria-pressed={weeklyTarget === t.value}
                  >
                    <b>{t.label}</b>
                    <span>{t.hint}</span>
                  </button>
                );
              })}
            </div>
            {dayCount < 4 && (
              <p className="ob-note">
                You are free on {dayCount} {dayCount === 1 ? 'day' : 'days'}, so you can plan up to {dayCount} {dayCount === 1 ? 'practice' : 'practices'} a week.{' '}
                <button type="button" className="ob-link ob-link--inline" onClick={() => jumpTo('availability')}>Add more free time</button>
              </p>
            )}
          </Question>
        )}

        {id === 'topics' && (
          <Question icon={<MessagesSquare size={20} />} title="What do you like to talk about?" sub="Up to three. Shared interests make a first conversation easier.">
            <div className="ob-chips">
              {TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`ob-chip ${topics.includes(t) ? 'is-on' : ''}`}
                  onClick={() => toggleTopic(t)}
                  aria-pressed={topics.includes(t)}
                  disabled={!topics.includes(t) && topics.length >= 3}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="ob-summary-line">{topics.length}/3 selected</p>
          </Question>
        )}

        {id === 'summary' && (
          <Question icon={<Check size={20} />} title="Your practice profile" sub="Check it once. The SpeakLab team uses it to plan your partners and practice times.">
            <dl className="ob-review">
              <Row label="Goal" value={labelOf(GOALS, goal)} onEdit={() => jumpTo('goal')} />
              <Row label="Level" value={level} onEdit={() => jumpTo('level')} />
              <Row label="Age" value={labelOf(AGE_BANDS, ageBand)} onEdit={() => jumpTo('age')} />
              <Row label="Location" value={`${country} · ${cityOf(timeZone)}`} onEdit={() => jumpTo('place')} />
              <Row
                label="Free time"
                value={(
                  <span className="ob-review-ranges">
                    {WEEK_DAYS.map((d) => {
                      const rs = ranges.filter((r) => r.day === d.day);
                      if (!rs.length) return null;
                      return (
                        <span key={d.day}>
                          <b>{d.short}</b> {rs.map((r) => `${formatMinutes(r.startMin)}–${formatMinutes(r.endMin)}`).join(', ')}
                        </span>
                      );
                    })}
                  </span>
                )}
                onEdit={() => jumpTo('availability')}
              />
              <Row label="Per week" value={`${labelOf(WEEKLY_TARGETS, weeklyTarget)} ${weeklyTarget === 1 ? 'practice' : 'practices'}`} onEdit={() => jumpTo('target')} />
              <Row label="Topics" value={topics.join(', ')} onEdit={() => jumpTo('topics')} />
            </dl>
            {error && <p className="ob-error" role="alert">{error}</p>}
          </Question>
        )}
      </main>

      <footer className="ob-foot">
        {id === 'summary' ? (
          <Button size="lg" full onClick={submit} disabled={saving} icon={<Check size={20} />}>
            {saving ? 'Saving…' : 'Confirm my profile'}
          </Button>
        ) : (
          <Button size="lg" full onClick={() => go(1)} disabled={!canNext} iconRight={<ArrowRight size={20} />}>
            {id === 'welcome' ? 'Get started' : 'Continue'}
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

function Row({ label, value, onEdit }) {
  return (
    <div className="ob-review-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
      <button type="button" className="ob-edit" onClick={onEdit} aria-label={`Edit ${label}`}>
        <Pencil size={16} />
      </button>
    </div>
  );
}
