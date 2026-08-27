import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, Clock, BookOpen, GraduationCap, Gauge, LineChart } from 'lucide-react';
import {
  fetchLearnerInsights,
  buildTrackerRows,
  topWeaknesses,
  trackerCoverage,
  progressSeries,
} from '../utils/insights';
import { getFeedbackLanguage } from '../utils/feedbackLanguage';
import '../styles/progress.css';

// The progress room.
//
// History answers "what happened in that call". Nothing answered "am I getting
// better", which is the question a learner actually has and the one a single
// report can never answer. Everything here is read from the two aggregate
// documents the analysis worker maintains (users/{uid}/insights), so opening
// this page is two reads plus the user document — not a scan of every past
// analysis.
//
// HONESTY RULES, because this screen is all numbers:
//   - A concept with too few attempts prints "—", never a percentage.
//   - The level comes from the placement test, which actually measured it. We
//     do NOT infer a CEFR level from scores; an invented level is worse than
//     an absent one, and the test is one tap away.
//   - "Words used" counts distinct word FORMS, and says so. Calling it
//     vocabulary size would imply lemmas we do not compute.

export default function Progress({ user }) {
  const navigate = useNavigate();
  const lang = getFeedbackLanguage();
  const [loading, setLoading] = useState(true);
  const [grammar, setGrammar] = useState(null);
  const [progress, setProgress] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.uid) return;
      try {
        const [insights, userSnap] = await Promise.all([
          fetchLearnerInsights(user.uid),
          getDoc(doc(db, 'users', user.uid)),
        ]);
        if (!alive) return;
        setGrammar(insights.grammar);
        setProgress(insights.progress);
        setProfile(userSnap.exists() ? userSnap.data() : null);
      } catch (e) {
        console.warn('[Progress] load failed:', e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user?.uid]);

  const rows = buildTrackerRows(grammar, lang);
  const series = progressSeries(progress);
  const coverage = trackerCoverage(rows);
  const focus = topWeaknesses(rows, 3);

  // The headline score is the average of the last five sessions, not the last
  // one. A single bad call is noise — a learner who had a tired evening should
  // not open this page to a number that says they got worse.
  const recent = series.slice(-5).filter((s) => s.overall > 0);
  const overall = recent.length
    ? Math.round(recent.reduce((sum, s) => sum + s.overall, 0) / recent.length)
    : null;

  const pacedSessions = series.filter((s) => s.wpm > 0);
  const avgWpm = pacedSessions.length
    ? Math.round(pacedSessions.reduce((sum, s) => sum + s.wpm, 0) / pacedSessions.length)
    : null;

  const totalMinutes = Number(profile?.totalMinutes) || 0;
  const wordCount = Number(progress?.wordCount) || 0;
  const newWords = Number(progress?.lastNewWords) || 0;
  // "A2 – Elementary" → "A2". The full label does not fit a tile.
  const levelFull = typeof profile?.level === 'string' ? profile.level : '';
  const levelShort = levelFull ? levelFull.split(/[\s–-]/)[0] : null;

  if (loading) {
    return (
      <div className="progress-page">
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>
          Loading…
        </div>
      </div>
    );
  }

  const header = (
    <div className="progress-header">
      <button className="progress-back" onClick={() => navigate('/profile')} aria-label="Back">
        <ChevronLeft size={24} />
      </button>
      <h2 className="progress-title">Your progress</h2>
    </div>
  );

  // Nothing has been analysed yet. Say exactly what produces the first row —
  // a learner who does not know the two-minute floor reads an empty room as a
  // broken feature.
  if (!grammar && !progress) {
    return (
      <div className="progress-page">
        {header}
        <div className="progress-empty">
          <div className="progress-empty-icon"><LineChart size={40} strokeWidth={1.5} /></div>
          <p className="progress-empty-title">Nothing to show yet</p>
          <p className="progress-empty-body">
            This room fills up after your first analysed session. Talk to a partner
            or to AInur for a couple of minutes, and your grammar tracker, your
            word count and your speaking pace start building here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="progress-page">
      {header}

      {/* Hero — one number and one instruction. */}
      <div className="progress-hero">
        <ScoreRing value={overall} />
        <div className="progress-hero-body">
          <p className="progress-hero-label">Across {grammar?.sessionCount || series.length} sessions</p>
          {focus.length > 0 ? (
            <>
              <p className="progress-hero-headline">Work on {focus[0].label.toLowerCase()}</p>
              <p className="progress-hero-sub">
                It is the pattern you repeat most — {focus[0].errors}{' '}
                {focus[0].errors === 1 ? 'correction' : 'corrections'} across{' '}
                {focus[0].sessions} {focus[0].sessions === 1 ? 'session' : 'sessions'}.
              </p>
            </>
          ) : (
            <>
              <p className="progress-hero-headline">Keep going</p>
              <p className="progress-hero-sub">
                No repeated pattern has built up enough evidence yet. A few more
                sessions and this will name the one thing worth practising.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Four measured things. Every one of these is real data, not an estimate. */}
      <div className="progress-tiles">
        <Tile icon={Clock} label="Speaking time" value={totalMinutes} unit="min" />
        <Tile
          icon={BookOpen}
          label="Words used"
          value={wordCount.toLocaleString()}
          delta={newWords > 0 ? `+${newWords} last session` : null}
        />
        <Tile
          icon={GraduationCap}
          label="Level"
          value={levelShort || '—'}
          cta={levelShort ? null : { text: 'Take the test', onClick: () => navigate('/placement') }}
        />
        <Tile icon={Gauge} label="Speaking speed" value={avgWpm ?? '—'} unit={avgWpm ? 'wpm' : ''} />
      </div>

      {focus.length > 0 && (
        <section className="progress-section">
          <div className="progress-section-head">
            <h3 className="progress-section-title">What to practise</h3>
          </div>
          <div className="progress-focus">
            {focus.map((row) => (
              <div key={row.id} className="progress-focus-card">
                <p className="progress-focus-name">{row.label}</p>
                <span className="progress-focus-meta">
                  {row.errors} corrected · used {row.attempts}×
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="progress-section">
        <div className="progress-section-head">
          <h3 className="progress-section-title">Grammar tracker</h3>
          {/* Coverage is stated so the table is not mistaken for a full picture
              of the learner's English — it only holds what has come up in
              conversation so far. */}
          <span className="progress-section-note">
            {coverage.seen} of {coverage.total} concepts seen
          </span>
        </div>

        <div className="progress-tracker">
          <div className="progress-row progress-row--head">
            <span>Concept</span>
            <span>Level</span>
            <span>Used</span>
            <span>Mastery</span>
          </div>
          {rows.map((row) => (
            <div className="progress-row" key={row.id}>
              <span className="progress-cell-name">{row.label}</span>
              <span className="progress-cell-difficulty">
                <span className="progress-cefr">{row.cefr || '—'}</span>
              </span>
              <span className="progress-cell-num progress-cell-used">{row.attempts}×</span>
              <span className="progress-meter">
                <span className={`progress-meter-track${row.provisional ? ' progress-meter-track--provisional' : ''}`}>
                  {!row.provisional && (
                    <span className="progress-meter-fill" style={{ width: `${row.mastery}%` }} />
                  )}
                </span>
                <span className={`progress-meter-value${row.provisional ? ' progress-meter-value--muted' : ''}`}>
                  {row.provisional ? '—' : `${row.mastery}%`}
                </span>
              </span>
            </div>
          ))}
        </div>
        <p className="progress-section-note" style={{ display: 'block', marginTop: 'var(--s-3)' }}>
          A dash means you have not used that structure enough times yet for a
          percentage to mean anything.
        </p>
      </section>

      {series.length >= 2 && (
        <section className="progress-section">
          <div className="progress-section-head">
            <h3 className="progress-section-title">Session scores</h3>
            <span className="progress-section-note">last {series.length}</span>
          </div>
          <div className="progress-trend">
            <Sparkline points={series.map((s) => s.overall)} />
          </div>
        </section>
      )}
    </div>
  );
}

function Tile({ icon: Icon, label, value, unit, delta, cta }) {
  return (
    <div className="progress-tile">
      <span className="progress-tile-label">
        <Icon size={14} strokeWidth={2} />
        {label}
      </span>
      <div className="progress-tile-value">
        {value}
        {unit ? <span className="progress-tile-unit">{unit}</span> : null}
      </div>
      {delta && <span className="progress-tile-delta">{delta}</span>}
      {cta && (
        <button type="button" className="progress-tile-cta" onClick={cta.onClick}>
          {cta.text}
        </button>
      )}
    </div>
  );
}

// SVG rather than a conic-gradient: a gradient cannot be given a rounded cap or
// animated per-browser consistently, and this has to render identically in the
// Android WebView.
function ScoreRing({ value }) {
  const size = 104;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

  return (
    <svg className="progress-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
      aria-label={Number.isFinite(value) ? `Average score ${value} out of 100` : 'No score yet'}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent-soft)" strokeWidth={stroke} />
      {Number.isFinite(value) && (
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
          // Start at twelve o'clock instead of three.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      <text className="progress-ring-value" x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
        {Number.isFinite(value) ? value : '—'}
      </text>
    </svg>
  );
}

// Deliberately unlabelled and unscaled to 0: the shape is the message ("is the
// line going up"), and a y-axis from zero would flatten the range every real
// learner sits in (roughly 50-90) into a straight line.
function Sparkline({ points }) {
  const w = 600;
  const h = 90;
  const pad = 8;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const xy = points.map((p, i) => [
    pad + i * step,
    pad + (1 - (p - min) / span) * (h - pad * 2),
  ]);
  const line = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${xy[xy.length - 1][0].toFixed(1)} ${h - pad} L${xy[0][0].toFixed(1)} ${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img"
      aria-label={`Scores from ${points[0]} to ${points[points.length - 1]}`}>
      <path d={area} fill="var(--accent-soft)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5"
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r="4" fill="var(--accent)"
        vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
