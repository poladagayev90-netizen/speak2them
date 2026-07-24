import React, { useEffect, useState } from 'react';
import {
  subscribeToSessionConfig,
  getUpcomingSessionWindow,
  isMainSessionDay,
  getActiveDays,
  bakuDateStr,
} from '../utils/sessionSchedule';
import { formatAzDate } from '../utils/courseProgress';

// DailyTopicBanner-in içində göstərilən canlı geri sayım zolağı.
//
// MODEL: 21:00 TÖVSİYƏ olunan praktika saatıdır və HƏR GÜN göstərilir.
// B.e/Çər/Cümə + Bazar "əsas günlər"dir — camaatın toplaşdığı günlər. Digər
// günlərdə saat eynidir, sadəcə daha az adam olur. Heç bir halda qadağa yoxdur:
// istifadəçi istənilən gün, istənilən saat partnyor axtara bilər. Zolağın ikinci
// sətri məhz bunu izah edir ki, çərşənbə axşamı girən yeni istifadəçi ekranı
// "bu gün olmaz" kimi oxumasın.
//
// NİYƏ BU 9fc02ff-in geri qaytarılması DEYİL: orada silinən şey STATİK saat
// siyahısı idi ("Sessiya saatı: 16:00 və 21:00") — saat keçəndən sonra ekranda
// köhnə məlumat qalırdı və komponent gecə tamam başqa görünüşə keçirdi. Burada
// hədəf həmişə NÖVBƏTİ 21:00-dır: saat keçən kimi hədəf özü sabaha sürüşür, ona
// görə zolaq heç vaxt köhnəlmir və eyni gün ərzində görünüş dəyişmir.
//
// Vaxt hesabı tamamilə sessionSchedule.js-dədir (Bakı UTC+4) — burada cihazın
// saat qurşağına toxunan heç nə yoxdur, yalnız Date.now() fərqi.

const pad = (n) => String(n).padStart(2, '0');

// 0=Bazar … 6=Şənbə — bakuWeekday ilə eyni konvensiya.
const WEEKDAY_SHORT = ['Baz', 'B.e', 'Ç.a', 'Çər', 'C.a', 'Cümə', 'Şən'];

// Qalan müddət — böyük vahid varsa saniyə göstərilmir (bir saatlıq gözləmədə
// saniyələrin oynaması diqqət oğurlayır), son bir dəqiqədə isə yalnız saniyə.
function formatRemaining(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (days > 0) return `${days} gün ${hours} saat qalıb`;
  if (hours > 0) return `${hours} saat ${mins} dəq qalıb`;
  if (mins > 0) return `${mins} dəq ${pad(secs)} san qalıb`;
  return `${secs} san qalıb`;
}

// "Bu gün" / "Sabah" / həftə günü. Müqayisə Bakı tarix sətirləri üzərindədir,
// yəni cihaz hansı qurşaqda olursa olsun eyni nəticə verir.
function dayLabel(dateStr, nowMs) {
  if (dateStr === bakuDateStr(nowMs)) return 'Bu gün';
  if (dateStr === bakuDateStr(nowMs + 24 * 60 * 60 * 1000)) return 'Sabah';
  const weekday = formatAzDate(dateStr).split(',')[0];
  return weekday ? weekday.charAt(0).toUpperCase() + weekday.slice(1) : dateStr;
}

// "B.e · Çər · Cümə · Baz" — bazar ertəsindən başlayan sıra ilə (Bazar 0-dır,
// ona görə sadə ədədi sıralama onu qabağa atardı).
function mainDaysLabel(config) {
  return [...getActiveDays(config)]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => WEEKDAY_SHORT[d])
    .filter(Boolean)
    .join(' · ');
}

export default function SessionCountdown({ onJoin }) {
  const [config, setConfig] = useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => subscribeToSessionConfig(setConfig), []);

  // Saniyəlik tick. Sayğac hər dəfə Date.now()-dan YENİDƏN hesablanır (azalan
  // sayğac saxlanmır), ona görə tətbiq arxa fonda olub interval boğulanda da
  // qayıdışda rəqəm düzgün olur. Cleanup vacibdir — bu kod bazasında təmizlənməmiş
  // listener/interval keçmiş problemdir.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Konfiq hələ yüklənməyib, ya da planlaşdırılmış sessiyalar söndürülüb.
  // enabled=false olanda matchSessionQueue cron-u (functions/index.js) dərhal
  // return edir — nə xatırlatma push-u gedir, nə server cütləşdirir. Belə vaxt
  // sayğac göstərmək baş tutmayacaq sessiya vəd etmək olardı.
  if (!config || !config.enabled) return null;

  const win = getUpcomingSessionWindow(config, nowMs);
  if (!win) return null;

  const live = nowMs >= win.startMs;
  const timeLabel = `${pad(win.hour)}:${pad(win.minute)}`;
  const isMain = isMainSessionDay(config, win.dateStr);

  if (live) {
    return (
      <div
        style={{
          marginTop: '8px',
          background: 'rgba(255,255,255,0.28)',
          border: '1px solid rgba(255,255,255,0.45)',
          borderRadius: '10px',
          padding: '7px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'sessionLivePulse 1.8s ease-in-out infinite',
        }}
      >
        <span style={{ color: '#fff', fontSize: '12.5px', fontWeight: 800, lineHeight: 1.35 }}>
          🔴 Praktika saatı {timeLabel} — indi başlayır
        </span>
        {onJoin && (
          <button
            onClick={(e) => { e.stopPropagation(); onJoin(); }}
            onKeyDown={(e) => e.stopPropagation()}
            style={{
              marginLeft: 'auto',
              background: '#fff',
              color: '#5b4de8',
              border: 'none',
              borderRadius: '8px',
              padding: '5px 12px',
              fontWeight: 800,
              fontSize: '12px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Qoşul
          </button>
        )}
        <style>{`
          @keyframes sessionLivePulse {
            0%, 100% { background: rgba(255,255,255,0.28); }
            50% { background: rgba(255,255,255,0.40); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: '8px',
        background: 'rgba(255,255,255,0.18)',
        borderRadius: '10px',
        padding: '6px 10px',
        color: '#fff',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 700, lineHeight: 1.35 }}>
        ⏳ Praktika saatı: {dayLabel(win.dateStr, nowMs)} {timeLabel}
        <span style={{ opacity: 0.85, fontWeight: 600 }}> · {formatRemaining(win.startMs - nowMs)}</span>
      </div>
      <div style={{ fontSize: '10.5px', fontWeight: 600, lineHeight: 1.35, marginTop: '3px', opacity: 0.82 }}>
        {isMain
          ? 'Əsas gün — ən çox adam bu saatda toplaşır.'
          : `Əsas günlər: ${mainDaysLabel(config)}. Bu gün az adam ola bilər — onlayn kimsə varsa yenə danışa bilərsən.`}
      </div>
    </div>
  );
}
