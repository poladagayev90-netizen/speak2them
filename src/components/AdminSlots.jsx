import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { boardDates, subscribeToBoard, parseSlotId, dayLabel, blockLabel, POPULAR_HOUR } from '../utils/practiceSlots';

// Bir slotun üzvlərini oxuyur, göstərir və sayları yuxarı ötürür (onCount) ki,
// gün başlığı və ümumi xülasə cəmləri hesablaya bilsin. members subkolleksiyası
// admin üçün rules-da açıqdır (isAdmin) — bax firestore.rules practiceSlots.
function AdminSlotMembers({ slotId, usersMap, onCount }) {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'practiceSlots', slotId, 'members'), (snap) => {
      setMembers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
    });
    return unsub;
  }, [slotId]);

  useEffect(() => {
    const paired = members.filter((m) => m.pairedWith).length;
    onCount(slotId, { total: members.length, paired });
  }, [members, slotId, onCount]);

  if (members.length === 0) return <span style={{ color: '#64748b', fontSize: '13px' }}>Boşdur</span>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
      {members.map((m) => {
        const u = usersMap[m.uid] || {};
        return (
          <div key={m.uid} style={{
            background: m.pairedWith ? '#052e16' : '#422006',
            border: `1px solid ${m.pairedWith ? '#166534' : '#854d0e'}`,
            padding: '8px 12px', borderRadius: '8px', fontSize: '14px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ color: '#f8fafc', fontWeight: 500 }}>
              {u.name || 'Anonim'} <span style={{ color: '#94a3b8', fontSize: '12px' }}>({u.level || '?'})</span>
            </span>
            <span style={{ color: m.pairedWith ? '#4ade80' : '#facc15', fontWeight: 600, fontSize: '13px' }}>
              {m.pairedWith ? `✓ Eşləşib (${usersMap[m.pairedWith]?.name || '?'})` : '⏳ Gözləyir'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={{
      flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid #2e2e50',
      borderRadius: 10, padding: '10px 8px', textAlign: 'center',
    }}>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color }}>{value}</p>
      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>{label}</p>
    </div>
  );
}

export default function AdminSlots({ users }) {
  const [board, setBoard] = useState({});
  const [counts, setCounts] = useState({}); // slotId -> { total, paired }

  const usersMap = useMemo(() => {
    const map = {};
    users.forEach((u) => { map[u.uid || u.id] = u; });
    return map;
  }, [users]);

  useEffect(() => {
    const dates = boardDates();
    return subscribeToBoard(dates, setBoard);
  }, []);

  const onCount = useCallback((slotId, c) => {
    setCounts((prev) => {
      const cur = prev[slotId];
      if (cur && cur.total === c.total && cur.paired === c.paired) return prev; // dəyişməyibsə re-render yox
      return { ...prev, [slotId]: c };
    });
  }, []);

  // slotId-ləri günə görə qruplaşdır, hər gün daxilində saata görə sırala.
  const byDay = useMemo(() => {
    const groups = {};
    Object.keys(board).forEach((slotId) => {
      const p = parseSlotId(slotId);
      if (!p) return;
      (groups[p.date] = groups[p.date] || []).push({ slotId, ...p });
    });
    Object.values(groups).forEach((arr) => arr.sort((a, b) => a.hour - b.hour));
    return groups;
  }, [board]);

  const dates = Object.keys(byDay).sort();

  const totals = useMemo(() => {
    let people = 0, paired = 0;
    for (const c of Object.values(counts)) { people += c.total; paired += c.paired; }
    return { people, paired, waiting: people - paired };
  }, [counts]);

  if (dates.length === 0) {
    return <div style={{ color: '#94a3b8', padding: '20px', textAlign: 'center' }}>Gələcək 3 gün üçün hələ heç kim vaxt seçməyib.</div>;
  }

  const dayTotals = (date) => byDay[date].reduce((acc, s) => {
    const c = counts[s.slotId] || { total: 0, paired: 0 };
    acc.total += c.total; acc.paired += c.paired; return acc;
  }, { total: 0, paired: 0 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Ümumi xülasə — 3 günün cəmi */}
      <div style={{ display: 'flex', gap: 8 }}>
        <StatPill label="Yazılan" value={totals.people} color="#e2e8f0" />
        <StatPill label="Eşləşib" value={totals.paired} color="#4ade80" />
        <StatPill label="Gözləyir" value={totals.waiting} color="#facc15" />
      </div>

      {dates.map((date) => {
        const dt = dayTotals(date);
        return (
          <div key={date}>
            {/* Gün başlığı */}
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              margin: '0 2px 8px',
            }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#c4bbff' }}>
                {dayLabel(date)} <span style={{ color: '#64748b', fontSize: 12, fontWeight: 600 }}>{date}</span>
              </h3>
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                {dt.total} nəfər · {dt.paired} eşləşib
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {byDay[date].map((s) => {
                const c = counts[s.slotId] || { total: 0, paired: 0 };
                const popular = s.hour === POPULAR_HOUR;
                return (
                  <div key={s.slotId} style={{
                    background: '#1a1a2e',
                    border: `1px solid ${popular ? '#7c6ff755' : '#2e2e50'}`,
                    padding: '14px', borderRadius: '12px',
                  }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderBottom: '1px solid #2e2e50', paddingBottom: '8px',
                    }}>
                      <strong style={{ color: '#e2e8f0', fontSize: '15px' }}>
                        {popular && <span title="Populyar saat" style={{ marginRight: 4 }}>⭐</span>}
                        {blockLabel(s.hour)}
                      </strong>
                      <span style={{ fontSize: 12, color: c.total ? '#94a3b8' : '#475569', fontWeight: 600 }}>
                        {c.total ? `${c.total} nəfər${c.paired ? ` · ${c.paired} eşləşib` : ''}` : 'boş'}
                      </span>
                    </div>
                    <AdminSlotMembers slotId={s.slotId} usersMap={usersMap} onCount={onCount} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
