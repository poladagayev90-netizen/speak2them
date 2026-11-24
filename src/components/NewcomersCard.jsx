import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Copy, MessageCircle, UserPlus } from 'lucide-react';
import { newcomerRows } from '../utils/newcomers';
import { ageBandShort, isMinorBand } from '../utils/matching';
import { academyGuideMessage, waHref } from '../utils/adminMessages';
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

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fallback */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function NewcomersCard({ users, onboarding, warmups, pairs, week, now, skip, levelShort }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');
  const obById = useMemo(() => new Map(onboarding.map((o) => [o.id, o])), [onboarding]);
  const rows = useMemo(() => {
    const booked = new Set();
    for (const p of pairs) { if (p.a) booked.add(p.a); if (p.b) booked.add(p.b); }
    return newcomerRows({ users, onboarding: obById, warmups, bookedUids: booked, pairs, week, now, skip });
  }, [users, obById, warmups, pairs, week, now, skip]);

  const waiting = rows.filter((r) => r.noFirst).length;
  const shown = all ? rows : rows.slice(0, SHOW);

  const handleCopy = async (key, text) => {
    if (await copyText(text)) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((c) => (c === key ? '' : c)), 1800);
    }
  };

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
            Write within the first hour — each WhatsApp or Copy button uses their language and 2 times from their own grid.
          </p>
          <ul className="nc-list">
            {shown.map((r) => {
              const next = r.steps.find((s) => !s.done);
              const age = ageBandShort(r.ageBand);
              const ch1Msg = academyGuideMessage({ lang: r.lang, name: r.name, chapterKey: 'install' });
              const ch2Msg = academyGuideMessage({ lang: r.lang, name: r.name, chapterKey: 'schedule' });
              const ch1Wa = r.rawWhatsapp ? waHref(r.rawWhatsapp, ch1Msg) : null;
              const ch2Wa = r.rawWhatsapp ? waHref(r.rawWhatsapp, ch2Msg) : null;
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
                  <div className="nc-tools">
                    <div className="nc-tools-main">
                      {r.whatsapp ? (
                        <Button as="a" size="sm" variant="secondary" href={r.whatsapp} target="_blank" rel="noopener noreferrer"
                          icon={<MessageCircle size={16} aria-hidden="true" />} aria-label={`WhatsApp ${r.name}`}>
                          WhatsApp
                        </Button>
                      ) : (
                        <span className="nc-nowa">No WhatsApp</span>
                      )}
                      <button type="button" className="nc-pill" onClick={() => handleCopy(`${r.uid}_welcome`, r.message)}>
                        {copiedKey === `${r.uid}_welcome` ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                        {copiedKey === `${r.uid}_welcome` ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="nc-acad-pills">
                      <button type="button" className="nc-pill" onClick={() => handleCopy(`${r.uid}_ch1`, ch1Msg)}>
                        {copiedKey === `${r.uid}_ch1` ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
                        T02·1
                      </button>
                      {ch1Wa && (
                        <a className="nc-pill" href={ch1Wa} target="_blank" rel="noopener noreferrer">WA T02·1</a>
                      )}
                      <button type="button" className="nc-pill" onClick={() => handleCopy(`${r.uid}_ch2`, ch2Msg)}>
                        {copiedKey === `${r.uid}_ch2` ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
                        T02·2
                      </button>
                      {ch2Wa && (
                        <a className="nc-pill" href={ch2Wa} target="_blank" rel="noopener noreferrer">WA T02·2</a>
                      )}
                    </div>
                  </div>
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
