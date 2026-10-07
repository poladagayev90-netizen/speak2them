import React from 'react';
import { X } from 'lucide-react';
import './TimeGrid.css';

// The day × hour grid: onboarding's «When are you usually free?» and the Plan
// tab's week (Polad 2026-10-07: the calendar should stay as live as the
// onboarding grid). One component so the two never drift apart.
//
// columns: [{ key, label, sub?, disabled? }] — a weekday (onboarding) or a
//   date of one week (Plan). hours: whole hours, rows.
// cell(colKey, hour) → { on, maybe?, never?, disabled?, mark?, popular?, label? }
//   maybe / never — the general week profile (utils/weekProfile.js): a soft
//   hatched cell, and a muted one with an X. `label` should name the state.
// head(column) → a node for the column head (the Plan tab puts its day
//   buttons there, so the days and their hours are one aligned column).
export default function TimeGrid({ columns, hours, cell, onToggle, ariaLabel, compact = false, head = null }) {
  return (
    <div className={`ob-week${compact ? ' ob-week--compact' : ''}`} role="group" aria-label={ariaLabel}>
      {head ? (
        <div className="ob-week-row ob-week-head ob-week-head--custom">
          <span aria-hidden="true" />
          {columns.map((c) => <React.Fragment key={c.key}>{head(c)}</React.Fragment>)}
        </div>
      ) : (
        <div className="ob-week-row ob-week-head" aria-hidden="true">
          <span />
          {columns.map((c) => (
            <span key={c.key} className={c.disabled ? 'is-off' : ''}>
              {c.label}
              {c.sub != null && <b>{c.sub}</b>}
            </span>
          ))}
        </div>
      )}
      {hours.map((h) => (
        <div key={h} className="ob-week-row">
          <span className="ob-week-hour" aria-hidden="true">{String(h).padStart(2, '0')}</span>
          {columns.map((c) => {
            const x = cell(c.key, h) || {};
            const disabled = !!(c.disabled || x.disabled);
            return (
              <button
                key={`${c.key}-${h}`}
                type="button"
                className={`ob-cell${x.on ? ' is-on' : ''}${x.maybe ? ' is-maybe' : ''}${x.never ? ' is-never' : ''}${x.popular ? ' is-popular' : ''}${x.mark ? ' is-marked' : ''}${disabled ? ' is-disabled' : ''}`}
                aria-pressed={disabled ? undefined : !!(x.on || x.maybe || x.never)}
                aria-label={x.label || `${c.label} ${String(h).padStart(2, '0')}:00`}
                disabled={disabled}
                onClick={() => onToggle(c.key, h)}
              >
                {x.never && <X size={12} strokeWidth={3} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Free · Maybe · Never: which kind a tap on the grid paints (Onboarding).
export function PaintModes({ modes, value, onChange }) {
  return (
    <div className="ob-paint" role="radiogroup" aria-label="What a tap marks">
      {modes.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={value === m.id}
          className={`ob-paint-btn${value === m.id ? ' is-on' : ''}`}
          onClick={() => onChange(m.id)}
        >
          <span className={`ob-paint-swatch ob-cell is-${m.id === 'free' ? 'on' : m.id}`} aria-hidden="true">
            {m.id === 'never' && <X size={10} strokeWidth={3} />}
          </span>
          <span className="ob-paint-text">
            <b>{m.label}</b>
            <span>{m.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
