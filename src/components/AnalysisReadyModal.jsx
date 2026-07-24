import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Analiz hazır olanda görünən modal. Qaydalar (istifadəçi bezdirilməsin):
//   1. Yalnız TƏZƏ analiz üçün çıxır (≤24 saat) — gecikmiş növbədən çıxan
//      köhnə analizlər modal göndərmir.
//   2. GÖRÜNƏN KİMİ "göstərildi" yazılır — düymə klikindən, unmount-dan və ya
//      başqa heç nədən asılı deyil. Əvvəlki versiyalar bağlanma yollarından
//      birini qaçırdıqda modal təkrar-təkrar çıxırdı ("ilişib" effekti).
//   3. Baxılmayıbsa (History açılmayıbsa) ƏN ÇOXU BİR dəfə də xatırladır,
//      o da ilk göstərilmədən ən azı 4 saat sonra. Cəmi 2 görünüş — son.
//
// İki localStorage açarı:
//   analysisSeen_v1_{uid}  — "BAXILDI" (History səhifəsi də yazır)
//   analysisNag_v2_{uid}   — {ts, count, lastShownAt} "GÖSTƏRİLDİ" sayğacı
const seenKey = (uid) => `analysisSeen_v1_${uid}`;
const nagKey = (uid) => `analysisNag_v2_${uid}`;
const tsMillis = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : 0);

const FRESH_MS = 24 * 60 * 60 * 1000;   // bundan köhnə analiz modal çıxarmır
const REMIND_GAP_MS = 4 * 60 * 60 * 1000; // ikinci (son) görünüşə qədər fasilə
const MAX_SHOWS = 2;

const readNag = (uid) => {
  try { return JSON.parse(localStorage.getItem(nagKey(uid))) || {}; } catch { return {}; }
};

export default function AnalysisReadyModal({ user, suppressed }) {
  const [latest, setLatest] = useState(null);
  // localStorage-i state-ə köçürürük ki, yazandan sonra rerender baş versin.
  const [seenTs, setSeenTs] = useState(() => Number(localStorage.getItem(seenKey(user.uid)) || 0));
  const [nag, setNag] = useState(() => readNag(user.uid));
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
  const now = Date.now();
  const sameAnalysis = nag.ts === ts;
  const showCount = sameAnalysis ? (nag.count || 0) : 0;
  const canShow =
    latest?.status === 'done'
    && !!ts
    && ts > seenTs                      // hələ baxılmayıb
    && now - ts < FRESH_MS              // köhnə analiz deyil
    && showCount < MAX_SHOWS            // 2 dəfədən artıq heç vaxt
    && (showCount === 0 || now - (nag.lastShownAt || 0) >= REMIND_GAP_MS);

  const visible = !suppressed && canShow;

  // Görünən kimi sayğacı artır — modal bir renderdə göründüsə, artıq
  // "göstərilib" sayılır və şərtlər onu öz-özünə təkrar çıxarmır.
  useEffect(() => {
    if (!visible) return;
    const next = { ts, count: showCount + 1, lastShownAt: Date.now() };
    localStorage.setItem(nagKey(user.uid), JSON.stringify(next));
    // setNag QƏSDƏN çağırılmır: state dəyişsəydi visible dərhal sönərdi.
    // Sayğac növbəti mount-da localStorage-dən oxunur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ts]);

  if (!visible) return null;

  const markSeen = () => {
    localStorage.setItem(seenKey(user.uid), String(ts));
    setSeenTs(ts);
  };
  // "Sonra" = bağla, amma BAXILDI sayma — 4 saatdan sonra bir dəfə də
  // xatırladıla bilər (istifadəçinin istədiyi davranış).
  const dismiss = () => setNag(readNag(user.uid));
  const open = () => { markSeen(); navigate('/history'); };

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
