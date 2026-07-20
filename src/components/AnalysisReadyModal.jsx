import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Analiz hazır olanda BİR DƏFƏ görünən modal (topic-intro üslubunda). İstənən
// davranış: hazır olanda çıxsın, GÖRÜLƏNDƏN sonra bir daha görünməsin.
//
// Əvvəlki versiyanın buqu: "görüldü" açarı YALNIZ düymə klikində yazılırdı.
// İstifadəçi modalı aşağı-nav/geri düyməsi ilə bağlayanda (səhifə unmount) və
// ya üstündən başqa modal açıb bağlayanda açar yazılmırdı, ona görə modal
// təkrar-təkrar çıxırdı. İndi HƏR bağlanma yolunda (düymə, örtülmə, naviqasiya)
// "görüldü" yazılır. Açar History səhifəsi ilə paylaşılır.
const seenKey = (uid) => `analysisSeen_v1_${uid}`;
const tsMillis = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : 0);

export default function AnalysisReadyModal({ user, suppressed }) {
  const [latest, setLatest] = useState(null);
  const [seenTs, setSeenTs] = useState(() => Number(localStorage.getItem(seenKey(user.uid)) || 0));
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

  const ts = tsMillis(latest?.timestamp);
  // Streak/mövzu modalları açıq ikən görünmə — iki modal üst-üstə düşməsin.
  const visible = !suppressed && latest?.status === 'done' && !!ts && ts > seenTs;

  // Cari analizi "görüldü" kimi qeyd et. localStorage → növbəti mount-da da
  // çıxmasın; state → bu mount-da suppressor açılıb-bağlananda təkrar çıxmasın.
  const persistSeen = (value) => {
    if (!value) return;
    localStorage.setItem(seenKey(user.uid), String(value));
    setSeenTs((prev) => Math.max(prev, value));
  };

  // Modal görünüb sonra HƏR HANSI səbəblə itəndə (örtülmə və ya səhifə
  // unmount/naviqasiya) görüldü kimi yaz. tsRef son görünən dəyəri saxlayır ki,
  // unmount cleanup-ı köhnəlmiş closure oxumasın.
  const tsRef = useRef(ts);
  useEffect(() => { tsRef.current = ts; }, [ts]);
  useEffect(() => {
    if (!visible) return undefined;
    return () => {
      const t = tsRef.current;
      if (t) localStorage.setItem(seenKey(user.uid), String(t));
    };
  }, [visible, user.uid]);

  if (!visible) return null;

  const dismiss = () => persistSeen(ts);
  const open = () => { persistSeen(ts); navigate('/history'); };

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
