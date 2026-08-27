import React, { useCallback, useEffect, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { cancelSlotMatch } from '../utils/teacher';
import { parseSlotId, blockLabel, dayLabel } from '../utils/practiceSlots';

// Müəllimin şagirdlərinin təsdiqlənmiş zəngləri — və onları ləğv etmək.
//
// Niyə users sənədlərindən oxunur, practiceSlots-dan yox: slot üzvlərini
// oxumaq firestore.rules-da yalnız öz sətrinə və adminə açıqdır, müəllimə
// yox. Onu müəllimə açmaq üçün qayda hər sənəddə get(users/{id}) etməli
// olardı; belə qayda LIST sorğusunu sındırır (blokda bir dənə kənar üzv
// olan kimi bütün sorğu rədd edilir) — bu tələyə əvvəl də düşülüb.
// users sənədləri isə onsuz da hər giriş etmiş istifadəçiyə oxunandır və
// randevu məlumatı (upcomingCall) məhz orada güzgülənir. Yəni müəllim öz
// şagirdinin randevusunu heç bir qayda dəyişikliyi olmadan görür, kənar
// adamların bloklarını isə görmür.
export default function TeacherUpcoming({ students }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  const ids = (students || []).map((s) => s.id).join(',');

  const load = useCallback(async () => {
    const list = (students || []);
    if (list.length === 0) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const now = Date.now();
    const found = [];
    await Promise.all(list.map(async (s) => {
      try {
        const snap = await getDoc(doc(db, 'users', s.id));
        const uc = snap.exists() ? (snap.data() || {}).upcomingCall : null;
        if (!uc || !uc.slotId) return;
        const p = parseSlotId(uc.slotId);
        // Bloku bitmiş randevu göstərilmir — server janitoru onu onsuz da
        // təmizləyir, amma o işləyənə qədər panel köhnə şey göstərməsin.
        if (!p || p.endMs <= now) return;
        found.push({
          uid: s.id,
          name: s.displayName || 'Student',
          peerName: uc.peerName || 'partner',
          slotId: uc.slotId,
          date: p.date,
          hour: p.hour,
          startMs: p.startMs,
        });
      } catch { /* bir şagird oxunmasa panel dayanmasın */ }
    }));
    found.sort((a, b) => a.startMs - b.startMs);
    setRows(found);
    setLoading(false);
  }, [students]);

  useEffect(() => { load(); }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = async (row) => {
    if (busy) return;
    setBusy(row.uid);
    setMsg(null);
    const res = await cancelSlotMatch(row.slotId, row.uid);
    setBusy(null);
    if (res.ok) {
      setMsg({ ok: true, text: `${row.name}'s call was cancelled. You can set the right pair now.` });
      load();
    } else {
      setMsg({ ok: false, text: res.errorText });
    }
  };

  if (loading && rows.length === 0) return null;
  if (rows.length === 0) return null;

  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      borderRadius: '16px', padding: '16px', marginBottom: '16px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px',
      }}>
        <CalendarCheck size={16} strokeWidth={2} aria-hidden="true" />
        Scheduled calls
      </div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
        Cancel a pair here if it is wrong — both go back to waiting in that block, and you can then set the pair you meant.
      </div>

      {msg && (
        <div style={{
          fontSize: '12px', fontWeight: 700, padding: '8px 10px', borderRadius: '10px', marginBottom: '10px',
          color: msg.ok ? 'var(--success)' : 'var(--danger)',
          background: msg.ok ? 'var(--success-bg)' : 'var(--danger-bg)',
        }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {rows.map((r) => (
          <div
            key={r.uid + r.slotId}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '10px 12px',
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {r.name} <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>↔</span> {r.peerName}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px' }}>
                {dayLabel(r.date)} · {blockLabel(r.date, r.hour)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => cancel(r)}
              disabled={!!busy}
              style={{
                flexShrink: 0, cursor: busy ? 'default' : 'pointer',
                padding: '8px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
                border: '1px solid var(--danger-bg)', background: 'var(--danger-bg)',
                color: 'var(--danger)', fontFamily: 'inherit',
              }}
            >
              {busy === r.uid ? '...' : 'Cancel'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
