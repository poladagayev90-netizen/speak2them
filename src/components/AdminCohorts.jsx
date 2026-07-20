import React, { useEffect, useMemo, useState } from 'react';
import {
  collection, onSnapshot, query, where, doc, setDoc, updateDoc, deleteField,
  increment, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { authedFetch } from '../api';
import { FUNCTIONS_BASE } from '../constants';
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
  const [starting, setStarting] = useState(false);

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
        pendingCount: 0,
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

  const acceptApplicant = async (m) => {
    try { await updateDoc(doc(db, 'users', m.id), { cohortStatus: 'accepted' }); }
    catch (err) { console.error('[AdminCohorts] accept', err); }
  };
  const rejectApplicant = async (m) => {
    try {
      await updateDoc(doc(db, 'users', m.id), { cohortStatus: deleteField(), cohortId: deleteField() });
      await updateDoc(doc(db, 'cohorts', selectedId), { pendingCount: increment(-1) }).catch(() => {});
    } catch (err) { console.error('[AdminCohorts] reject', err); }
  };
  const startSelectedCohort = async () => {
    const acceptedN = members.filter((m) => m.cohortStatus === 'accepted').length;
    if (acceptedN === 0) { alert('Qəbul edilmiş üzv yoxdur.'); return; }
    if (!window.confirm(`${acceptedN} qəbul edilmiş üzv üçün kurs BU GÜN başlayacaq. Davam edilsin?`)) return;
    setStarting(true);
    try {
      const res = await authedFetch(`${FUNCTIONS_BASE}/startCohort`, {
        method: 'POST', body: JSON.stringify({ cohortId: selectedId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'start_failed');
      alert(`✅ Başladı! ${data.started} üzv aktivləşdi.`);
    } catch (err) {
      console.error('[AdminCohorts] start', err);
      alert('Başlatma alınmadı: ' + (err.message || 'xəta'));
    }
    setStarting(false);
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
                👥 {Number(c.memberCount) || 0}{Number(c.maxUses) > 0 ? `/${c.maxUses}` : ''} aktiv
                {Number(c.pendingCount) > 0 && <span style={{ color: '#fbbf24' }}> · ⏳ {Number(c.pendingCount)} gözləyir</span>}
                {' · '}kod: <b>{c.code}</b>
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

      {/* Seçilmiş kohortun İDARƏ OTAĞI */}
      {selectedId && (() => {
        const selected = cohorts.find((c) => c.id === selectedId) || {};
        const pendingList = members.filter((m) => m.cohortStatus === 'pending');
        const acceptedList = members.filter((m) => m.cohortStatus === 'accepted');
        const activeList = decorated.filter((m) => m.mode === 'course' || m.cohortStatus === 'active');
        const maxUses = Number(selected.maxUses) || 0;
        const seatsUsed = pendingList.length + acceptedList.length + activeList.length;

        const stat = (emoji, label, n, color) => (
          <div style={{ flex: 1, textAlign: 'center', padding: '10px 4px' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color }}>{n}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{emoji} {label}</div>
          </div>
        );

        const applicantRow = (m, accepted) => (
          <div key={m.id} style={{
            background: '#15152a', border: '1px solid #2e2e50', borderRadius: '14px',
            padding: '13px 14px', display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <span style={{ fontSize: '18px', flexShrink: 0 }}>{accepted ? '✅' : '🙋'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {m.name || m.email || m.id}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: accepted ? '#34d399' : '#fbbf24' }}>
                {accepted ? 'Qəbul edildi — başlamağı gözləyir' : 'Yeni müraciət'}
              </p>
            </div>
            {accepted ? (
              <button onClick={() => rejectApplicant(m)} style={{
                padding: '9px 14px', background: 'none', color: '#f87171',
                border: '1px solid #f8717155', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', flexShrink: 0,
              }}>Geri al</button>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button onClick={() => acceptApplicant(m)} style={{
                  padding: '9px 14px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff',
                  border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                }}>Qəbul et</button>
                <button onClick={() => rejectApplicant(m)} style={{
                  padding: '9px 12px', background: 'none', color: '#f87171',
                  border: '1px solid #f8717155', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                }}>Rədd</button>
              </div>
            )}
          </div>
        );

        return (
          <div style={{
            background: '#141428', border: '1px solid #2e2e50', borderRadius: '18px',
            padding: '16px', marginBottom: '20px',
          }}>
            <p style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
              🧪 {selected.name || selectedId}
            </p>

            {/* Həqiqi xülasə — sayğaclardan yox, üzv sənədlərindən hesablanır. */}
            <div style={{
              display: 'flex', background: '#0f0f1e', borderRadius: '14px',
              border: '1px solid #24243e', marginBottom: '16px', overflow: 'hidden',
            }}>
              {stat('🙋', 'Yeni', pendingList.length, '#fbbf24')}
              <div style={{ width: '1px', background: '#24243e' }} />
              {stat('✅', 'Qəbul', acceptedList.length, '#34d399')}
              <div style={{ width: '1px', background: '#24243e' }} />
              {stat('🎓', 'Aktiv', activeList.length, '#7c6ff7')}
              <div style={{ width: '1px', background: '#24243e' }} />
              {stat('🪑', maxUses > 0 ? 'Limit' : 'Yer', maxUses > 0 ? `${seatsUsed}/${maxUses}` : seatsUsed, '#e2e8f0')}
            </div>

            {/* Başlat düyməsi — hər zaman görünür (nə edəcəyi aydın olsun). */}
            <button
              onClick={startSelectedCohort}
              disabled={starting || acceptedList.length === 0}
              style={{
                width: '100%', padding: '15px', marginBottom: acceptedList.length > 0 || pendingList.length > 0 ? '18px' : '0',
                background: acceptedList.length === 0 ? '#20203a' : 'linear-gradient(135deg, #7c6ff7, #5b4de8)',
                color: acceptedList.length === 0 ? '#64748b' : '#fff',
                border: 'none', borderRadius: '14px', fontWeight: 800, fontSize: '15px',
                cursor: (starting || acceptedList.length === 0) ? 'default' : 'pointer',
                opacity: starting ? 0.6 : 1,
                boxShadow: acceptedList.length === 0 ? 'none' : '0 4px 16px rgba(124,111,247,0.4)',
              }}
            >
              {starting ? 'Başladılır...'
                : acceptedList.length === 0 ? '🚀 Başlatmaq üçün əvvəlcə qəbul edin'
                : `🚀 Kohortu Başlat — ${acceptedList.length} nəfər aktivləşəcək`}
            </button>

            {/* Müraciətlər */}
            {(pendingList.length > 0 || acceptedList.length > 0) && (
              <>
                <p style={{ fontSize: '14px', fontWeight: 800, color: '#e2e8f0', margin: '0 0 10px' }}>
                  Müraciətlər
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
                  {pendingList.map((m) => applicantRow(m, false))}
                  {acceptedList.map((m) => applicantRow(m, true))}
                </div>
              </>
            )}

            {/* Aktiv üzvlər */}
            <p style={{ fontSize: '14px', fontWeight: 800, color: '#e2e8f0', margin: '0 0 4px' }}>
              Aktiv üzvlər ({activeList.length})
            </p>
            {activeList.length > 0 && (
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 10px' }}>
                🔴 = son 2 sessiyada iştirak etməyib (erkən müdaxilə siqnalı)
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeList.map((m) => (
                <div key={m.id} style={{
                  background: '#15152a',
                  border: m.fading ? '1px solid #ef444488' : '1px solid #2e2e50',
                  borderRadius: '14px', padding: '13px 14px',
                  display: 'flex', alignItems: 'center', gap: '12px',
                }}>
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>{m.fading ? '🔴' : '🟢'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: m.fading ? '#fca5a5' : '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.name || m.email || m.id}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                      Son iştirak: {m.callMs
                        ? new Intl.DateTimeFormat('az', { day: 'numeric', month: 'short' }).format(new Date(m.callMs))
                        : 'heç vaxt'}
                      {' · '}📞 {m.callCount || 0} zəng
                    </p>
                  </div>
                  <span style={{
                    flexShrink: 0, fontSize: '14px', fontWeight: 800,
                    color: m.completed !== null ? '#7c6ff7' : '#64748b',
                  }}>
                    {m.completed !== null ? `${m.completed}/${COURSE_TOPIC_COUNT}` : '—'}
                  </span>
                </div>
              ))}
              {activeList.length === 0 && (
                <p style={{ textAlign: 'center', color: '#64748b', fontSize: '13px', padding: '8px 0' }}>
                  Hələ aktiv üzv yoxdur — qəbul edib "Başlat" deyin.
                </p>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
