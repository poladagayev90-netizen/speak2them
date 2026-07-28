import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseSlotId, hourLabel } from '../utils/practiceSlots';
import { sfxStep, sfxPop, sfxBlip } from '../utils/sfx';

// Kolba — SpeakLab-ın canlı personajı: qolları, ayaqları var, ekranın altında
// gəzir, bəzən dayanıb bir söz deyir və gedir.
//
// İKİ REJİM var və bu ayrılıq vacibdir:
//   • gəzinti — heç nə demir, sadəcə yaşayır. Tez-tez ola bilər, çünki heç nə
//     tələb etmir və heç nəyi kəsmir.
//   • danışıq — nadirdir (gündə ən çox 2 dəfə) və yalnız DEYƏCƏK SÖZÜ olanda.
// Əvvəlki versiyada yalnız danışıq vardı, ona görə personaj "bildiriş qutusu"
// kimi hiss olunurdu, canlı varlıq kimi yox.
//
// NİYƏ 3D DEYİL: three.js ən azı ~150KB və daimi GPU dövrü deməkdir. Bundle
// onsuz da 672KB-dır, tətbiq ucuz Android telefonlarda işləyir. Küncdəki 54px
// personaj üçün üçüncü ölçü ekranda heç nə qazandırmır, batareya yeyir.
//
// NİYƏ CANLI AI DEYİL: dediyi hər cümlə tətbiqin ONSUZ DA bildiyi faktdır —
// token xərci, gecikmə və uydurma riski yoxdur. Bu, praktika partnyoru deyil,
// bələdçidir. AI cümlə istənilsə, yalnız `pickMessage` dəyişir.
const STORE_KEY = 'speaklab_buddy_v1';
const MAX_TALKS_PER_DAY = 2;
const MIN_TALK_GAP_MS = 3 * 60 * 60 * 1000;
const TALK_DELAY_MS = 6000;
const TALK_VISIBLE_MS = 11000;

const WALK_MS = 15000;          // bir keçidin müddəti
const FIRST_WALK_MS = 22000;    // səhifə oturduqdan sonra ilk gəzinti
const WALK_GAP_MIN_MS = 95000;  // gəzintilər arası ən azı
const WALK_GAP_MAX_MS = 165000; // və ən çox
const STEP_MS = 260;            // addım səsinin ritmi (yeriş dövrü ilə uyğun)

const reducedMotion = () => typeof window !== 'undefined'
  && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
// seçilir, heç biri uyğun gəlmirsə personaj danışmır (gəzintisi qalır).
function pickMessage(user, mine, navigate) {
  const uc = mine?.upcomingCall;
  if (uc) {
    const parsed = parseSlotId(uc.slotId);
    const startMs = Number(uc.startMs) || parsed?.startMs || 0;
    const mins = Math.round((startMs - Date.now()) / 60000);
    if (mins > 0 && mins <= 90) {
      return {
        text: `${hourLabel(parsed?.hour ?? 0)} zənginə ${mins} dəqiqə qalıb. Hazırsan?`,
        action: { label: 'Bax', run: () => navigate('/') },
      };
    }
    return null;
  }

  if (!mine?.slotIds?.length) {
    return {
      text: 'Bu gün hələ vaxt seçməmisən. Bir blok seç, kimsə qoşulan kimi xəbər verərəm.',
      action: { label: 'Vaxt seç', run: () => navigate('/') },
    };
  }

  const streak = Number(user?.streak) || 0;
  if (streak > 0 && user?.lastCallDate !== new Date().toDateString()) {
    return {
      text: `${streak} günlük seriyan var — bu gün hələ danışmamısan.`,
      action: { label: 'Partnyor tap', run: () => navigate('/') },
    };
  }

  return null;
}

// ─── Personajın rəsmi ────────────────────────────────────────────
// Logonun kolbası: dairə gövdə, boyun, maye. Üstünə göz, ağız, qol və ayaq.
function Character({ walking }) {
  const limb = walking ? 'buddyLimb .52s linear infinite' : 'none';
  const limbAlt = walking ? 'buddyLimbAlt .52s linear infinite' : 'none';
  return (
    <svg
      width="58" height="82" viewBox="18 28 92 132" aria-hidden="true"
      style={{ display: 'block', filter: 'drop-shadow(0 6px 14px rgba(124,111,247,.35))' }}
    >
      <defs>
        {/* gradientUnits="userSpaceOnUse" MƏCBURİDİR. Standart olan
            objectBoundingBox qradiyenti hər formanın öz sərhəd qutusuna görə
            hesablayır; ayaq ŞAQULİ, pəncə isə ÜFÜQİ xəttdir, yəni qutunun bir
            ölçüsü sıfırdır → qradiyent təyinsiz qalır və xətt heç çəkilmir.
            Personaj ona görə yalnız başdan ibarət görünürdü. Koordinatlar
            viewBox-a bağlananda bütün üzvlər eyni qradiyenti paylaşır. */}
        <linearGradient id="buddy-grad" x1="20" y1="30" x2="108" y2="158" gradientUnits="userSpaceOnUse">
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

      <g style={{
        transformOrigin: '64px 100px',
        animation: walking ? 'buddyStride .52s ease-in-out infinite' : 'buddyBob 3.4s ease-in-out infinite',
      }}>
        {/* Ayaqlar — gövdənin ARXASINDA çəkilir ki, birləşmə yeri görünməsin. */}
        <g style={{ transformOrigin: '57px 114px', animation: limb }}>
          <line x1="57" y1="112" x2="57" y2="140" stroke="url(#buddy-grad)" strokeWidth="6" strokeLinecap="round" />
          <line x1="57" y1="141" x2="48" y2="141" stroke="url(#buddy-grad)" strokeWidth="6" strokeLinecap="round" />
        </g>
        <g style={{ transformOrigin: '71px 114px', animation: limbAlt }}>
          <line x1="71" y1="112" x2="71" y2="140" stroke="url(#buddy-grad)" strokeWidth="6" strokeLinecap="round" />
          <line x1="71" y1="141" x2="62" y2="141" stroke="url(#buddy-grad)" strokeWidth="6" strokeLinecap="round" />
        </g>

        {/* Qollar — ayaqlarla ƏKS fazada yellənir, təbii yeriş belə alınır. */}
        <g style={{ transformOrigin: '38px 90px', animation: limbAlt }}>
          <line x1="38" y1="90" x2="24" y2="104" stroke="url(#buddy-grad)" strokeWidth="6" strokeLinecap="round" />
        </g>
        <g style={{ transformOrigin: '90px 90px', animation: limb }}>
          <line x1="90" y1="90" x2="104" y2="104" stroke="url(#buddy-grad)" strokeWidth="6" strokeLinecap="round" />
        </g>

        {/* Gövdə = kolba */}
        <g clipPath="url(#buddy-body)">
          <rect x="30" y="94" width="70" height="40" fill="url(#buddy-liq)" opacity="0.3" />
        </g>
        <circle cx="64" cy="88" r="30" fill="var(--bg-primary)" fillOpacity="0.55" />
        <circle cx="64" cy="88" r="30" fill="none" stroke="url(#buddy-grad)" strokeWidth="6.5" />
        <path d="M54,36 L54,60 M74,36 L74,60" fill="none" stroke="url(#buddy-grad)" strokeWidth="6.5" strokeLinecap="round" />
        <line x1="47" y1="36" x2="81" y2="36" stroke="url(#buddy-grad)" strokeWidth="6.5" strokeLinecap="round" />

        <g style={{ transformOrigin: '64px 84px', animation: 'buddyBlink 4.6s infinite' }}>
          <circle cx="55" cy="84" r="5" fill="#0f1020" />
          <circle cx="73" cy="84" r="5" fill="#0f1020" />
          <circle cx="56.6" cy="82.2" r="1.7" fill="#fff" />
          <circle cx="74.6" cy="82.2" r="1.7" fill="#fff" />
        </g>
        <path d="M57,97 Q64,102 71,97" fill="none" stroke="#0f1020" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export default function LabBuddy({ user, mine }) {
  const [mode, setMode] = useState(null); // null | 'walk' | 'talk'
  const [dir, setDir] = useState(1);      // 1 = sağa, -1 = sola
  const [msg, setMsg] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const modeRef = useRef(null);
  const navigate = useNavigate();

  modeRef.current = mode;

  const endWalk = useCallback(() => {
    if (modeRef.current === 'walk') setMode(null);
  }, []);

  // ── Gəzinti dövrü ──────────────────────────────────────────────
  useEffect(() => {
    if (reducedMotion()) return undefined;
    let walkTimer;
    let nextTimer;

    const schedule = (delay) => {
      nextTimer = setTimeout(() => {
        // Danışırsa gəzintini keçirik — iki rejim üst-üstə düşməməlidir.
        if (modeRef.current === null) {
          setDir(Math.random() < 0.5 ? 1 : -1);
          setMode('walk');
          walkTimer = setTimeout(endWalk, WALK_MS);
        }
        schedule(WALK_GAP_MIN_MS + Math.random() * (WALK_GAP_MAX_MS - WALK_GAP_MIN_MS));
      }, delay);
    };

    schedule(FIRST_WALK_MS);
    return () => { clearTimeout(nextTimer); clearTimeout(walkTimer); };
  }, [endWalk]);

  // Addım səsi yalnız gəzinti zamanı və yeriş ritmində.
  useEffect(() => {
    if (mode !== 'walk') return undefined;
    const id = setInterval(sfxStep, STEP_MS);
    return () => clearInterval(id);
  }, [mode]);

  // ── Danışıq ────────────────────────────────────────────────────
  useEffect(() => {
    const q = readQuota();
    if (q.count >= MAX_TALKS_PER_DAY) return undefined;
    if (Date.now() - (q.lastMs || 0) < MIN_TALK_GAP_MS) return undefined;

    const t = setTimeout(() => {
      const picked = pickMessage(user, mine, navigate);
      if (!picked) return;
      setMsg(picked);
      setMode('talk');
      bumpQuota();
      sfxPop();
      setTimeout(sfxBlip, 260);
    }, TALK_DELAY_MS);
    return () => clearTimeout(t);
    // Bir dəfə qərar verilir: `mine` hər snapshot-da dəyişir, asılılığa salsaq
    // personaj təkrar-təkrar çıxardı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode !== 'talk') return undefined;
    const t = setTimeout(() => setLeaving(true), TALK_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [mode]);

  useEffect(() => {
    if (!leaving) return undefined;
    const t = setTimeout(() => { setMsg(null); setMode(null); setLeaving(false); }, 420);
    return () => clearTimeout(t);
  }, [leaving]);

  if (!mode) return null;

  const walking = mode === 'walk';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(76px + var(--safe-area-bottom, 0px))',
        zIndex: 1200,
        display: 'flex', alignItems: 'flex-end', gap: '8px',
        // Gəzərkən heç nəyə toxunulmur; yalnız danışıq baloncuğu tıklanır.
        pointerEvents: 'none',
        ...(walking
          ? { left: 0, animation: `${dir === 1 ? 'buddyCrossR' : 'buddyCrossL'} ${WALK_MS}ms linear forwards` }
          : {
            right: '10px',
            animation: leaving ? 'buddyOut .4s ease forwards' : 'buddyIn .5s cubic-bezier(.2,.9,.3,1.2)',
          }),
      }}
    >
      {msg && !walking && (
        <div style={{
          pointerEvents: 'auto',
          maxWidth: '224px', background: 'var(--bg-card)',
          border: '1px solid #7c6ff755', borderRadius: '14px',
          padding: '11px 12px', boxShadow: '0 10px 30px rgba(0,0,0,.35)',
          marginBottom: '10px',
        }}>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: 'var(--text-primary)' }}>
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
      )}

      <div
        style={{
          pointerEvents: walking ? 'none' : 'auto',
          cursor: walking ? 'default' : 'pointer',
          // Getdiyi tərəfə baxır.
          transform: dir === -1 && walking ? 'scaleX(-1)' : 'none',
        }}
        onClick={() => { if (!walking) setLeaving(true); }}
      >
        <Character walking={walking} />
      </div>

      <style>{`
        @keyframes buddyIn {
          from { opacity: 0; transform: translateY(26px) scale(.9); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes buddyOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(26px) scale(.9); }
        }
        @keyframes buddyCrossR {
          from { transform: translateX(-80px); }
          to   { transform: translateX(100vw); }
        }
        @keyframes buddyCrossL {
          from { transform: translateX(100vw); }
          to   { transform: translateX(-80px); }
        }
        @keyframes buddyBob {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50%      { transform: translateY(-5px) rotate(2deg); }
        }
        /* Yerişdə gövdə hər addımda bir az qalxıb-enir. */
        @keyframes buddyStride {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
        @keyframes buddyLimb {
          0%, 100% { transform: rotate(20deg); }
          50%      { transform: rotate(-20deg); }
        }
        @keyframes buddyLimbAlt {
          0%, 100% { transform: rotate(-20deg); }
          50%      { transform: rotate(20deg); }
        }
        @keyframes buddyBlink {
          0%, 92%, 100% { transform: scaleY(1); }
          95%           { transform: scaleY(0.1); }
        }
      `}</style>
    </div>
  );
}
