import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, MessageCircle, UserPlus } from 'lucide-react';
import { newcomerRows } from '../utils/newcomers';
import { ageBandShort, isMinorBand } from '../utils/matching';
import { lastSeenLabel } from '../utils/presence';
import { Button } from './ui';
import AvailabilityLine from './AvailabilityLine';
import './NewcomersCard.css';

// Admin → Matching, first thing on the tab (2026-11-15; collapsed by default
// since 2026-11-22 so Matching itself stays above the fold): everyone who
// joined in the last 14 days — including those who never finished the wizard.
// Data is what Matching already loads, so the card costs no extra reads.
const SHOW = 8;
const LANG = { az: 'AZ', tr: 'TR', ru: 'RU', en: 'EN' };

export default function NewcomersCard({ users, onboarding, warmups, pairs, week, now, skip, levelShort }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const obById = useMemo(() => new Map(onboarding.map((o) => [o.id, o])), [onboarding]);
  const rows = useMemo(() => {
    const booked = new Set();
    for (const p of pairs) { if (p.a) booked.add(p.a); if (p.b) booked.add(p.b); }
    return newcomerRows({ users, onboarding: obById, warmups, bookedUids: booked, pairs, week, now, skip });
  }, [users, obById, warmups, pairs, week, now, skip]);

  const waiting = rows.filter((r) => r.noFirst).length;
  const shown = all ? rows : rows.slice(0, SHOW);
  return (
    <section className={`aa-panel nc ${open ? 'is-open' : ''}`} aria-label="Newcomers">
      <button
        type="button"
        className="nc-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="nc-head-main">
          <span className="aa-h">
            <UserPlus size={18} aria-hidden="true" /> Newcomers · 14d
          </span>
          <span className="aa-meta">
            {rows.length === 0
              ? 'Nobody joined in the last 14 days.'
              : `${rows.length} joined · ${waiting} without a first practice`}
          </span>
        </span>
        <span className="nc-toggle">
          {open ? 'Hide' : 'Show'}
          <ChevronDown size={16} className="nc-chev" aria-hidden="true" />
        </span>
      </button>

      {open && rows.length > 0 && (
        <>
          <p className="aa-meta nc-sub">
            Write within the first hour — each WhatsApp button uses their language and 2 times from their own grid.
          </p>
          <ul className="nc-list">
            {shown.map((r) => {
              const next = r.steps.find((s) => !s.done);
              const age = ageBandShort(r.ageBand);
              return (
                <li key={r.uid} className="nc-row">
                  <div className="nc-main">
                    <span className="aa-name">
                      {r.name}
                      {r.level && <span className="aa-level">{levelShort(r.level)}</span>}
                      {age && (
                        <span className={`aa-badge ${isMinorBand(r.ageBand) ? 'mt-age--minor' : 'aa-badge--soft'}`}>
                          {age}
                        </span>
                      )}
                    </span>
                    <span className="aa-meta">
                      joined {r.days === 0 ? 'today' : r.days === 1 ? 'yesterday' : `${r.days} days ago`}
                      {' · '}{r.seen ? `seen ${lastSeenLabel(r.seen, now)}` : 'never seen'}
                      {' · '}{LANG[r.lang]}
                    </span>
                    {obById.has(r.uid)
                      ? <AvailabilityLine onboarding={obById.get(r.uid)} week={week} uid={r.uid} pairs={pairs} />
                      : <span className="aa-meta">no hours yet · wizard not done</span>}
                    <ol className="nc-steps" aria-label={`${r.reached} of ${r.steps.length} steps`}>
                      {r.steps.map((s) => (
                        <li key={s.key} className={`nc-step ${s.done ? 'is-done' : ''}`} title={s.label}>
                          {s.done && <Check size={10} strokeWidth={3} aria-hidden="true" />}
                          <span className="nc-sr">{s.label}: {s.done ? 'yes' : 'not yet'}</span>
                        </li>
                      ))}
                    </ol>
                    <span className="nc-next">{next ? `Next: ${next.label}` : 'All steps done'}</span>
                  </div>
                  {r.whatsapp ? (
                    <Button as="a" size="sm" variant="secondary" href={r.whatsapp} target="_blank" rel="noopener noreferrer"
                      icon={<MessageCircle size={16} aria-hidden="true" />} aria-label={`WhatsApp ${r.name}`}>
                      WhatsApp
                    </Button>
                  ) : (
                    <span className="nc-nowa">No WhatsApp</span>
                  )}
                </li>
              );
            })}
          </ul>
          {rows.length > SHOW && (
            <button type="button" className="aa-chip nc-more" onClick={() => setAll((x) => !x)}>
              {all ? 'Show fewer' : `Show all ${rows.length}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
