import React, { useMemo, useState } from 'react';
import { CalendarClock, Check, ChevronDown } from 'lucide-react';
import { teacherSetMatch } from '../utils/teacher';
import { upcomingBlocks, dayLabel, blockLabel } from '../utils/practiceSlots';

// Müəllim əl ilə zəng təyin edir.
//
// Lövhə eyni bloka düşən İKİ nəfəri eşləşdirir — kim düşdüsə, o. Müəllimin
// istədiyi isə bunun tərsidir: "bu ikisi, bu saatda" — zəif şagirdi güclü ilə,
// eyni imtahana hazırlaşan cütü, keçən həftə görüşə bilməyənləri.
//
// Vaxt etiketləri CİHAZIN öz saat qurşağındadır (blockLabel), slotId isə Bakı
// saatına bağlıdır — Türkiyədəki müəllim "13:00–15:00" görür və server üçün o,
// dəyişməz şəkildə `...-14` slotudur.
export default function TeacherScheduler({ students }) {
  const [studentA, setStudentA] = useState('');
  const [studentB, setStudentB] = useState('');
  const [slotId, setSlotId] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }
  const [open, setOpen] = useState(false);

  // Yalnız gələcək bloklar. Siyahı beş günü əhatə edir (SLOT_HORIZON_DAYS) —
  // serverdəki eyni üfüqlə, ona görə burada görünən heç bir seçim rədd edilmir.
  const blocks = useMemo(() => upcomingBlocks(), []);

  const ready = studentA && studentB && slotId && studentA !== studentB;

  const submit = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setMsg(null);
    const res = await teacherSetMatch(studentA, studentB, slotId);
    setSaving(false);
    if (!res.ok) {
      setMsg({ ok: false, text: res.errorText });
      return;
    }
    const nameOf = (id) => students.find((s) => s.id === id)?.displayName || 'Student';
    setMsg({
      ok: true,
      text: res.data?.alreadyPaired
        ? `${nameOf(studentA)} and ${nameOf(studentB)} were already scheduled for that time.`
        : `Done — ${nameOf(studentA)} and ${nameOf(studentB)} have been notified.`,
    });
    // Vaxt seçimi qalır: müəllim adətən eyni saata bir neçə cüt qurur, hər
    // dəfə saatı yenidən seçmək lazım olmasın.
    setStudentA('');
    setStudentB('');
  };

  const selectStyle = {
    width: '100%', padding: '11px 12px', borderRadius: '12px',
    border: '1px solid var(--border)', background: 'var(--bg-input)',
    color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box', appearance: 'none',
  };
  const labelStyle = {
    display: 'block', fontSize: '12px', fontWeight: 700,
    color: 'var(--text-secondary)', margin: '0 0 6px 2px',
  };

  // İki nəfərdən az şagirdlə eşləşdiriləcək cüt yoxdur — boş forma göstərmək
  // yalnız çaşdırardı.
  if (students.length < 2) return null;

  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      borderRadius: '16px', padding: '16px', marginBottom: '16px',
    }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', background: 'none', border: 'none', padding: 0,
          display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
          color: 'var(--text-primary)', fontFamily: 'inherit', textAlign: 'left',
        }}
        aria-expanded={open}
      >
        <CalendarClock size={18} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: '14px', fontWeight: 800 }}>Set up a call</span>
        <ChevronDown
          size={18}
          strokeWidth={2}
          aria-hidden="true"
          style={{
            flexShrink: 0, color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms',
          }}
        />
      </button>

      {!open && (
        <p style={{ margin: '8px 0 0 28px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
          Pair two of your students at a time you choose.
        </p>
      )}

      {open && (
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle} htmlFor="sched-a">First student</label>
            <select
              id="sched-a"
              style={selectStyle}
              value={studentA}
              onChange={(e) => { setStudentA(e.target.value); setMsg(null); }}
            >
              <option value="">Choose…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id} disabled={s.id === studentB}>
                  {s.displayName || 'Student'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle} htmlFor="sched-b">Second student</label>
            <select
              id="sched-b"
              style={selectStyle}
              value={studentB}
              onChange={(e) => { setStudentB(e.target.value); setMsg(null); }}
            >
              <option value="">Choose…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id} disabled={s.id === studentA}>
                  {s.displayName || 'Student'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle} htmlFor="sched-time">Time</label>
            <select
              id="sched-time"
              style={selectStyle}
              value={slotId}
              onChange={(e) => { setSlotId(e.target.value); setMsg(null); }}
            >
              <option value="">Choose…</option>
              {blocks.map((b) => (
                <option key={b.slotId} value={b.slotId}>
                  {`${dayLabel(b.date)} · ${blockLabel(b.date, b.hour)}`}
                </option>
              ))}
            </select>
            <p style={{ margin: '6px 2px 0', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
              Shown in your own timezone. Each student sees it in theirs.
            </p>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={!ready || saving}
            style={{
              width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
              background: ready ? 'var(--accent)' : 'var(--bg-input)',
              color: ready ? 'var(--text-on-accent)' : 'var(--text-muted)',
              fontSize: '15px', fontWeight: 800, fontFamily: 'inherit',
              cursor: ready && !saving ? 'pointer' : 'default',
            }}
          >
            {saving ? 'Setting up…' : 'Set the call'}
          </button>

          {msg && (
            <p style={{
              margin: 0, fontSize: '13px', fontWeight: 600, lineHeight: 1.5,
              display: 'flex', alignItems: 'flex-start', gap: '6px',
              color: msg.ok ? 'var(--success)' : 'var(--danger)',
            }}>
              {msg.ok && <Check size={14} strokeWidth={3} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />}
              {msg.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
