import React, { useState } from 'react';
import { ChevronDown, Check, TrendingUp, Bot, Phone, CircleAlert } from 'lucide-react';
import Sheet from '../ui/Sheet';
import { sessionTitle } from '../../utils/labCharts';
import { whenLine } from './LabSession';

// The session switch at the top of the Lab: which report you are looking at,
// and every other one a tap away — newest first, with "See all progress"
// (the totals across every session) at the bottom.
export default function LabPicker({ analyses, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const current = analyses.find((a) => a.id === selected);
  const pick = (id) => { onSelect(id); setOpen(false); };

  return (
    <>
      <button type="button" className="lab-picker" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="lab-picker-icon" aria-hidden="true">
          {current ? <SessionIcon a={current} /> : <TrendingUp size={18} />}
        </span>
        <span className="lab-picker-main">
          <span className="lab-picker-title">{current ? sessionTitle(current) : 'All progress'}</span>
          <span className="lab-picker-sub">
            {current ? whenLine(current) : `Across ${analyses.length} ${analyses.length === 1 ? 'session' : 'sessions'}`}
          </span>
        </span>
        <ChevronDown size={20} aria-hidden="true" />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Your sessions"
        footer={(
          <button type="button" className={`lab-pick lab-pick--all ${selected === 'all' ? 'is-on' : ''}`} onClick={() => pick('all')}>
            <TrendingUp size={18} aria-hidden="true" />
            <span>See all progress</span>
          </button>
        )}
      >
        <div className="lab-pick-list">
          {analyses.map((a) => (
            <button key={a.id} type="button" className={`lab-pick ${selected === a.id ? 'is-on' : ''}`} onClick={() => pick(a.id)}>
              <span className="lab-picker-icon" aria-hidden="true"><SessionIcon a={a} /></span>
              <span className="lab-picker-main">
                <span className="lab-picker-title">{sessionTitle(a)}</span>
                <span className="lab-picker-sub">{a.error ? 'Analysis failed' : whenLine(a)}</span>
              </span>
              {selected === a.id && <Check size={18} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

function SessionIcon({ a }) {
  if (a.error) return <CircleAlert size={18} />;
  return a.source === 'ainur' ? <Bot size={18} /> : <Phone size={18} />;
}
