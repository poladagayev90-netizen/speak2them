import React, { useMemo, useState } from 'react';
import { ChevronDown, Clock } from 'lucide-react';
import { availabilitySummary, freeGrid } from '../utils/matching';
import './AvailabilityLine.css';

// One plain line per person — «3/week · usual: Mon 19–21, Sat 11–13 (maybe)»,
// Baku hours — in the rows Polad actually reads (Week → Who practises,
// Matching → Newcomers). Polad 2026-11-15: the free-time grid was only inside
// an opened People row and he could not find it. A tap opens the same grid
// (utils/matching freeGrid) right under the line.
export default function AvailabilityLine({ onboarding, week, uid, pairs = [] }) {
  const [open, setOpen] = useState(false);
  const sum = useMemo(() => availabilitySummary(onboarding, week), [onboarding, week]);
  const canOpen = sum.kind === 'week' || sum.kind === 'usual';
  return (
    <span className="av">
      <button type="button" className={`av-line ${canOpen ? '' : 'is-plain'}`} aria-expanded={canOpen ? open : undefined}
        disabled={!canOpen} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((x) => !x); }}>
        <Clock size={14} aria-hidden="true" className="av-icon" />
        <span className="av-text">{sum.text}</span>
        {canOpen && <ChevronDown size={14} aria-hidden="true" className={`av-chev ${open ? 'is-open' : ''}`} />}
      </button>
      {open && canOpen && <WeekGrid onboarding={onboarding} week={week} uid={uid} pairs={pairs} />}
    </span>
  );
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function WeekGrid({ onboarding, week, uid, pairs }) {
  const g = useMemo(() => freeGrid({ onboarding, monday: week, uid, pairs }), [onboarding, week, uid, pairs]);
  return (
    <span className="av-grid">
      <span className="av-days" aria-hidden="true">{g.rows.map((r) => <span key={r.date}>{DAY[r.day][0]}</span>)}</span>
      <span className="av-body">
        <span className="av-cells" role="img" aria-label={`${g.free} free hours this week, Baku time`}>
          {g.rows.flatMap((row) => row.cells.map((c) => (
            <span key={c.slotId} className={`av-cell ${c.state ? `is-${c.state}` : ''} ${c.maybe ? 'is-maybe' : ''}`}
              title={`${DAY[row.day]} ${c.hour}:00${c.state === 'pair' ? ' · practice' : c.state === 'off' ? ' · usual, not this week' : c.maybe ? ' · maybe' : ''}`} />
          )))}
        </span>
        <span className="av-hours" aria-hidden="true"><span>07</span><span>15</span><span>23</span></span>
      </span>
      <span className="av-key">Baku time · dark = this week · light = usual · outline = maybe</span>
    </span>
  );
}
