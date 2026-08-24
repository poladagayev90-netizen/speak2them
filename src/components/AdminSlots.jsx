import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Star } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { boardDates, subscribeToBoard, parseSlotId, dayLabel, blockLabel, POPULAR_HOUR } from '../utils/practiceSlots';

// Bir slotun üzvlərini oxuyur və göstərir. members subkolleksiyası admin üçün
// rules-da açıqdır (isAdmin) — bax firestore.rules practiceSlots.
//
// SCROLL QEYDİ: bu listener PARENT state-inə heç nə YAZMIR (əvvəl onCount ilə
// sayları yuxarı ötürürdü → hər snapshot bütün siyahını yenidən render edirdi
// və scroll ilişirdi). Saylar artıq slot sənədinin özündən (board) oxunur.
function AdminSlotMembers({ slotId, usersMap }) {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'practiceSlots', slotId, 'members'), (snap) => {
      setMembers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
    });
    return unsub;
  }, [slotId]);

  if (members.length === 0) return <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>Empty</span>;

  // Eyni ad birdən çox üzvdə varsa (məs. 3 "Sebine") kimin-kim olduğu qarışırdı.
  // Ad təkrarlanırsa fərqləndirici əlavə olunur: email prefiksi, yoxsa qısa uid.
  const nameCounts = {};
  members.forEach((m) => {
    const n = (usersMap[m.uid]?.name || 'Anonim').toLowerCase();
    nameCounts[n] = (nameCounts[n] || 0) + 1;
  });
  const labelOf = (uid) => {
    const u = usersMap[uid] || {};
    const name = u.name || 'Anonim';
    if (nameCounts[name.toLowerCase()] > 1) {
      const tag = (u.email ? u.email.split('@')[0] : uid).slice(0, 6);
      return `${name} · ${tag}`;
    }
    return name;
  };
  const levelOf = (uid) => usersMap[uid]?.level || '?';

  // Eşləşmişləri CÜTLƏRƏ topla (A ↔ B bir sətir), tək gözləyənləri ayrıca göstər.
  const byId = new Map(members.map((m) => [m.uid, m]));
  const seen = new Set();
  const pairs = [];
  const waiting = [];
  members.forEach((m) => {
    if (m.pairedWith && byId.has(m.pairedWith)) {
      const key = [m.uid, m.pairedWith].sort().join('_');
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push([m, byId.get(m.pairedWith)]);
    } else if (!m.pairedWith) {
      waiting.push(m);
    }
  });

  const nameStyle = { color: 'var(--text-primary)', fontWeight: 600 };
  const lvlStyle = { color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 400 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
      {pairs.map(([a, b]) => (
        <div key={a.uid + b.uid} style={{
          background: 'var(--success-bg)', border: '1px solid var(--success)',
          padding: '10px 12px', borderRadius: '8px', fontSize: '14px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: 'var(--success)', fontWeight: 800 }}>✓</span>
          <span style={nameStyle}>{labelOf(a.uid)} <span style={lvlStyle}>({levelOf(a.uid)})</span></span>
          <span style={{ color: 'var(--success)', flexShrink: 0 }}>↔</span>
          <span style={nameStyle}>{labelOf(b.uid)} <span style={lvlStyle}>({levelOf(b.uid)})</span></span>
        </div>
      ))}
      {waiting.map((m) => (
        <div key={m.uid} style={{
          background: 'var(--warning-bg)', border: '1px solid var(--warning)',
          padding: '8px 12px', borderRadius: '8px', fontSize: '14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={nameStyle}>{labelOf(m.uid)} <span style={lvlStyle}>({levelOf(m.uid)})</span></span>
          <span style={{ color: 'var(--warning)', fontWeight: 600, fontSize: '13px' }}>Waiting alone</span>
        </div>
      ))}
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={{
      flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--bg-secondary)',
      borderRadius: 10, padding: '10px 8px', textAlign: 'center',
    }}>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color }}>{value}</p>
      <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</p>
    </div>
  );
}

export default function AdminSlots({ users }) {
  const [board, setBoard] = useState({});

  const usersMap = useMemo(() => {
    const map = {};
    users.forEach((u) => { map[u.uid || u.id] = u; });
    return map;
  }, [users]);

  useEffect(() => {
    const dates = boardDates();
    return subscribeToBoard(dates, setBoard);
  }, []);

  // Saylar slot sənədinin ÖZÜNDƏN gəlir (waitingCount/matchedCount) — üzv
  // listener-lərindən yuxarı ötürülmür, ona görə render scroll zamanı sabit qalır.
  const countOf = useCallback((slotId) => {
    const d = board[slotId] || {};
    const paired = Number(d.matchedCount) || 0;
    const total = paired + (Number(d.waitingCount) || 0);
    return { total, paired };
  }, [board]);

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
    Object.values(board).forEach((d) => {
      const p = Number(d.matchedCount) || 0;
      people += p + (Number(d.waitingCount) || 0);
      paired += p;
    });
    return { people, paired, waiting: people - paired };
  }, [board]);

  if (dates.length === 0) {
    return <div style={{ color: 'var(--text-secondary)', padding: '20px', textAlign: 'center' }}>Nobody has picked a time for the next three days yet.</div>;
  }

  const dayTotals = (date) => byDay[date].reduce((acc, s) => {
    const c = countOf(s.slotId);
    acc.total += c.total; acc.paired += c.paired; return acc;
  }, { total: 0, paired: 0 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Ümumi xülasə — 3 günün cəmi */}
      <div style={{ display: 'flex', gap: 8 }}>
        <StatPill label="Signed up" value={totals.people} color="var(--text-primary)" />
        <StatPill label="Matched" value={totals.paired} color="var(--success)" />
        <StatPill label="Waiting" value={totals.waiting} color="var(--warning)" />
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
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>
                {dayLabel(date)} <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>{date}</span>
              </h3>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                {dt.total} people · {dt.paired} matched
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {byDay[date].map((s) => {
                const c = countOf(s.slotId);
                const popular = s.hour === POPULAR_HOUR;
                return (
                  <div key={s.slotId} style={{
                    background: 'var(--bg-card)',
                    border: `1px solid ${popular ? 'var(--border)' : 'var(--bg-secondary)'}`,
                    padding: '14px', borderRadius: '12px',
                  }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderBottom: '1px solid var(--bg-secondary)', paddingBottom: '8px',
                    }}>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '15px' }}>
                        {popular && <Star size={11} strokeWidth={2} aria-label="Busiest hour" style={{ marginRight: 4, color: 'var(--warning)' }} />}
                        {blockLabel(s.hour)}
                      </strong>
                      <span style={{ fontSize: 12, color: c.total ? 'var(--text-secondary)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {c.total ? `${c.total} people${c.paired ? ` · ${c.paired} matched` : ''}` : 'empty'}
                      </span>
                    </div>
                    <AdminSlotMembers slotId={s.slotId} usersMap={usersMap} />
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
