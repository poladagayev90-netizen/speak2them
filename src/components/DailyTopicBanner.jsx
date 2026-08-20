import React, { useEffect, useState } from 'react';
import { subscribeToCycle } from '../utils/cycle';
import { getTodayContent } from '../data/weeklyContent';
import { getTopicsCompleted } from '../utils/courseProgress';

// Home-un YEGANƏ "günün mövzusu" girişi — bir sətir, bir toxunuş.
//
// Əvvəllər bu kart üç qat idi: mövzu başlığı + "Sözlər · idiomlar · suallar"
// çipi + 21:00 geri sayımı və "əsas günlər" izahı. Nəticədə ana səhifənin
// yarısını tuturdu və əsl hərəkət (partnyor tapmaq) ekrandan aşağı düşürdü.
//
// SessionCountdown TAMAMİLƏ ÇIXARILDI. 21:00 artıq ayrıca xəbərdarlıq deyil —
// praktika lövhəsindəki ⭐ işarəli 20–22 blokudur. İki fərqli yerdə eyni şeyi
// izah etmək istifadəçini çaşdırırdı: biri "sessiya saatı", digəri "blok".
export default function DailyTopicBanner({ user, onOpenTopic }) {
  const [cycle, setCycle] = useState(null);
  useEffect(() => subscribeToCycle(setCycle), []);

  const topic = getTodayContent();
  const completed = getTopicsCompleted(user, cycle);
  const topicLabel = completed !== null && completed > 0
    ? `Topic ${completed} · ${topic.topic}`
    : topic.topic;

  return (
    <div
      id="tour-daily-topic"
      onClick={onOpenTopic}
      role={onOpenTopic ? 'button' : undefined}
      tabIndex={onOpenTopic ? 0 : undefined}
      onKeyDown={(e) => {
        if (onOpenTopic && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpenTopic(); }
      }}
      style={{
        background: 'linear-gradient(135deg, #7c6ff7, #5b4de8)',
        borderRadius: '14px',
        padding: '12px 14px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        cursor: onOpenTopic ? 'pointer' : 'default',
        boxShadow: '0 3px 14px rgba(124,111,247,0.35)',
      }}
    >
      <span style={{ fontSize: '20px', flexShrink: 0 }}>🎙️</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.4px', textTransform: 'uppercase',
        }}>
          Today's topic
        </div>
        <div style={{
          color: '#fff', fontWeight: 800, fontSize: '15px', lineHeight: 1.25,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {topicLabel}
        </div>
      </div>
      {onOpenTopic && (
        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '18px', flexShrink: 0 }}>›</span>
      )}
    </div>
  );
}
