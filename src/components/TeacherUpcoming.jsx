import React, { useEffect, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { cancelSlotMatch } from '../utils/teacher';
import { parseSlotId, blockLabel, dayLabel } from '../utils/practiceSlots';

// Reuse the dashboard's live user profiles; a one-time read missed new calls.
export default function TeacherUpcoming({ students, loading = false, error = '' }) {
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const pairs = new Map();
  for (const student of students || []) {
    const call = student.upcomingCall;
    const slot = parseSlotId(call?.slotId);
    if (!slot || slot.endMs <= now) continue;
    const key = `${call.slotId}:${[student.id, call.peerUid || call.callId || 'unknown'].sort().join(':')}`;
    if (!pairs.has(key)) pairs.set(key, { key, uid: student.id, name: student.displayName || student.name || 'Student', peerName: call.peerName || 'Partner', slotId: call.slotId, ...slot });
  }
  const rows = [...pairs.values()].sort((a, b) => a.startMs - b.startMs);
  const cancel = async row => {
    if (busy) return;
    setBusy(row.key); setMsg(null);
    const result = await cancelSlotMatch(row.slotId, row.uid);
    setBusy(null);
    if (result.ok) {
      setConfirm(null);
      setMsg({ ok: true, text: `${row.name} and ${row.peerName}'s pairing was cancelled. Both are available for another pairing in that time block.` });
    } else setMsg({ ok: false, text: result.errorText });
  };
  const buttonStyle = { padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', font: 'inherit', fontSize: 12, cursor: 'pointer' };
  return (
    <section aria-label="Scheduled calls" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, marginBottom: 8 }}><CalendarCheck size={18} aria-hidden="true" /> Scheduled calls</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 12 }}>Your students’ upcoming calls appear here automatically. Times are shown in your timezone.</p>
      {msg && <p role={msg.ok ? 'status' : 'alert'} style={{ fontSize: 13, color: msg.ok ? 'var(--success)' : 'var(--danger)', marginBottom: 12 }}>{msg.text}</p>}
      {error ? <p role="alert">{error}</p> : loading ? <p role="status">Loading scheduled calls…</p> : rows.length === 0 ? <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No scheduled calls. Use “Set up a call” below to choose a pair and time.</p> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map(row => <div key={row.key} style={{ padding: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 140 }}><p style={{ fontWeight: 700, fontSize: 14, overflowWrap: 'anywhere' }}>{row.name} ↔ {row.peerName}</p><p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>{dayLabel(row.date)} · {blockLabel(row.date, row.hour)}</p></div>
            <button type="button" disabled={!!busy} style={{ ...buttonStyle, color: 'var(--danger)' }} onClick={() => { setConfirm(row.key); setMsg(null); }}>Cancel call</button>
          </div>
          {confirm === row.key && <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
            <p style={{ fontSize: 13, marginBottom: 10 }}>Cancel this pairing? Both students will return to waiting in this time block and may be paired again.</p>
            <div style={{ display: 'flex', gap: 8 }}><button type="button" disabled={!!busy} style={{ ...buttonStyle, background: 'var(--danger-solid)', color: 'var(--ink-on-danger)' }} onClick={() => cancel(row)}>{busy === row.key ? 'Cancelling…' : 'Confirm cancellation'}</button><button type="button" disabled={!!busy} style={buttonStyle} onClick={() => setConfirm(null)}>Keep call</button></div>
          </div>}
        </div>)}
      </div>
    </section>
  );
}
