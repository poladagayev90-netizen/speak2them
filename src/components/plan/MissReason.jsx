import React, { useEffect, useState } from 'react';
import { CalendarX2, Check } from 'lucide-react';
import { Button } from '../ui';
import useMissPrompt, { saveMissReason, saveNeverHour } from '../../hooks/useMissPrompt';
import { NOTE_MAX, reasonsFor } from '../../utils/missReasons';
import { dayHourLabel, ownTimeOfSlot } from '../../utils/weekProfile';
import { practiceText } from '../../data/practiceCopy';
import './plan.css';

const whenOf = (ms, lang = 'en') => {
  const d = new Date(Number(ms));
  const wd = practiceText(lang, `wday.${d.getDay()}`);
  const mon = practiceText(lang, `mon.${d.getMonth()}`);
  const hhmm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${wd}, ${d.getDate()} ${mon}, ${hhmm}`;
};

// The question and its answers, shared by the card below and a booking's
// «change the time» (BookingRow). onDone(reason) after saving; onSkip.
export function ReasonPicker({ uid, kind, eventId, slotId, onboarding = null, onSaving, onDone, onSkip, compact = false, lang = 'en' }) {
  const pt = (k, v) => practiceText(lang, k, v);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [offerNever, setOfferNever] = useState(null);
  const [neverDone, setNeverDone] = useState(false);

  const send = async () => {
    setBusy(true); setError('');
    try {
      onSaving?.();
      await saveMissReason(uid, { eventId, kind, reason, note, slotId });
      const own = ownTimeOfSlot(slotId, onboarding?.timeZone);
      if (reason === 'wrong_time' && onboarding && own) setOfferNever(own);
      else onDone?.(reason);
    } catch {
      setError(pt('mr.errSend'));
    }
    setBusy(false);
  };

  const markNever = async () => {
    setBusy(true); setError('');
    try {
      await saveNeverHour(uid, onboarding, offerNever);
      setNeverDone(true);
    } catch {
      setError(pt('mr.errSave'));
    }
    setBusy(false);
  };

  if (offerNever) {
    const label = dayHourLabel(offerNever, lang);
    return (
      <div className="mr-body" role="status">
        <p className="mr-thanks"><Check size={16} aria-hidden="true" /> {pt('mr.thanks')}</p>
        {neverDone ? (
          <>
            <p className="mr-sub">{pt('mr.neverDone', { label })}</p>
            <div className="mr-actions"><Button size="sm" variant="secondary" onClick={() => onDone?.('wrong_time')}>{pt('mr.done')}</Button></div>
          </>
        ) : (
          <>
            <p className="mr-sub">{pt('mr.neverAsk', { label })}</p>
            <div className="mr-actions">
              <Button size="sm" onClick={markNever} disabled={busy}>{busy ? pt('saving') : pt('mr.markNever', { label })}</Button>
              <Button size="sm" variant="ghost" onClick={() => onDone?.('wrong_time')} disabled={busy}>{pt('mr.once')}</Button>
            </div>
          </>
        )}
        {error && <p className="pl-notice pl-notice--error" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className={`mr-body${compact ? ' mr-body--compact' : ''}`}>
      <div className="mr-reasons" role="group" aria-label={pt('mr.title')}>
        {reasonsFor(kind).map((r) => (
          <button key={r.value} type="button" className={`mr-reason${reason === r.value ? ' is-on' : ''}`}
            aria-pressed={reason === r.value} onClick={() => setReason(r.value)}>
            {pt(`mr.r.${r.value}`)}
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
          placeholder={pt('mr.notePh')}
          aria-label={pt('mr.notePh')}
        />
      )}
      <div className="mr-actions">
        <Button size="sm" onClick={send} disabled={!reason || busy}>{busy ? pt('mr.sending') : pt('mr.send')}</Button>
        <Button size="sm" variant="ghost" onClick={onSkip} disabled={busy}>{pt('mr.later')}</Button>
      </div>
      {error && <p className="pl-notice pl-notice--error" role="alert">{error}</p>}
    </div>
  );
}

// Today / Plan: the newest unanswered miss or cancel of the last two weeks.
export default function MissReasonCard({ uid, onboarding, now, lang = 'en' }) {
  const pt = (k, v) => practiceText(lang, k, v);
  const { event, dismiss, answered } = useMissPrompt(uid, now);
  const [current, setCurrent] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (!current && event) setCurrent(event); }, [event, current]);
  useEffect(() => {
    if (current && !saved && answered && answered.has(current.id)) setCurrent(null);
  }, [current, saved, answered]);
  const finish = () => { setSaved(false); setCurrent(null); };
  if (!current) return null;
  const qKey = ['no_show', 'late_cancel', 'cancelled', 'time_change'].includes(current.outcome)
    ? `mr.q.${current.outcome}`
    : 'mr.q.default';
  return (
    <section className="pl-card mr" aria-label={pt('mr.title')}>
      <p className="pl-kicker"><CalendarX2 size={14} aria-hidden="true" /> {pt(qKey)} · {whenOf(current.atMs, lang)}</p>
      <p className="mr-title">{pt('mr.title')}</p>
      <p className="mr-sub">{pt('mr.sub')}</p>
      <ReasonPicker
        key={current.id}
        uid={uid}
        kind={current.outcome}
        eventId={current.id}
        slotId={current.slotId}
        onboarding={onboarding}
        lang={lang}
        onSaving={() => setSaved(true)}
        onDone={finish}
        onSkip={() => { dismiss(current.id); finish(); }}
      />
    </section>
  );
}
