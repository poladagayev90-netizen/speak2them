import React, { useEffect, useState } from 'react';
import { subscribeToCycle } from '../utils/cycle';
import {
  subscribeToSessionConfig,
  getActiveDays,
  getSessionTimes,
  bakuDateStr,
  bakuWeekday,
} from '../utils/sessionSchedule';
import { getTodayContent } from '../data/weeklyContent';
import { getTopicsCompleted } from '../utils/courseProgress';

const pad = (n) => String(n).padStart(2, '0');

// Bugün sessiya/bonus günüdürsə Home-da görkəmli banner: "Bu axşam: Mövzu N ·
// {mövzu adı} · {saat}". Sessiya günü deyilsə (və ya günün son sessiyası da
// keçibsə) heç nə render olunmur — sakit ekran. Yalnız in-app; push-a toxunmur.
export default function SessionDayBanner({ user, onOpenTopic }) {
  const [cycle, setCycle] = useState(null);
  const [config, setConfig] = useState(null);
  // Saat başları keçdikcə banner özü yenilənsin deyə yavaş tick.
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => subscribeToCycle(setCycle), []);
  useEffect(() => subscribeToSessionConfig(setConfig), []);
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  if (!config) return null;

  const today = bakuDateStr(nowMs);
  const isSessionDay = getActiveDays(config).has(bakuWeekday(today));
  if (!isSessionDay) return null;

  // Bugünün hələ keçməmiş sessiya saatları (10 dəq buffer da bitibsə keçmiş
  // sayılır). Hamısı keçibsə günün işi bitib — banner yığışır.
  const bufferMs = (Number.isFinite(config.bufferMinutes) ? config.bufferMinutes : 10) * 60 * 1000;
  const upcoming = getSessionTimes(config).filter(
    (t) => nowMs < Date.parse(`${today}T${pad(t.hour)}:${pad(t.minute)}:00+04:00`) + bufferMs
  );
  if (upcoming.length === 0) return null;

  const timesLabel = upcoming.map((t) => `${pad(t.hour)}:${pad(t.minute)}`).join(' və ');
  const topic = getTodayContent();
  const completed = getTopicsCompleted(user, cycle);
  const topicLabel = completed !== null && completed > 0
    ? `Mövzu ${completed} · ${topic.topic}`
    : topic.topic;

  return (
    <div
      onClick={onOpenTopic}
      role={onOpenTopic ? 'button' : undefined}
      tabIndex={onOpenTopic ? 0 : undefined}
      onKeyDown={(e) => {
        if (onOpenTopic && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpenTopic(); }
      }}
      style={{
        background: 'linear-gradient(135deg, #7c6ff7, #5b4de8)',
        borderRadius: '16px',
        padding: '14px 16px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: onOpenTopic ? 'pointer' : 'default',
        boxShadow: '0 4px 18px rgba(124,111,247,0.45)',
        animation: 'sessionGlow 2.5s ease-in-out infinite',
      }}
    >
      <span style={{ fontSize: '26px' }}>🎙️</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: '15px', lineHeight: 1.3 }}>
          Bu axşam: {topicLabel}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', marginTop: '2px' }}>
          🕘 Sessiya saatı: {timesLabel}
        </div>
      </div>
      {onOpenTopic && (
        <span style={{ color: '#fff', fontSize: '18px', flexShrink: 0 }}>›</span>
      )}
      <style>{`
        @keyframes sessionGlow {
          0%, 100% { box-shadow: 0 4px 18px rgba(124,111,247,0.45); }
          50% { box-shadow: 0 4px 26px rgba(124,111,247,0.75); }
        }
      `}</style>
    </div>
  );
}
