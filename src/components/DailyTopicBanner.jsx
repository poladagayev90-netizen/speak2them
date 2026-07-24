import React, { useEffect, useState } from 'react';
import { subscribeToCycle } from '../utils/cycle';
import { getTodayContent } from '../data/weeklyContent';
import { getTopicsCompleted } from '../utils/courseProgress';
import SessionCountdown from './SessionCountdown';

// Home-un YEGANƏ "günün mövzusu" girişi — ONE consistent look, always.
//
// Əvvəllər bu, sessiya saatının keçib-keçmədiyinə görə iki fərqli görünüş
// arasında keçirdi: sessiya hələ qabaqdaykən zəngin banner ("Sessiya saatı:
// 16:00 və 21:00"), saatlar keçəndən sonra sadə düymə. Nəticə: eyni ekran
// səhər zəngin, gecə (hər iki sessiya keçəndən sonra) sadə görünürdü — eyni
// gün ərzində iki fərqli "üz" göstərirdi. Sessiya saatı köhnəlmiş məlumat
// olduğu üçün bu, faktiki bugdur, sadəcə vizual seçim deyil.
//
// İndi tək məzmun göstərilir: bugünün mövzusu — heç vaxt köhnəlmir, ona görə
// vaxtdan asılı budaqlanmaya ehtiyac yoxdur.
//
// SessionCountdown eyni kartın içindədir, ayrı kart/modal kimi yox: Home-da
// artıq streak modal → mövzu girişi → guided tour zənciri var, əlavə qat
// istəmirik. Zolaq statik saat göstərmir, NÖVBƏTİ sessiyaya sayır — yəni
// yuxarıdakı köhnəlmə problemini geri gətirmir (səbəb SessionCountdown.jsx-də).
export default function DailyTopicBanner({ user, onOpenTopic, onJoinSession }) {
  const [cycle, setCycle] = useState(null);
  useEffect(() => subscribeToCycle(setCycle), []);

  const topic = getTodayContent();
  const completed = getTopicsCompleted(user, cycle);
  const topicLabel = completed !== null && completed > 0
    ? `Mövzu ${completed} · ${topic.topic}`
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
        borderRadius: '16px',
        padding: '14px 16px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: onOpenTopic ? 'pointer' : 'default',
        boxShadow: '0 4px 18px rgba(124,111,247,0.45)',
      }}
    >
      <span style={{ fontSize: '26px' }}>🎙️</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: '15px', lineHeight: 1.3 }}>
          Bugünün mövzusu: {topicLabel}
        </div>
        <div style={{
          color: '#fff', fontSize: '12px', fontWeight: 700, marginTop: '6px',
          background: 'rgba(255,255,255,0.18)', borderRadius: '8px',
          padding: '4px 8px', display: 'inline-block',
        }}>
          📖 Sözlər · idiomlar · suallar
        </div>
        <SessionCountdown onJoin={onJoinSession} />
      </div>
      {onOpenTopic && (
        <span style={{ color: '#fff', fontSize: '18px', flexShrink: 0 }}>›</span>
      )}
    </div>
  );
}
