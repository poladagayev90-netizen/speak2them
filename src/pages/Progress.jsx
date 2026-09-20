import { totalPracticeMinutes } from '../utils/practiceStats';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  ChevronLeft, Clock, BookOpen, GraduationCap, Gauge, LineChart, ChevronDown,
  Check, TrendingUp, Minus, RotateCcw, CircleDashed, Bot, Users, Target,
} from 'lucide-react';
import {
  fetchLearnerInsights,
  buildTrackerRows,
  topWeaknesses,
  trackerCoverage,
  progressSeries,
  sessionTickets,
  conceptTimeline,
  focusReview,
  currentFocus,
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
  // Which tracker row is open. One at a time: two timelines on a phone screen
  // is two charts and no context for either.
  const [openConcept, setOpenConcept] = useState(null);

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
  const review = focusReview(progress, lang);
  const watching = currentFocus(progress, lang);
  const tickets = sessionTickets(progress, lang);

  // The carry-over already names the concepts the last report asked for, so
  // "What to practise" only shows what it does NOT cover. Two sections naming
  // the same three concepts read as a bug, and the learner stops reading both.
  const weaknesses = topWeaknesses(rows, 3);
  const pinned = new Set((review ? review.items : watching).map((i) => i.id));
  const focus = weaknesses.filter((r) => !pinned.has(r.id));

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

  const totalMinutes = totalPracticeMinutes(profile);
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
          {weaknesses.length > 0 ? (
            <>
              <p className="progress-hero-headline">Work on {weaknesses[0].label.toLowerCase()}</p>
              <p className="progress-hero-sub">
                It is the pattern you repeat most — {weaknesses[0].errors}{' '}
                {weaknesses[0].errors === 1 ? 'correction' : 'corrections'} across{' '}
                {weaknesses[0].sessions} {weaknesses[0].sessions === 1 ? 'session' : 'sessions'}.
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

      {/* The carry-over. This is the only thing on the page that answers "did I
          actually apply it" — everything else is a total. The verdicts are
          computed server-side from transcript-verified corrections, so a card
          here never congratulates the learner for something we did not see. */}
      {review ? (
        <section className="progress-section">
          <div className="progress-section-head">
            <h3 className="progress-section-title">Did you apply it?</h3>
            <span className="progress-section-note">
              since {review.fromAt ? new Date(review.fromAt).toLocaleDateString() : 'your last report'}
            </span>
          </div>
          <div className="progress-carry">
            {review.items.map((item) => <VerdictCard key={item.id} item={item} />)}
          </div>
        </section>
      ) : watching.length > 0 ? (
        <section className="progress-section">
          <div className="progress-section-head">
            <h3 className="progress-section-title">Watching next session</h3>
          </div>
          <div className="progress-carry">
            {watching.map((item) => (
              <div key={item.id} className="progress-verdict progress-verdict--pending">
                <div className="progress-verdict-head">
                  <span className="progress-verdict-icon"><Target size={16} strokeWidth={2.2} /></span>
                  <p className="progress-verdict-name">{item.label}</p>
                </div>
                <p className="progress-verdict-line">
                  Corrected {item.errors}× in your last session. Your next session
                  measures the same thing.
                </p>
                {item.examples[0] && <Example example={item.examples[0]} />}
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
          {rows.map((row) => {
            // A concept is only worth opening once it has appeared in two
            // different sessions — a single point is not a trend, and an
            // expander that opens onto one dot teaches nothing.
            const timeline = conceptTimeline(progress, row.id);
            const expandable = timeline.length >= 2;
            const open = openConcept === row.id;
            const cells = (
              <>
                <span className="progress-cell-name">
                  {row.label}
                  {expandable && (
                    <ChevronDown
                      size={14}
                      className={`progress-row-chevron${open ? ' progress-row-chevron--open' : ''}`}
                      aria-hidden="true"
                    />
                  )}
                </span>
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
              </>
            );

            return (
              <React.Fragment key={row.id}>
                {expandable ? (
                  <button
                    type="button"
                    className="progress-row progress-row--tap"
                    aria-expanded={open}
                    onClick={() => setOpenConcept(open ? null : row.id)}
                  >
                    {cells}
                  </button>
                ) : (
                  <div className="progress-row">{cells}</div>
                )}
                {open && <ConceptTimeline points={timeline} label={row.label} />}
              </React.Fragment>
            );
          })}
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

      {/* One ticket per analysed session: what it scored, how long you spoke,
          and what it was about. The full report is one tap away — this list is
          the index to it, not a replacement for it. */}
      {tickets.length > 0 && (
        <section className="progress-section">
          <div className="progress-section-head">
            <h3 className="progress-section-title">Sessions</h3>
            <span className="progress-section-note">newest first</span>
          </div>
          <div className="progress-tickets">
            {tickets.map((t, i) => (
              <Ticket
                key={t.analysisId || `${t.at}-${i}`}
                ticket={t}
                // Sessions analysed before Faza 7 carry no analysis id, so they
                // are shown but cannot open — better than a tap that silently
                // does nothing.
                onOpen={t.analysisId
                  ? () => navigate('/history', { state: { analysisId: t.analysisId } })
                  : null}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Faza 7 pieces ─────────────────────────────────────────────────

// Wording is the whole design here. Each verdict has to say what was MEASURED,
// not how the learner should feel about it: "8 uses, no correction" is a fact
// they can check against their own report, "great progress!" is not.
const VERDICTS = {
  clean: { icon: Check, title: 'Clean this time' },
  better: { icon: TrendingUp, title: 'Better' },
  same: { icon: Minus, title: 'About the same' },
  again: { icon: RotateCcw, title: 'Came up again' },
  unseen: { icon: CircleDashed, title: 'Not enough to judge' },
};

function verdictLine({ verdict, before, after }) {
  const rate = (s) => Math.round((s.errors / Math.max(1, s.attempts)) * 100);
  switch (verdict) {
    case 'clean':
      return `You used it ${after.attempts}× with nothing to correct, after ${before.errors} `
        + `${before.errors === 1 ? 'correction' : 'corrections'} last time.`;
    case 'better':
      return `${after.errors} of ${after.attempts} uses needed a fix — ${rate(after)}%, down from ${rate(before)}%.`;
    case 'same':
      return `${after.errors} of ${after.attempts} uses needed a fix, about the same rate as last time.`;
    case 'again':
      return `${after.errors} of ${after.attempts} uses needed a fix — more often than last time.`;
    default:
      // The honest case, and the one a flattering feature would hide: it simply
      // did not come up enough to say anything.
      return after.attempts === 0
        ? 'It did not come up in your last session, so there is nothing to compare.'
        : `Only ${after.attempts} ${after.attempts === 1 ? 'use' : 'uses'} last session — too few to call.`;
  }
}

function VerdictCard({ item }) {
  const meta = VERDICTS[item.verdict] || VERDICTS.unseen;
  const Icon = meta.icon;
  return (
    <div className={`progress-verdict progress-verdict--${item.verdict}`}>
      <div className="progress-verdict-head">
        <span className="progress-verdict-icon"><Icon size={16} strokeWidth={2.2} /></span>
        <p className="progress-verdict-name">{item.label}</p>
        <span className="progress-verdict-tag">{meta.title}</span>
      </div>
      <p className="progress-verdict-line">{verdictLine(item)}</p>
      {item.examples[0] && <Example example={item.examples[0]} />}
    </div>
  );
}

// The learner's own sentence, struck through and fixed. Their words are what
// makes the concept name mean something — "articles" is a label, "I go to the
// school" is the mistake they recognise.
function Example({ example }) {
  return (
    <p className="progress-example">
      <span className="progress-example-wrong">{example.original}</span>
      <span className="progress-example-arrow" aria-hidden="true">→</span>
      <span className="progress-example-right">{example.corrected}</span>
    </p>
  );
}

// One concept over time. Bars, not a line: the sessions are not evenly spaced
// in time and a line between them would imply a smooth slope through days the
// learner never practised. Height is the error RATE, so a long session and a
// short one can be compared at all.
function ConceptTimeline({ points, label }) {
  const worst = Math.max(...points.map((p) => p.rate), 1);
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div className="progress-timeline">
      <div className="progress-timeline-bars" role="img"
        aria-label={`${label}: correction rate from ${first.rate}% to ${last.rate}% across ${points.length} sessions`}>
        {points.map((p, i) => (
          <span key={`${p.at}-${i}`} className="progress-timeline-bar">
            <span
              className={`progress-timeline-fill${p.errors === 0 ? ' progress-timeline-fill--clean' : ''}`}
              // A clean session still needs a visible mark, otherwise the best
              // days look like missing data.
              style={{ height: `${Math.max(6, (p.rate / worst) * 100)}%` }}
            />
          </span>
        ))}
      </div>
      <p className="progress-timeline-note">
        Share of uses that needed correcting, {points.length} sessions where it came up
        {' · '}
        {first.rate}% → {last.rate}%
      </p>
    </div>
  );
}

function Ticket({ ticket, onOpen }) {
  const minutes = Math.round(ticket.seconds / 60);
  const Icon = ticket.source === 'ainur' ? Bot : Users;
  const body = (
    <>
      <div className="progress-ticket-head">
        <span className="progress-ticket-source"><Icon size={14} strokeWidth={2.2} /></span>
        <span className="progress-ticket-date">
          {ticket.at ? new Date(ticket.at).toLocaleDateString() : '—'}
        </span>
        {minutes > 0 && <span className="progress-ticket-min">{minutes} min</span>}
        <span className="progress-ticket-score">{ticket.overall || '—'}</span>
      </div>
      <div className="progress-ticket-stats">
        {ticket.wpm > 0 && <span>{ticket.wpm} wpm</span>}
        {ticket.newWords > 0 && <span>+{ticket.newWords} new words</span>}
        {ticket.used > 0 && <span>{ticket.used} structures used</span>}
      </div>
      {ticket.corrected.length > 0 ? (
        <div className="progress-ticket-tags">
          {ticket.corrected.map((c) => (
            <span key={c.id} className="progress-ticket-tag">
              {c.label} <b>{c.errors}</b>
            </span>
          ))}
        </div>
      ) : (
        <p className="progress-ticket-clean">Nothing needed correcting in this one.</p>
      )}
    </>
  );

  if (!onOpen) return <div className="progress-ticket">{body}</div>;
  return (
    <button type="button" className="progress-ticket progress-ticket--tap" onClick={onOpen}>
      {body}
    </button>
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
