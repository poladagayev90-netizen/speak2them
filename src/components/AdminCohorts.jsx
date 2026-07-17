import React, { useEffect, useMemo, useState } from 'react';
import {
  collection, onSnapshot, query, where, doc, setDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { subscribeToCycle } from '../utils/cycle';
import {
  subscribeToSessionConfig, getActiveDays, bakuDateStr, bakuWeekday,
} from '../utils/sessionSchedule';
import { COURSE_TOPIC_COUNT } from '../utils/courseProgress';

// Son N aktiv (sessiya/bonus) günün Bakı tarixləri, bugündən geriyə.
function lastActiveDates(config, n, nowMs = Date.now()) {
  const days = getActiveDays(config);
  if (days.size === 0) return [];
  const out = [];
  for (let i = 0; i < 60 && out.length < n; i++) {
    const dateStr = bakuDateStr(nowMs - i * 24 * 60 * 60 * 1000);
    if (days.has(bakuWeekday(dateStr))) out.push(dateStr);
  }
  return out;
}

// lastCallDate `new Date().toDateString()` formatında saxlanır (streak sistemi);
// millis-ə çeviririk. Yoxdursa null (heç zəng etməyib).
function lastCallMs(u) {
  if (!u.lastCallDate) return null;
  const ms = Date.parse(u.lastCallDate);
  return Number.isFinite(ms) ? ms : null;
}

// Admin panelin "Kohortlar" tabı: kohort yarat/başla-dayandır, kodu kopyala,
// kohort seç → üzv siyahısı (son iştirak + topicsCompleted). Son 2 sessiyada
// görünməyən üzvlər qırmızı işarələnir — erkən müdaxilə siqnalı. Bütün
// oxu/yazılar mövcud admin rules-u ilə gedir; yeni endpoint yoxdur.
export default function AdminCohorts() {
  const [cohorts, setCohorts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [members, setMembers] = useState([]);
  const [cycle, setCycle] = useState(null);
  const [sessionConfig, setSessionConfig] = useState(null);
  const [copied, setCopied] = useState('');
  // Yaratma formu
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newMax, setNewMax] = useState('12');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => onSnapshot(collection(db, 'cohorts'), (snap) => {
    setCohorts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }), []);
  useEffect(() => subscribeToCycle(setCycle), []);
  useEffect(() => subscribeToSessionConfig(setSessionConfig), []);

  useEffect(() => {
    if (!selectedId) { setMembers([]); return undefined; }
    return onSnapshot(
      query(collection(db, 'users'), where('cohortId', '==', selectedId)),
      (snap) => setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.error('[AdminCohorts] members', e)
    );
  }, [selectedId]);

  // "Sönmə" həddi: sondan 2-ci aktiv günün başlanğıcı. Ondan köhnə (və ya heç
  // olmayan) son iştirak = son 2 sessiyanı buraxıb.
  const fadeCutoffMs = useMemo(() => {
    if (!sessionConfig) return null;
    const dates = lastActiveDates(sessionConfig, 2);
    if (dates.length < 2) return null;
    return Date.parse(`${dates[1]}T00:00:00+04:00`);
  }, [sessionConfig]);

  const tick = cycle && Number.isFinite(cycle.cycleTick) ? Number(cycle.cycleTick) : null;

  const decorated = members.map((m) => {
    const completed = (tick !== null && Number.isFinite(m.startTick))
      ? Math.max(0, Math.min(COURSE_TOPIC_COUNT, tick - m.startTick))
      : null;
    const callMs = lastCallMs(m);
    const fading = fadeCutoffMs !== null && (callMs === null || callMs < fadeCutoffMs);
    return { ...m, completed, callMs, fading };
  }).sort((a, b) => (b.fading - a.fading) || ((a.name || '').localeCompare(b.name || '')));

  const createCohort = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    const code = newCode.trim().toUpperCase();
    setFormError('');
    if (name.length < 2) { setFormError('Ad çox qısadır.'); return; }
    if (code.length < 4 || code.length > 40) { setFormError('Kod 4–40 simvol olmalıdır.'); return; }
    if (cohorts.some((c) => (c.code || '').toUpperCase() === code)) {
      setFormError('Bu kod artıq başqa kohortda var.');
      return;
    }
    setCreating(true);
    try {
      await setDoc(doc(collection(db, 'cohorts')), {
        name,
        code,
        maxUses: Math.max(0, Number(newMax) || 0),
        memberCount: 0,
        status: 'active',
        createdAt: serverTimestamp(),
      });
      setNewName(''); setNewCode(''); setNewMax('12');
    } catch (err) {
      console.error('[AdminCohorts] create', err);
      setFormError(err.message || 'Yaradılmadı.');
    }
    setCreating(false);
  };

  const toggleStatus = async (c) => {
    try {
      await updateDoc(doc(db, 'cohorts', c.id), {
        status: c.status === 'active' ? 'paused' : 'active',
      });
    } catch (err) { console.error('[AdminCohorts] status', err); }
  };

  const copyCode = async (c) => {
    try {
      await navigator.clipboard.writeText(c.code || '');
      setCopied(c.id);
      setTimeout(() => setCopied(''), 1500);
    } catch {}
  };

  const inputStyle = {
    flex: 1, minWidth: 0, padding: '10px 12px', background: '#1a1a2e',
    border: '1px solid #2e2e50', borderRadius: '10px', color: 'white',
    fontSize: '13px', outline: 'none',
  };

  return (
    <div>
      {/* Yeni kohort */}
      <form onSubmit={createCohort} style={{
        background: '#1a1a2e', border: '1px solid #2e2e50', borderRadius: '16px',
        padding: '14px', marginBottom: '16px',
      }}>
        <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 800, color: '#e2e8f0' }}>
          ➕ Yeni kohort
        </p>
        {formError && (
          <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#f87171' }}>{formError}</p>
        )}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <input style={inputStyle} placeholder="Ad (məs: Dalğa 1)" value={newName}
            onChange={(e) => setNewName(e.target.value)} />
          <input style={inputStyle} placeholder="KOD (məs: SPEAK-A2-01)" value={newCode}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())} />
          <input style={{ ...inputStyle, flex: '0 0 90px' }} type="number" min="0"
            placeholder="Limit" value={newMax} onChange={(e) => setNewMax(e.target.value)} />
        </div>
        <button type="submit" disabled={creating} style={{
          width: '100%', padding: '10px', background: 'linear-gradient(135deg, #7c6ff7, #5b4de8)',
          color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700,
          fontSize: '13px', cursor: 'pointer',
        }}>
          {creating ? '...' : 'Yarat'}
        </button>
      </form>

      {/* Kohort siyahısı */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        {cohorts.map((c) => (
          <div key={c.id} style={{
            background: selectedId === c.id ? 'linear-gradient(135deg, #2c1e4a, #1a1025)' : '#1a1a2e',
            border: selectedId === c.id ? '1px solid #7c6ff7' : '1px solid #2e2e50',
            borderRadius: '14px', padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
          }}>
            <button
              onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
              style={{ flex: 1, minWidth: '140px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0 }}
            >
              <span style={{ display: 'block', fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>
                🧪 {c.name || c.id}
                {c.status !== 'active' && <span style={{ color: '#f87171', fontSize: '11px' }}> · dayandırılıb</span>}
              </span>
              <span style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                👥 {Number(c.memberCount) || 0}{Number(c.maxUses) > 0 ? `/${c.maxUses}` : ''} üzv · kod: <b>{c.code}</b>
              </span>
            </button>
            <button onClick={() => copyCode(c)} style={{
              padding: '6px 10px', background: '#2a2a40', color: copied === c.id ? '#34d399' : '#e2e8f0',
              border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
            }}>
              {copied === c.id ? '✓ Kopyalandı' : '📋 Kod'}
            </button>
            <button onClick={() => toggleStatus(c)} style={{
              padding: '6px 10px', background: 'none',
              color: c.status === 'active' ? '#f87171' : '#34d399',
              border: `1px solid ${c.status === 'active' ? '#f8717155' : '#34d39955'}`,
              borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
            }}>
              {c.status === 'active' ? 'Dayandır' : 'Aktivləşdir'}
            </button>
          </div>
        ))}
        {cohorts.length === 0 && (
          <p style={{ textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            Hələ kohort yoxdur — yuxarıdan yaradın.
          </p>
        )}
      </div>

      {/* Üzvlər */}
      {selectedId && (
        <div>
          <p style={{ fontSize: '13px', fontWeight: 800, color: '#e2e8f0', margin: '0 0 4px' }}>
            Üzvlər ({decorated.length})
          </p>
          <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 10px' }}>
            🔴 = son 2 sessiyada iştirak etməyib (erkən müdaxilə siqnalı)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {decorated.map((m) => (
              <div key={m.id} style={{
                background: '#1a1a2e',
                border: m.fading ? '1px solid #ef444488' : '1px solid #2e2e50',
                borderRadius: '12px', padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>{m.fading ? '🔴' : '🟢'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: m.fading ? '#fca5a5' : '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.name || m.email || m.id}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                    Son iştirak: {m.callMs
                      ? new Intl.DateTimeFormat('az', { day: 'numeric', month: 'short' }).format(new Date(m.callMs))
                      : 'heç vaxt'}
                    {' · '}📞 {m.callCount || 0} zəng
                  </p>
                </div>
                <span style={{
                  flexShrink: 0, fontSize: '12px', fontWeight: 800,
                  color: m.completed !== null ? '#7c6ff7' : '#64748b',
                }}>
                  {m.completed !== null ? `${m.completed}/${COURSE_TOPIC_COUNT}` : '—'}
                </span>
              </div>
            ))}
            {decorated.length === 0 && (
              <p style={{ textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                Bu kohortda hələ üzv yoxdur.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
