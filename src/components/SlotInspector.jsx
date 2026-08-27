import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { blockLabel, dayLabel } from '../utils/practiceSlots';
import { cancelSlotMatch } from '../utils/teacher';

// Admin lövhədəki bloka toxunanda açılan pəncərə: HƏMİN blokda kim var.
//
// Niyə lövhənin özündə, admin panelində deyil: admin panelindəki "Sessions"
// tabı bütün günləri, bütün blokları və hər blokun bütün üzvlərini birdən
// açır — 119 istifadəçidə bu, sual verilməmiş bir divardır. Sual isə həmişə
// konkretdir: "sabah 21:00-da kim var?" Ona görə cavab da məhz o blokun
// üstündə verilir.
//
// Oxunuş firestore.rules-da açıqdır: practiceSlots/{id}/members üçün
// `allow read: if isOwnDoc(memberId) || isAdmin()`. Adi istifadəçi bu
// komponenti heç vaxt görmür (PracticeBoard yalnız adminə açır), görsəydi də
// qaydalar öz sətrindən başqasını qaytarmazdı.
export default function SlotInspector({ slotId, date, hour, onClose, canCancel = false }) {
  const [members, setMembers] = useState(null); // null = yüklənir
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(null);   // ləğv edilən şagirdin uid-i
  const [msg, setMsg] = useState(null);     // { ok, text }

  // Ləğv serverdə cütü söküb hər ikisini "waiting"-ə qaytarır; onSnapshot
  // dinlədiyi üçün siyahı özü yenilənir, burada əl ilə state düzəltmirik.
  const cancel = async (uid) => {
    if (busy) return;
    setBusy(uid);
    setMsg(null);
    const res = await cancelSlotMatch(slotId, uid);
    setBusy(null);
    setMsg(res.ok
      ? { ok: true, text: 'Cancelled — both are back to waiting in this block.' }
      : { ok: false, text: res.errorText });
  };

  useEffect(() => {
    if (!slotId) return undefined;
    setMembers(null);
    setError(false);
    return onSnapshot(
      collection(db, 'practiceSlots', slotId, 'members'),
      (snap) => setMembers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() || {}) }))),
      () => { setError(true); setMembers([]); },
    );
  }, [slotId]);

  // Cütlər bir sətirdə, tək gözləyənlər ayrıca. pairedWith qarşılıqlıdır, ona
  // görə hər cütü yalnız BİR dəfə çap etmək üçün görülənlər yığılır.
  const seen = new Set();
  const pairs = [];
  const alone = [];
  (members || []).forEach((m) => {
    if (seen.has(m.uid)) return;
    const peer = m.pairedWith && (members || []).find((x) => x.uid === m.pairedWith);
    if (peer) {
      seen.add(m.uid); seen.add(peer.uid);
      pairs.push([m, peer]);
    } else {
      seen.add(m.uid);
      alone.push(m);
    }
  });

  const Person = ({ m }) => (
    <Link
      to={`/user/${m.uid}`}
      style={{
        textDecoration: 'none', color: 'var(--text-primary)',
        fontWeight: 700, fontSize: '14px', minWidth: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}
    >
      {m.name || 'Anonymous'}
      {m.level ? <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}> ({m.level})</span> : null}
    </Link>
  );

  const row = {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 12px', borderRadius: '12px',
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Who is in this block"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 'var(--z-modal)',
        background: 'var(--overlay)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '520px', boxSizing: 'border-box',
          background: 'var(--bg-card)', borderRadius: '18px 18px 0 0',
          border: '1px solid var(--border)', boxShadow: 'var(--glass-lift)',
          padding: '16px',
          paddingBottom: 'calc(16px + var(--safe-area-bottom, 0px))',
          maxHeight: '70vh', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {blockLabel(date, hour)}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px' }}>
              {dayLabel(date)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              flexShrink: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', borderRadius: '10px', padding: '8px',
              cursor: 'pointer', display: 'flex',
            }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', minHeight: 0, marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {members === null && (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>Loading…</div>
          )}
          {error && (
            <div style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: 600 }}>
              Could not read this block.
            </div>
          )}
          {members !== null && !error && members.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>
              Nobody has picked this block.
            </div>
          )}

          {msg && (
            <div style={{
              fontSize: '12px', fontWeight: 700, padding: '8px 10px', borderRadius: '10px',
              color: msg.ok ? 'var(--success)' : 'var(--danger)',
              background: msg.ok ? 'var(--success-bg)' : 'var(--danger-bg)',
            }}>
              {msg.text}
            </div>
          )}

          {pairs.map(([a, b]) => (
            <div key={a.uid + b.uid} style={{ ...row, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--success)', fontWeight: 800, flexShrink: 0 }}>✓</span>
              <Person m={a} />
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>↔</span>
              <Person m={b} />
              {canCancel && (
                <button
                  type="button"
                  onClick={() => cancel(a.uid)}
                  disabled={!!busy}
                  style={{
                    marginLeft: 'auto', flexShrink: 0, cursor: busy ? 'default' : 'pointer',
                    padding: '6px 10px', borderRadius: '9px', fontSize: '12px', fontWeight: 700,
                    border: '1px solid var(--danger-bg)', background: 'var(--danger-bg)',
                    color: 'var(--danger)', fontFamily: 'inherit',
                  }}
                >
                  {busy === a.uid ? '...' : 'Cancel'}
                </button>
              )}
            </div>
          ))}

          {alone.map((m) => (
            <div key={m.uid} style={row}>
              <Person m={m} />
              <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>
                Waiting
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
