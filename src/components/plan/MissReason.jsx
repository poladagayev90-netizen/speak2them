import React, { useEffect, useState } from 'react';
import { CalendarX2, Check } from 'lucide-react';
import { Button } from '../ui';
import useMissPrompt, { saveMissReason, saveNeverHour } from '../../hooks/useMissPrompt';
import { NOTE_MAX, questionFor, reasonsFor } from '../../utils/missReasons';
import { dayHourLabel, ownTimeOfSlot } from '../../utils/weekProfile';
import './plan.css';

// «What happened?» (Faza 3). Asked once per event, never as blame: the
// answer goes to the team only, and «the time was wrong for me» is the one
// that changes anything — the planner tries another hour first, and one tap
// can make that hour Never for good.
const whenOf = (ms) => new Date(Number(ms)).toLocaleString([], {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
});

// The question and its answers, shared by the card below and a booking's
// «change the time» (BookingRow). onDone(reason) after saving; onSkip.
export function ReasonPicker({ uid, kind, eventId, slotId, onboarding = null, onSaving, onDone, onSkip, compact = false }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // After «wrong time»: offer to make that hour Never (own clock).
  const [offerNever, setOfferNever] = useState(null);
  const [neverDone, setNeverDone] = useState(false);

  const send = async () => {
    setBusy(true); setError('');
    try {
      // Before the write: its own snapshot arrives before the promise resolves.
      onSaving?.();
      await saveMissReason(uid, { eventId, kind, reason, note, slotId });
      const own = ownTimeOfSlot(slotId, onboarding?.timeZone);
      if (reason === 'wrong_time' && onboarding && own) setOfferNever(own);
      else onDone?.(reason);
    } catch {
      setError('Could not send. Check your connection and try again.');
    }
    setBusy(false);
  };

  const markNever = async () => {
    setBusy(true); setError('');
    try {
      await saveNeverHour(uid, onboarding, offerNever);
      setNeverDone(true);
    } catch {
      setError('Could not save. Check your connection and try again.');
    }
    setBusy(false);
  };

  if (offerNever) {
    const label = dayHourLabel(offerNever);
    return (
      <div className="mr-body" role="status">
        <p className="mr-thanks"><Check size={16} aria-hidden="true" /> Thanks — we will try other times first.</p>
        {neverDone ? (
          <>
            <p className="mr-sub">{label} is now Never in your usual week. You can change it in Plan → Free times.</p>
            <div className="mr-actions"><Button size="sm" variant="secondary" onClick={() => onDone?.('wrong_time')}>Done</Button></div>
          </>
        ) : (
          <>
            <p className="mr-sub">Is {label} never a good time for you?</p>
            <div className="mr-actions">
              <Button size="sm" onClick={markNever} disabled={busy}>{busy ? 'Saving…' : `Mark ${label} as Never`}</Button>
              <Button size="sm" variant="ghost" onClick={() => onDone?.('wrong_time')} disabled={busy}>No, just this once</Button>
            </div>
          </>
        )}
        {error && <p className="pl-notice pl-notice--error" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className={`mr-body${compact ? ' mr-body--compact' : ''}`}>
      <div className="mr-reasons" role="group" aria-label="What happened?">
        {reasonsFor(kind).map((r) => (
          <button key={r.value} type="button" className={`mr-reason${reason === r.value ? ' is-on' : ''}`}
            aria-pressed={reason === r.value} onClick={() => setReason(r.value)}>
            {r.label}
          </button>
        ))}
      </div>
      {reason && (
        <textarea
          className="mr-note"
          rows={2}
          maxLength={NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything to add? (optional)"
          aria-label="Anything to add? (optional)"
        />
      )}
      <div className="mr-actions">
        <Button size="sm" onClick={send} disabled={!reason || busy}>{busy ? 'Sending…' : 'Send'}</Button>
        <Button size="sm" variant="ghost" onClick={onSkip} disabled={busy}>Not now</Button>
      </div>
      {error && <p className="pl-notice pl-notice--error" role="alert">{error}</p>}
    </div>
  );
}

// Today / Plan: the newest unanswered miss or cancel of the last two weeks.
export default function MissReasonCard({ uid, onboarding, now }) {
  const { event, dismiss, answered } = useMissPrompt(uid, now);
  // The event on screen stays until the learner is finished with it: saving
  // the answer takes it out of the list at once, and the «Mark … as Never»
  // follow-up still has to be shown. One answered elsewhere (another device,
  // or a cached list that came in late) is dropped — unless it is ours.
  const [current, setCurrent] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (!current && event) setCurrent(event); }, [event, current]);
  useEffect(() => {
    if (current && !saved && answered && answered.has(current.id)) setCurrent(null);
  }, [current, saved, answered]);
  const finish = () => { setSaved(false); setCurrent(null); };
  if (!current) return null;
  return (
    <section className="pl-card mr" aria-label="What happened?">
      <p className="pl-kicker"><CalendarX2 size={14} aria-hidden="true" /> {questionFor(current.outcome)} · {whenOf(current.atMs)}</p>
      <p className="mr-title">What happened?</p>
      <p className="mr-sub">Only the SpeakLab team sees your answer. It helps us plan times that work for you.</p>
      <ReasonPicker
        key={current.id}
        uid={uid}
        kind={current.outcome}
        eventId={current.id}
        slotId={current.slotId}
        onboarding={onboarding}
        onSaving={() => setSaved(true)}
        onDone={finish}
        onSkip={() => { dismiss(current.id); finish(); }}
      />
    </section>
  );
}
