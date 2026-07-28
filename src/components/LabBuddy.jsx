import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseSlotId, hourLabel } from '../utils/practiceSlots';

// Kolba — SpeakLab-ın canlı personajı. Ekranın küncündən boylanır, bir söz
// deyir və yox olur.
//
// NİYƏ 3D DEYİL: üç ölçülü səhnə üçün ən azı ~150KB kitabxana (three.js) və
// daimi GPU dövrü lazımdır. Bundle onsuz da 672KB-dır, tətbiq isə ucuz Android
// telefonlarda işləyir — küncdə 60px-lik personaj üçün 3D ekranda HEÇ NƏ
// qazandırmır, yalnız batareya yeyir. Eyni "canlılıq" SVG + CSS ilə alınır və
// sıfır kitabxana əlavə edir.
//
// NİYƏ CANLI AI DEYİL: personajın dedikləri LLM-dən gəlmir. Səbəb iki:
// (1) hər boylanma token xərcidir və gecikmə yaradır; (2) o, praktika partnyoru
// DEYİL — tətbiqin öz bildiyi faktı deyən bələdçidir. Faktlar onsuz da
// bazadadır, uydurmağa ehtiyac yoxdur. Sonradan AI cümlə istənilsə, yalnız
// `pickMessage`-i dəyişmək kifayətdir; qalan hər şey yerində qalır.
//
// DAİM GÖRÜNMÜR: gündə ən çox 2 dəfə, aralarında ən azı 3 saat, üstəlik yalnız
// DEYƏCƏK SÖZÜ OLANDA. Sözü yoxdursa ümumiyyətlə çıxmır.
const STORE_KEY = 'speaklab_buddy_v1';
const MAX_PER_DAY = 2;
const MIN_GAP_MS = 3 * 60 * 60 * 1000;
const APPEAR_DELAY_MS = 6000;
const VISIBLE_MS = 11000;

function readQuota() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    const today = new Date().toDateString();
    return raw.day === today ? raw : { day: today, count: 0, lastMs: 0 };
  } catch {
    return { day: new Date().toDateString(), count: 0, lastMs: 0 };
  }
}

function bumpQuota() {
  try {
    const q = readQuota();
    localStorage.setItem(STORE_KEY, JSON.stringify({
      day: q.day, count: q.count + 1, lastMs: Date.now(),
    }));
  } catch { /* private mode */ }
}

// Yalnız REAL vəziyyətdən doğan cümlələr. Prioritet sırası ilə — ilk uyğun gələn
// seçilir, heç biri uyğun gəlmirsə personaj çıxmır.
function pickMessage(user, mine, navigate) {
  const uc = mine?.upcomingCall;
  if (uc) {
    const parsed = parseSlotId(uc.slotId);
    const startMs = Number(uc.startMs) || parsed?.startMs || 0;
    const mins = Math.round((startMs - Date.now()) / 60000);
    if (mins > 0 && mins <= 90) {
      return {
        id: 'call-soon',
        text: `${hourLabel(parsed?.hour ?? 0)} zənginə ${mins} dəqiqə qalıb. Hazırsan?`,
        action: { label: 'Bax', run: () => navigate('/') },
      };
    }
    return null; // randevusu var və hələ vaxt çoxdur — deməyə söz yoxdur
  }

  if (!mine?.slotIds?.length) {
    return {
      id: 'no-slot',
      text: 'Bu gün hələ vaxt seçməmisən. Bir blok seç, kimsə qoşulan kimi xəbər verərəm.',
      action: { label: 'Vaxt seç', run: () => navigate('/') },
    };
  }

  const streak = Number(user?.streak) || 0;
  if (streak > 0 && user?.lastCallDate !== new Date().toDateString()) {
    return {
      id: 'streak',
      text: `${streak} günlük seriyan var — bu gün hələ danışmamısan.`,
      action: { label: 'Partnyor tap', run: () => navigate('/') },
    };
  }

  return null;
}

export default function LabBuddy({ user, mine }) {
  const [msg, setMsg] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const q = readQuota();
    if (q.count >= MAX_PER_DAY) return undefined;
    if (Date.now() - (q.lastMs || 0) < MIN_GAP_MS) return undefined;

    const showTimer = setTimeout(() => {
      const picked = pickMessage(user, mine, navigate);
      if (!picked) return;
      setMsg(picked);
      bumpQuota();
    }, APPEAR_DELAY_MS);

    return () => clearTimeout(showTimer);
    // Bir dəfə qərar verilir: `mine` hər snapshot-da dəyişir, asılılığa salsaq
    // personaj təkrar-təkrar çıxardı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!msg) return undefined;
    const hideTimer = setTimeout(() => setLeaving(true), VISIBLE_MS);
    return () => clearTimeout(hideTimer);
  }, [msg]);

  useEffect(() => {
    if (!leaving) return undefined;
    const t = setTimeout(() => { setMsg(null); setLeaving(false); }, 420);
    return () => clearTimeout(t);
  }, [leaving]);

  if (!msg) return null;

  return (
    <div
      style={{
        position: 'fixed', right: '10px', bottom: 'calc(86px + var(--safe-area-bottom, 0px))',
        zIndex: 1200, display: 'flex', alignItems: 'flex-end', gap: '8px',
        animation: leaving ? 'buddyOut .4s ease forwards' : 'buddyIn .5s cubic-bezier(.2,.9,.3,1.2)',
        // Fon toxunuşlarını udmasın — yalnız personaj və baloncuq tıklanır.
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          maxWidth: '224px', background: 'var(--bg-card)',
          border: '1px solid #7c6ff755', borderRadius: '14px',
          padding: '11px 12px', boxShadow: '0 10px 30px rgba(0,0,0,.35)',
        }}
      >
        <p style={{
          margin: 0, fontSize: '13px', lineHeight: 1.5, color: 'var(--text-primary)',
        }}>
          {msg.text}
        </p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <button
            type="button"
            onClick={() => { msg.action.run(); setLeaving(true); }}
            style={{
              padding: '6px 11px', borderRadius: '8px', border: 'none',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-strong))',
              color: '#fff', fontSize: '12px', fontWeight: 800, cursor: 'pointer',
            }}
          >
            {msg.action.label}
          </button>
          <button
            type="button"
            onClick={() => setLeaving(true)}
            style={{
              padding: '6px 10px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Bağla
          </button>
        </div>
      </div>

      {/* Kolba — logonun işarəsi, üstünə göz və qırpma əlavə olunub.
          viewBox işarənin ÖZ sərhədlərinə kəsilib: logo faylında işarənin
          sağında söz üçün boşluq var və personaj küncdə sürüşmüş görünürdü. */}
      <svg
        width="54" height="71" viewBox="26 29 76 100" aria-hidden="true"
        style={{ pointerEvents: 'auto', cursor: 'pointer', flexShrink: 0, filter: 'drop-shadow(0 6px 14px rgba(124,111,247,.35))' }}
        onClick={() => setLeaving(true)}
      >
        <defs>
          <linearGradient id="buddy-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#38BDF8" />
            <stop offset="0.55" stopColor="#6D3BEB" />
            <stop offset="1" stopColor="#A855F7" />
          </linearGradient>
          <linearGradient id="buddy-liq" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#12BBD6" />
            <stop offset="1" stopColor="#7C4DFF" />
          </linearGradient>
          <clipPath id="buddy-body"><circle cx="64" cy="88" r="30" /></clipPath>
        </defs>

        <g style={{ transformOrigin: '64px 100px', animation: 'buddyBob 3.4s ease-in-out infinite' }}>
          <g clipPath="url(#buddy-body)">
            <rect x="30" y="94" width="70" height="40" fill="url(#buddy-liq)" opacity="0.28" />
          </g>
          <path d="M46,110 L33,124 L56,116 Z" fill="url(#buddy-grad)" />
          <circle cx="64" cy="88" r="30" fill="none" stroke="url(#buddy-grad)" strokeWidth="6.5" />
          <path d="M54,36 L54,60 M74,36 L74,60" fill="none" stroke="url(#buddy-grad)" strokeWidth="6.5" strokeLinecap="round" />
          <line x1="47" y1="36" x2="81" y2="36" stroke="url(#buddy-grad)" strokeWidth="6.5" strokeLinecap="round" />
          {/* Gözlər — logodakı üç nöqtənin yerinə; qırpır. */}
          <g style={{ transformOrigin: '64px 84px', animation: 'buddyBlink 4.2s infinite' }}>
            <circle cx="55" cy="84" r="5" fill="#0f1020" />
            <circle cx="73" cy="84" r="5" fill="#0f1020" />
            <circle cx="56.6" cy="82.2" r="1.7" fill="#fff" />
            <circle cx="74.6" cy="82.2" r="1.7" fill="#fff" />
          </g>
          <path d="M57,97 Q64,102 71,97" fill="none" stroke="#0f1020" strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>

      <style>{`
        @keyframes buddyIn {
          from { opacity: 0; transform: translateY(26px) scale(.9); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes buddyOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(26px) scale(.9); }
        }
        @keyframes buddyBob {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50%      { transform: translateY(-5px) rotate(2deg); }
        }
        @keyframes buddyBlink {
          0%, 92%, 100% { transform: scaleY(1); }
          95%           { transform: scaleY(0.1); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes buddyBob { 0%, 100% { transform: none; } }
        }
      `}</style>
    </div>
  );
}
