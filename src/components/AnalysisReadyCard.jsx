import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// "AI analizini tapa bilmirəm" problemi: analiz zəngdən dəqiqələr sonra,
// istifadəçi Chat ekranını çoxdan tərk edəndə hazır olur, yeganə girişlər isə
// push (qaçırıla bilər) və Profil-in dərinliyindəki "Analiz Tarixçəsi" idi.
// Bu kart ana ekranda canlı vəziyyət göstərir:
//   queued/processing → "hazırlanır…" (istifadəçi analiz mövcudluğunu görür)
//   done + hələ baxılmayıb → "hazırdır — bax" → /history
// Baxılma lokalda saxlanır (analysisSeen_v1) — History səhifəsi açılanda da
// yazılır, ona görə kart özbaşına qayıtmır.
const seenKey = (uid) => `analysisSeen_v1_${uid}`;
const tsMillis = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : 0);
const PROCESSING_MAX_AGE_MS = 6 * 60 * 60 * 1000; // ilişib qalan köhnə ticket Home-u zibilləməsin

export default function AnalysisReadyCard({ user }) {
  const [latest, setLatest] = useState(null);
  const [, setTick] = useState(0); // "seen" localStorage-a yazılandan sonra yenidən render üçün
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.uid) return undefined;
    return onSnapshot(
      query(
        collection(db, 'callAnalysis'),
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(1)
      ),
      (snap) => setLatest(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }),
      () => setLatest(null)
    );
  }, [user?.uid]);

  if (!latest) return null;

  // serverTimestamp lokal snapshot-da bir anlıq null olur — "indi" say.
  const ts = tsMillis(latest.timestamp) || Date.now();
  const processing = latest.status === 'queued' || latest.status === 'processing';
  const ready = latest.status === 'done';
  const seen = Number(localStorage.getItem(seenKey(user.uid)) || 0);

  if (processing && Date.now() - ts > PROCESSING_MAX_AGE_MS) return null;
  if (ready && ts <= seen) return null;
  if (!processing && !ready) return null; // failed → səssiz

  const open = () => {
    localStorage.setItem(seenKey(user.uid), String(ts));
    setTick((t) => t + 1);
    navigate('/history');
  };

  return (
    <div
      onClick={ready ? open : undefined}
      role={ready ? 'button' : undefined}
      tabIndex={ready ? 0 : undefined}
      onKeyDown={ready ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } } : undefined}
      style={{
        background: ready
          ? 'linear-gradient(135deg, rgba(16,185,129,0.16), rgba(5,150,105,0.10))'
          : 'linear-gradient(135deg, rgba(124,111,247,0.12), rgba(91,77,232,0.08))',
        border: ready ? '1px solid rgba(16,185,129,0.45)' : '1px solid rgba(124,111,247,0.3)',
        borderRadius: '16px',
        padding: '12px 16px',
        marginTop: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: ready ? 'pointer' : 'default',
      }}
    >
      <span style={{ fontSize: '22px', flexShrink: 0 }}>{ready ? '📊' : '🧠'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--text-primary, #fff)', fontSize: '14px', fontWeight: 800 }}>
          {ready ? 'AI analiziniz hazırdır!' : 'AI analiziniz hazırlanır…'}
        </div>
        <div style={{ color: 'var(--text-secondary, #aaa)', fontSize: '12px', marginTop: '2px' }}>
          {ready
            ? `${latest.peerName ? `${latest.peerName} ilə zəng` : 'Son zəngin'} nəticəsinə baxın`
            : 'Bir neçə dəqiqəyə hazır olacaq — bildiriş gələcək'}
        </div>
      </div>
      {ready && <span style={{ color: '#10b981', fontSize: '18px', flexShrink: 0 }}>›</span>}
    </div>
  );
}
