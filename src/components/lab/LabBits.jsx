import React from 'react';
import { CEFR_STEPS } from '../../utils/labCharts';

// The Lab's building blocks: a number tile with its small chart, the score
// ring, and the three chart shapes. Shared by the totals view (Progress.jsx)
// and the one-session view (LabSession.jsx) so both read as one room.

export function Tile({ icon: Icon, label, value, unit, delta, cta, chart }) {
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
      {chart}
    </div>
  );
}

// ─── Tile charts ────────────────────────────────────────────────────
// Drawn in a fixed 100×32 box and stretched to the tile width. One colour
// family: past sessions in the soft step, the latest in the full accent, so
// "where am I now" reads before "how did I get here".
const CW = 100;
const CH = 32;

export function Bars({ values, label }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values, 1);
  const w = CW / values.length;
  return (
    <svg className="progress-chart" viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" role="img" aria-label={label}>
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * CH);
        return (
          <rect key={i} x={i * w + w * 0.15} y={CH - h} width={w * 0.7} height={h} rx="1.5"
            fill={i === values.length - 1 ? 'var(--accent)' : 'var(--accent-soft)'} />
        );
      })}
    </svg>
  );
}

export function Line({ values, label }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * (CW - 4) + 2,
    CH - 3 - ((v - min) / span) * (CH - 6),
  ]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg className="progress-chart" viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <polygon points={`2,${CH} ${line} ${lx.toFixed(1)},${CH}`} fill="var(--accent-soft)" />
      <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.2" fill="var(--bg-secondary)" stroke="var(--accent)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// The CEFR ladder: every step up to the learner's level is filled, their own
// step in the full accent. The level is the placement test's, never inferred.
export function Ladder({ index }) {
  if (index < 0) return null;
  const w = CW / CEFR_STEPS.length;
  return (
    <svg className="progress-chart" viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" role="img"
      aria-label={`Level ${CEFR_STEPS[index]} of A1 to C2`}>
      {CEFR_STEPS.map((step, i) => {
        const h = ((i + 1) / CEFR_STEPS.length) * CH;
        const fill = i === index ? 'var(--accent)' : i < index ? 'var(--accent-soft)' : 'var(--border)';
        return <rect key={step} x={i * w + w * 0.18} y={CH - h} width={w * 0.64} height={h} rx="1.5" fill={fill} />;
      })}
    </svg>
  );
}

// SVG rather than a conic-gradient: a gradient cannot be given a rounded cap or
// animated per-browser consistently, and this has to render identically in the
// Android WebView.
export function ScoreRing({ value }) {
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
