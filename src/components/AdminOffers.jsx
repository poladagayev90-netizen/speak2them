import React, { useEffect, useMemo, useState } from 'react';
import { Send, CheckCircle2, XCircle, Clock3 } from 'lucide-react';
import { upcomingBlocks, SLOT_BLOCK_MS } from '../utils/practiceSlots';
import {
  WEEK_DAYS, offsetVsBaku, formatMinutes,
} from '../utils/timezone';
import { startFitMin, START_FIT_MIN } from '../utils/matching';
import {
  proposeMatch, cancelOffer, subscribeToRecentOffers, subscribeToOfferNotes, DECLINE_REASONS,
} from '../utils/matchOffers';

// Admin side of the two-sided proposal flow (see respondMatchOffer).
//
// ProposePanel lists the upcoming whole-hour starts (any hour 07–23 since
// 2026-10-07; each opens a two-hour window, so reminders, no-show marking and
// close keep working) and ranks the ones BOTH people are free at first, each shown in
// every person's own clock. Nobody is asked anything before the admin has seen
// that the time actually fits.

const bakuWeekday = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
const dayShort = (day) => WEEK_DAYS.find((d) => d.day === day)?.short || '';
const localStart = (hour, tz) => formatMinutes(hour * 60 + offsetVsBaku(tz));
const firstName = (n) => String(n || '').split(' ')[0] || '—';

export function ProposePanel({ a, b, overlapWeek }) {
  const [showAll, setShowAll] = useState(false);
  const [slotId, setSlotId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const blocks = useMemo(() => {
    const now = Date.now();
    return upcomingBlocks(now)
      .filter((blk) => blk.startMs > now + 30 * 60 * 1000) // leave time to answer
      .map((blk) => {
        const day = bakuWeekday(blk.date);
        // Free in a row from the start — the planner's 30-minute rule.
        return { ...blk, fitMin: startFitMin(overlapWeek, { day, hour: blk.hour }), day };
      });
  }, [overlapWeek]);
  const fitting = blocks.filter((blk) => blk.fitMin >= START_FIT_MIN);
  const shown = showAll ? blocks : fitting;

  // A new pair resets the form.
  useEffect(() => { setSlotId(''); setMsg(null); setNote(''); }, [a.id, b.id]);

  const send = async () => {
    setBusy(true);
    setMsg(null);
    const res = await proposeMatch({ userA: a.id, userB: b.id, slotId, note });
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: `Sent to ${firstName(a.name)} and ${firstName(b.name)}. It is booked when both confirm.` });
      setSlotId('');
      setNote('');
      return;
    }
    const who = { 'user-a-busy': a, 'user-b-busy': b, 'user-a-has-offer': a, 'user-b-has-offer': b }[res.error];
    const text = res.error?.endsWith('-busy') ? `${firstName(who.name)} already has a practice within two hours of this. Pick another time.`
      : res.error?.endsWith('-has-offer') ? `${firstName(who.name)} already has an open proposal at this time. Withdraw it first.`
        : res.errorText;
    setMsg({ ok: false, text });
  };

  return (
    <div className="aa-propose">
      <h4 className="aa-sub">Propose a practice</h4>
      {shown.length === 0 ? (
        <p className="aa-empty">
          {fitting.length === 0 ? 'No time in the next five days fits both. ' : ''}
          <button type="button" className="aa-linkbtn" onClick={() => setShowAll(true)}>Show all times</button>
        </p>
      ) : (
        <div className="aa-blocks" role="radiogroup" aria-label="Practice time">
          {shown.map((blk) => (
            <button
              key={blk.slotId}
              type="button"
              role="radio"
              aria-checked={slotId === blk.slotId}
              className={`aa-block ${slotId === blk.slotId ? 'is-on' : ''} ${blk.fitMin >= START_FIT_MIN ? '' : 'is-weak'}`}
              onClick={() => setSlotId(blk.slotId)}
            >
              <b>{dayShort(blk.day)} {String(blk.hour).padStart(2, '0')}:00</b>
              <span>Baku{blk.fitMin >= START_FIT_MIN ? ` · both free ${blk.fitMin} min` : ' · outside common time'}</span>
              <span>
                {[a, b].filter((p) => offsetVsBaku(p.timeZone) !== 0)
                  .map((p) => `${firstName(p.name)} ${localStart(blk.hour, p.timeZone)}`).join(' · ')}
              </span>
            </button>
          ))}
        </div>
      )}
      {fitting.length > 0 && (
        <button type="button" className="aa-linkbtn" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Only times that fit both' : 'Show all times'}
        </button>
      )}
      <input
        className="aa-input"
        value={note}
        maxLength={200}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note for both (e.g. topic: Travel)"
        aria-label="Note"
      />
      <button type="button" className="aa-send" disabled={!slotId || busy} onClick={send}>
        <Send size={16} /> {busy ? 'Sending…' : 'Send proposal to both'}
      </button>
      {msg && <p className={msg.ok ? 'aa-ok' : 'aa-error'}>{msg.text}</p>}
    </div>
  );
}

const STATUS = {
  pending: { label: 'Waiting', Icon: Clock3 },
  confirmed: { label: 'Booked', Icon: CheckCircle2 },
  declined: { label: 'Declined', Icon: XCircle },
  cancelled: { label: 'Withdrawn', Icon: XCircle },
  expired: { label: 'Expired', Icon: XCircle },
  failed: { label: 'Not booked', Icon: XCircle },
};

export function ProposalsPanel() {
  const [offers, setOffers] = useState([]);
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState('');
  useEffect(() => subscribeToRecentOffers(setOffers), []);
  useEffect(() => subscribeToOfferNotes(setNotes), []);

  if (!offers.length) return null;

  const withdraw = async (id) => {
    setBusy(id);
    const res = await cancelOffer(id);
    setBusy('');
    if (!res.ok) alert(res.errorText);
  };

  const now = Date.now();
  const rows = offers.map((o) => ({
    ...o,
    shownStatus: o.status === 'pending' && Number(o.startMs) + SLOT_BLOCK_MS <= now ? 'expired' : o.status,
  }));

  return (
    <section className="aa-panel">
      <h3 className="aa-h"><Send size={16} /> Proposals</h3>
      <ul className="aa-offers">
        {rows.map((o) => {
          const st = STATUS[o.shownStatus] || STATUS.pending;
          const r = o.responses || {};
          const note = notes[o.id];
          const decliner = note && (note.declinedBy === o.userA ? o.nameA : o.nameB);
          const reason = note && DECLINE_REASONS.find((x) => x.value === note.reason)?.label;
          // slotId is "YYYY-MM-DD-HH" in Baku time — read the day and hour off it.
          const when = `${dayShort(bakuWeekday(o.slotId.slice(0, 10)))} ${o.slotId.slice(-2)}:00 Baku`;
          return (
            <li key={o.id} className={`aa-offer is-${o.shownStatus}`}>
              <div className="aa-offer-top">
                <b>{firstName(o.nameA)} + {firstName(o.nameB)}</b>
                <span className="aa-muted">{when}</span>
                <span className="aa-status"><st.Icon size={14} /> {st.label}</span>
              </div>
              {o.shownStatus === 'pending' && (
                <div className="aa-offer-sub">
                  <span>{firstName(o.nameA)} {r[o.userA] === 'accepted' ? '✓' : '…'}</span>
                  <span>{firstName(o.nameB)} {r[o.userB] === 'accepted' ? '✓' : '…'}</span>
                  <button type="button" className="aa-linkbtn" disabled={busy === o.id} onClick={() => withdraw(o.id)}>
                    {busy === o.id ? 'Withdrawing…' : 'Withdraw'}
                  </button>
                </div>
              )}
              {o.shownStatus === 'declined' && decliner && (
                <div className="aa-offer-sub">{firstName(decliner)}: {reason || 'no reason'}</div>
              )}
              {o.note && <div className="aa-offer-sub aa-muted">“{o.note}”</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
