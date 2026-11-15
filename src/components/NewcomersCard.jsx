import React, { useMemo, useState } from 'react';
import { Check, MessageCircle, UserPlus } from 'lucide-react';
import { newcomerRows } from '../utils/newcomers';
import { lastSeenLabel } from '../utils/presence';
import { Button } from './ui';
import AvailabilityLine from './AvailabilityLine';
import './NewcomersCard.css';

// Admin → Matching, first thing on the tab (2026-11-15, review priority 4):
// everyone who joined in the last 14 days — including those who never
// finished the wizard (Applicants and People only list onboarding docs).
// Data is what Matching already loads (users, onboarding, warmupInsights, the
// week's pairs), so the card costs no extra reads. WhatsApp opens with Polad's
// message in the learner's first-run language; nothing is sent automatically.
const SHOW = 8;
const LANG = { az: 'AZ', tr: 'TR', ru: 'RU', en: 'EN' };

export default function NewcomersCard({ users, onboarding, warmups, pairs, week, now, skip, levelShort }) {
  const [all, setAll] = useState(false);
  const obById = useMemo(() => new Map(onboarding.map((o) => [o.id, o])), [onboarding]);
  const rows = useMemo(() => {
    const booked = new Set();
    for (const p of pairs) { if (p.a) booked.add(p.a); if (p.b) booked.add(p.b); }
    return newcomerRows({ users, onboarding: obById, warmups, bookedUids: booked, now, skip });
  }, [users, obById, warmups, pairs, now, skip]);

  const waiting = rows.filter((r) => r.noFirst).length;
  const shown = all ? rows : rows.slice(0, SHOW);
  return (
    <section className="aa-panel nc" aria-label="Newcomers">
      <h3 className="aa-h"><UserPlus size={18} aria-hidden="true" /> Newcomers · last 14 days</h3>
      <p className="aa-meta">
        {rows.length === 0 ? 'Nobody joined in the last 14 days.'
          : `${rows.length} joined · ${waiting} without a first practice. Write within the first hour — the message is in their language.`}
      </p>
      {rows.length > 0 && (
        <ul className="nc-list">
          {shown.map((r) => {
            const next = r.steps.find((s) => !s.done);
            return (
              <li key={r.uid} className="nc-row">
                <div className="nc-main">
                  <span className="aa-name">
                    {r.name}
                    {r.level && <span className="aa-level">{levelShort(r.level)}</span>}
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
      )}
      {rows.length > SHOW && (
        <button type="button" className="aa-chip nc-more" onClick={() => setAll((x) => !x)}>
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </section>
  );
}
