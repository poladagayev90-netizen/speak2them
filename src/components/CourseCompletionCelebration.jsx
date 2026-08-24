import React, { useEffect, useRef, useState } from 'react';
import { PartyPopper, Share2 } from 'lucide-react';
import { authedFetch } from '../api';
import { FUNCTIONS_BASE } from '../constants';
import { subscribeToCycle } from '../utils/cycle';
import { COURSE_TOPIC_COUNT, getTopicsCompleted } from '../utils/courseProgress';
import Logo from './Logo';

// 28/28 axını, hamısı avtomatik:
// 1) Client lokal olaraq cycleTick - startTick >= 28 görəndə
//    claimCourseCompletion-u BİR DƏFƏ çağırır (server yenidən yoxlayır və
//    courseCompletedAt + freeAccessUntil yazır — K2).
// 2) courseCompletedAt user sənədinə düşən kimi (App.js canlı sinxronu) təbrik
//    ekranı bir dəfə göstərilir; "gördüm" localStorage-da qeyd olunur.
export default function CourseCompletionCelebration({ user }) {
  const [cycle, setCycle] = useState(null);
  const [open, setOpen] = useState(false);
  const claimAttempted = useRef(false);

  useEffect(() => subscribeToCycle(setCycle), []);

  const completed = getTopicsCompleted(user, cycle);
  const seenKey = `courseCelebrated_${user.uid}`;

  // Addım 1: server təsdiqini tetiklə (idempotent, sessiyada bir cəhd).
  useEffect(() => {
    if (claimAttempted.current) return;
    if (completed === null || completed < COURSE_TOPIC_COUNT) return;
    if (user.courseCompletedAt) return;
    claimAttempted.current = true;
    authedFetch(`${FUNCTIONS_BASE}/claimCourseCompletion`, { method: 'POST' })
      .catch((e) => console.error('[claimCourseCompletion]', e));
  }, [completed, user.courseCompletedAt]);

  // Addım 2: təsdiq yazılıb və hələ qeyd edilməyibsə — bayram.
  useEffect(() => {
    if (!user.courseCompletedAt) return;
    if (localStorage.getItem(seenKey) === '1') return;
    setOpen(true);
  }, [user.courseCompletedAt, seenKey]);

  if (!open) return null;

  const until = user.freeAccessUntil;
  const untilDate = until && typeof until.toDate === 'function' ? until.toDate() : null;
  const untilLabel = untilDate
    ? new Intl.DateTimeFormat('az', { day: 'numeric', month: 'long', year: 'numeric' }).format(untilDate)
    : null;

  const close = () => {
    localStorage.setItem(seenKey, '1');
    setOpen(false);
  };

  const share = async () => {
    const text = `🎉 I completed the 30-topic English speaking course on SpeakLab! speaklab-app.vercel.app`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
    } catch {}
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: 'var(--overlay)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }}>
      <div style={{
        maxWidth: '380px', width: '100%', textAlign: 'center',
        background: 'linear-gradient(160deg, #241e48, #171331)',
        border: '1px solid var(--accent-ring)',
        borderRadius: '24px', padding: '28px 22px',
        boxShadow: 'var(--glass-lift)',
        animation: 'fadeInUp 0.5s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
          <Logo width={130} />
        </div>
        <div style={{ marginBottom: '10px', color: 'var(--accent)' }}><PartyPopper size={48} strokeWidth={1.5} /></div>
        <h2 style={{ color: '#f4f2fc', fontSize: '22px', margin: '0 0 8px' }}>
          Congratulations {COURSE_TOPIC_COUNT}/{COURSE_TOPIC_COUNT} complete
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: 1.5, margin: '0 0 18px' }}>
          You reached the end of the 30-topic speaking course. That is a real achievement.
        </p>

        <div style={{
          background: 'var(--accent-soft)', border: '1px solid var(--accent-ring)',
          borderRadius: '16px', padding: '14px', marginBottom: '20px',
        }}>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#f4f2fc' }}>
            🎁 Six months of free access unlocked
          </div>
          {untilLabel && (
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', marginTop: '4px' }}>
              {untilLabel} until
            </div>
          )}
        </div>

        <button
          onClick={share}
          style={{
            width: '100%', padding: '12px', borderRadius: '14px',
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)',
            color: '#f4f2fc', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
            marginBottom: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          <Share2 size={16} strokeWidth={1.75} aria-hidden="true" /> Share this
        </button>
        <button
          onClick={close}
          style={{
            width: '100%', padding: '13px', borderRadius: '14px',
            /* The card is a fixed dark plum sheet in both themes, so this
               button takes the dark-theme accent literally -- var(--accent)
               would flip to a deep purple with white ink in light mode and
               vanish into the sheet. */
            background: '#b6a6ff',
            border: 'none', color: '#171331', fontSize: '15px', fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Davam edirik
        </button>
      </div>
    </div>
  );
}
