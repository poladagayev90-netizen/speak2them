import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Analiz hazır olanda BİR DƏFƏ görünən modal (topic-intro üslubunda). Əvvəlki
// versiya Home-a daimi zolaq əlavə edirdi və yığını qarışdırırdı — istənən
// davranış: hazır olanda modal çıxsın, açılandan (və ya "Sonra"dan) sonra bir
// daha görünməsin. "Görüldü" açarı History səhifəsi ilə paylaşılır.
const seenKey = (uid) => `analysisSeen_v1_${uid}`;
const tsMillis = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : 0);

export default function AnalysisReadyModal({ user, suppressed }) {
  const [latest, setLatest] = useState(null);
  const [, setTick] = useState(0);
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
      (snap) => setLatest(snap.empty ? null : snap.docs[0].data()),
      () => setLatest(null)
    );
  }, [user?.uid]);

  // Streak/mövzu modalları açıq ikən görünmə — iki modal üst-üstə düşməsin.
  if (suppressed || !latest || latest.status !== 'done') return null;

  const ts = tsMillis(latest.timestamp);
  if (!ts || ts <= Number(localStorage.getItem(seenKey(user.uid)) || 0)) return null;

  const dismiss = () => {
    localStorage.setItem(seenKey(user.uid), String(ts));
    setTick((t) => t + 1);
  };
  const open = () => { dismiss(); navigate('/history'); };

  return (
    <div className="topic-intro-overlay">
      <div className="topic-intro-modal">
        <h3 className="topic-intro-label">📊 NƏTİCƏ HAZIRDIR</h3>
        <h1 className="topic-intro-title" style={{ fontSize: '26px' }}>AI analiziniz hazırdır!</h1>
        <p className="topic-intro-desc">
          {latest.peerName ? `${latest.peerName} ilə zəngin` : 'Son zəngin'} təhlili —
          tələffüz, söz ehtiyatı və tövsiyələr sizi gözləyir.
        </p>
        <div className="topic-intro-actions">
          <button className="topic-intro-btn-primary" onClick={open}>
            Nəticəyə bax
          </button>
          <button className="topic-intro-btn-secondary" onClick={dismiss}>
            Sonra
          </button>
        </div>
      </div>
    </div>
  );
}
