import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseSlotId, hourLabel } from '../utils/practiceSlots';
import { sfxStep, sfxPop, sfxBlip, sfxBoing, sfxGiggle, sfxPeek } from '../utils/sfx';

// Kolba — SpeakLab-ın canlı personajı.
//
// DÖRD REJİM, hər birinin öz məqsədi var:
//   • peek  — küncdən yarımçıq boylanır, ətrafa baxır, geri gizlənir. Zarafat.
//   • walk  — ekranın altından keçir. Sadəcə yaşayır.
//   • talk  — dayanıb SUAL verir. Nadir: gündə ən çox 2 dəfə.
//   • poke  — toxunulanda tullanır və reaksiya verir. Hər rejimin üstündən keçir.
//
// ANİMASİYA PRİNSİPLƏRİ (canlılıq hissi bunlardan gəlir, sadəcə hərəkətdən yox):
//   – anticipation: tullanmadan əvvəl bir anlıq yastılaşır;
//   – squash & stretch: qalxanda uzanır, yerə düşəndə yastılanır;
//   – overshoot & settle: hədəfi bir az keçib geri oturur;
//   – secondary action: maye gövdədə ləngiyərək çalxalanır, gözlər qırpır.
// Hamısı CSS keyframe-lərdədir — JS-də kadr dövrü yoxdur, telefonu yormur.
//
// NİYƏ 3D DEYİL: three.js ~150KB + daimi GPU dövrü. Bundle onsuz da 672KB-dır
// və tətbiq ucuz Android telefonlarda işləyir; küncdəki personaj üçün üçüncü
// ölçü ekranda heç nə qazandırmır.
//
// NİYƏ CANLI AI DEYİL: dediyi hər cümlə tətbiqin ONSUZ DA bildiyi faktdır —
// token xərci, gecikmə və uydurma riski yoxdur. Bələdçidir, partnyor deyil.
const STORE_KEY = 'speaklab_buddy_v1';
const MAX_TALKS_PER_DAY = 2;
const MIN_TALK_GAP_MS = 3 * 60 * 60 * 1000;
const TALK_DELAY_MS = 5000;
const TALK_VISIBLE_MS = 14000;

const WALK_MS = 15000;
const PEEK_MS = 4200;
const FIRST_ANTIC_MS = 20000;
const GAP_MIN_MS = 62000;
const GAP_MAX_MS = 118000;
const STEP_MS = 260;
const POKE_MS = 900;

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

// Toxunuş replikaları — sayı artdıqca personaj "bezir". Kiçik detaldır, amma
// təkrar toxunanda eyni cavabı almaq personajı dərhal cansız göstərir.
const POKE_LINES = ['Ay!', 'Yenə?', 'Qıdıqlanıram!', 'Bəsdir də 😅', 'Başım gicəllənir…'];

// Yalnız REAL vəziyyətdən doğan suallar. Heç biri uyğun gəlmirsə personaj
// danışmır — gəzintisi və boylanması qalır.
function pickMessage(user, mine, navigate, openBoard) {
  const uc = mine?.upcomingCall;
  if (uc) {
    const parsed = parseSlotId(uc.slotId);
    const startMs = Number(uc.startMs) || parsed?.startMs || 0;
    const mins = Math.round((startMs - Date.now()) / 60000);
    if (mins > 0 && mins <= 90) {
      return {
        text: `${hourLabel(parsed?.hour ?? 0)} zənginə ${mins} dəqiqə qalıb. Hazırsan?`,
        actions: [{ label: 'Hazıram 💪', run: () => {} }],
      };
    }
    return null;
  }

  if (!mine?.slotIds?.length) {
    return {
      text: 'Bu gün üçün slot seçmisən?',
      actions: [
        { label: 'Hələ yox — seçək', run: openBoard },
        { label: 'Sonra', run: () => {} },
      ],
    };
  }

  const streak = Number(user?.streak) || 0;
  if (streak > 0 && user?.lastCallDate !== new Date().toDateString()) {
    return {
      text: `${streak} günlük seriyan var — bu gün hələ danışmamısan. Partnyor tapaq?`,
      actions: [{ label: 'Tapaq', run: () => navigate('/') }],
    };
  }

  return null;
}

// ─── Personajın rəsmi ────────────────────────────────────────────
function Character({ walking, face, size = 76 }) {
  const limb = walking ? 'buddyLimb .52s linear infinite' : 'none';
  const limbAlt = walking ? 'buddyLimbAlt .52s linear infinite' : 'none';
  const h = Math.round(size * 1.42);

  // Baxış istiqaməti — boylananda göz bəbəkləri yana sürüşür, "ətrafa baxır".
  const look = face === 'peek' ? 2.6 : 0;
  const wide = face === 'surprised';
  const dizzy = face === 'dizzy';
  const eyeR = wide ? 7 : 5;

  return (
    <svg
      width={size} height={h} viewBox="18 28 92 132" aria-hidden="true"
      style={{ display: 'block', filter: 'drop-shadow(0 8px 18px rgba(124,111,247,.4))' }}
    >
      <defs>
        {/* gradientUnits="userSpaceOnUse" MƏCBURİDİR: standart objectBoundingBox
            qradiyenti hər formanın öz sərhəd qutusuna görə hesablayır, ayaq isə
            ŞAQULİ, pəncə ÜFÜQİ xəttdir — qutunun bir ölçüsü sıfır olur,
            qradiyent təyinsiz qalır və xətt HEÇ ÇƏKİLMİR. Personaj bir versiya
            boyu yalnız başdan ibarət görünürdü, səbəb məhz bu idi. */}
        <linearGradient id="buddy-grad" x1="20" y1="30" x2="108" y2="158" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#38BDF8" />
          <stop offset="0.55" stopColor="#6D3BEB" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
        <linearGradient id="buddy-liq" x1="30" y1="128" x2="100" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#12BBD6" />
          <stop offset="1" stopColor="#7C4DFF" />
        </linearGradient>
        <clipPath id="buddy-body"><circle cx="64" cy="88" r="30" /></clipPath>
      </defs>

      <g style={{
        transformOrigin: '64px 140px',
        animation: walking ? 'buddyStride .52s ease-in-out infinite' : 'buddyBob 3.4s ease-in-out infinite',
      }}>
        <g style={{ transformOrigin: '57px 114px', animation: limb }}>
          <line x1="57" y1="112" x2="57" y2="140" stroke="url(#buddy-grad)" strokeWidth="6" strokeLinecap="round" />
          <line x1="57" y1="141" x2="48" y2="141" stroke="url(#buddy-grad)" strokeWidth="6" strokeLinecap="round" />
        </g>
        <g style={{ transformOrigin: '71px 114px', animation: limbAlt }}>
          <line x1="71" y1="112" x2="71" y2="140" stroke="url(#buddy-grad)" strokeWidth="6" strokeLinecap="round" />
          <line x1="71" y1="141" x2="62" y2="141" stroke="url(#buddy-grad)" strokeWidth="6" strokeLinecap="round" />
        </g>

        {/* Qollar ayaqlarla ƏKS fazada — təbii yeriş belə alınır. Təəccüblənəndə
            hər ikisi yuxarı qalxır. */}
        <g style={{ transformOrigin: '38px 90px', animation: wide ? 'buddyArmUpL .5s ease forwards' : limbAlt }}>
          <line x1="38" y1="90" x2="24" y2="104" stroke="url(#buddy-grad)" strokeWidth="6" strokeLinecap="round" />
        </g>
        <g style={{ transformOrigin: '90px 90px', animation: wide ? 'buddyArmUpR .5s ease forwards' : limb }}>
          <line x1="90" y1="90" x2="104" y2="104" stroke="url(#buddy-grad)" strokeWidth="6" strokeLinecap="round" />
        </g>

        {/* Maye — gövdədən bir az GECİKMƏ ilə çalxalanır (secondary action). */}
        <g clipPath="url(#buddy-body)">
          <g style={{ transformOrigin: '64px 110px', animation: 'buddySlosh 2.6s ease-in-out infinite' }}>
            <rect x="26" y="94" width="78" height="42" fill="url(#buddy-liq)" opacity="0.32" />
          </g>
        </g>
        <circle cx="64" cy="88" r="30" fill="var(--bg-primary)" fillOpacity="0.55" />
        <circle cx="64" cy="88" r="30" fill="none" stroke="url(#buddy-grad)" strokeWidth="6.5" />
        <path d="M54,36 L54,60 M74,36 L74,60" fill="none" stroke="url(#buddy-grad)" strokeWidth="6.5" strokeLinecap="round" />
        <line x1="47" y1="36" x2="81" y2="36" stroke="url(#buddy-grad)" strokeWidth="6.5" strokeLinecap="round" />

        {dizzy ? (
          <>
            <path d="M50,80 L60,88 M60,80 L50,88" stroke="#0f1020" strokeWidth="3" strokeLinecap="round" />
            <path d="M68,80 L78,88 M78,80 L68,88" stroke="#0f1020" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="64" cy="99" rx="6" ry="4" fill="#0f1020" />
          </>
        ) : (
          <>
            <g style={{ transformOrigin: '64px 84px', animation: 'buddyBlink 4.6s infinite' }}>
              <circle cx="55" cy="84" r={eyeR} fill="#0f1020" />
              <circle cx="73" cy="84" r={eyeR} fill="#0f1020" />
              <circle cx={56.6 + look} cy="82.2" r="1.9" fill="#fff" />
              <circle cx={74.6 + look} cy="82.2" r="1.9" fill="#fff" />
            </g>
            {wide
              ? <ellipse cx="64" cy="99" rx="5" ry="6" fill="#0f1020" />
              : <path d="M56,96 Q64,103 72,96" fill="none" stroke="#0f1020" strokeWidth="3" strokeLinecap="round" />}
          </>
        )}
      </g>
    </svg>
  );
}

export default function LabBuddy({ user, mine, onOpenBoard }) {
  const [mode, setMode] = useState(null);   // null | 'peek' | 'walk' | 'talk'
  const [dir, setDir] = useState(1);        // 1 = sağ, -1 = sol
  const [top, setTop] = useState(null);     // boylanma hündürlüyü (%)
  const [msg, setMsg] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const [poke, setPoke] = useState(null);   // {line, dizzy}
  const modeRef = useRef(null);
  const pokeCount = useRef(0);
  const navigate = useNavigate();

  modeRef.current = mode;

  const clearAmbient = useCallback(() => {
    if (modeRef.current === 'walk' || modeRef.current === 'peek') setMode(null);
  }, []);

  // ── Zarafat dövrü: növbə ilə boylanma və gəzinti ───────────────
  useEffect(() => {
    if (reducedMotion()) return undefined;
    let endTimer;
    let nextTimer;
    let turn = 0;

    const schedule = (delay) => {
      nextTimer = setTimeout(() => {
        // Personaj məşğuldursa (sual göstərir) növbəti tam fasiləni gözləmirik —
        // qısa müddətdən sonra yenidən cəhd edilir. Əks halda tətbiqi açan adam
        // ilk zarafatı ümumiyyətlə görmürdü: planlayıcı 20-ci saniyədə giriş
        // sualına ilişib buraxırdı və növbəti şans 1–2 dəqiqə sonra gəlirdi.
        if (modeRef.current !== null) {
          schedule(12000);
          return;
        }
        // Boylanma daha tez-tez olur: qısadır, kənardadır, heç nəyi kəsmir.
        // Hər üçüncü dəfə tam gəzintiyə çıxır.
        const peeking = turn % 3 !== 2;
        turn += 1;
        setDir(Math.random() < 0.5 ? 1 : -1);
        if (peeking) {
          setTop(24 + Math.random() * 46);
          setMode('peek');
          sfxPeek();
          endTimer = setTimeout(clearAmbient, PEEK_MS);
        } else {
          setMode('walk');
          endTimer = setTimeout(clearAmbient, WALK_MS);
        }
        schedule(GAP_MIN_MS + Math.random() * (GAP_MAX_MS - GAP_MIN_MS));
      }, delay);
    };

    schedule(FIRST_ANTIC_MS);
    return () => { clearTimeout(nextTimer); clearTimeout(endTimer); };
  }, [clearAmbient]);

  useEffect(() => {
    if (mode !== 'walk') return undefined;
    const id = setInterval(sfxStep, STEP_MS);
    return () => clearInterval(id);
  }, [mode]);

  // ── Sual ───────────────────────────────────────────────────────
  useEffect(() => {
    const q = readQuota();
    if (q.count >= MAX_TALKS_PER_DAY) return undefined;
    if (Date.now() - (q.lastMs || 0) < MIN_TALK_GAP_MS) return undefined;

    const t = setTimeout(() => {
      const picked = pickMessage(user, mine, navigate, onOpenBoard);
      if (!picked) return;
      setMsg(picked);
      setMode('talk');
      bumpQuota();
      sfxPop();
      setTimeout(sfxBlip, 280);
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

  // ── Toxunuş reaksiyası ─────────────────────────────────────────
  const handlePoke = useCallback((e) => {
    e.stopPropagation();
    pokeCount.current += 1;
    const n = pokeCount.current;
    const dizzy = n >= POKE_LINES.length;
    setPoke({ line: POKE_LINES[Math.min(n - 1, POKE_LINES.length - 1)], dizzy });
    if (n === 1) sfxBoing(); else sfxGiggle();
    setTimeout(() => setPoke(null), POKE_MS + 500);
  }, []);

  if (!mode) return null;

  const walking = mode === 'walk';
  const peeking = mode === 'peek';
  const face = poke ? (poke.dizzy ? 'dizzy' : 'surprised') : (peeking ? 'peek' : 'normal');

  // Boylanma ekranın kənarındadır; gəzinti aşağıda; sual sağ küncdə.
  const placement = peeking
    ? {
      top: `${top}%`,
      ...(dir === 1 ? { right: 0 } : { left: 0 }),
      animation: `${dir === 1 ? 'buddyPeekR' : 'buddyPeekL'} ${PEEK_MS}ms cubic-bezier(.3,1.3,.4,1) forwards`,
    }
    : walking
      ? {
        left: 0,
        bottom: 'calc(72px + var(--safe-area-bottom, 0px))',
        animation: `${dir === 1 ? 'buddyCrossR' : 'buddyCrossL'} ${WALK_MS}ms linear forwards`,
      }
      : {
        right: '10px',
        bottom: 'calc(76px + var(--safe-area-bottom, 0px))',
        animation: leaving ? 'buddyOut .4s ease forwards' : 'buddyIn .55s cubic-bezier(.2,1.4,.4,1)',
      };

  return (
    <div
      style={{
        position: 'fixed', zIndex: 1200,
        display: 'flex', alignItems: 'flex-end', gap: '8px',
        pointerEvents: 'none',
        ...placement,
      }}
    >
      {msg && mode === 'talk' && (
        <div style={{
          pointerEvents: 'auto',
          maxWidth: '228px', background: 'var(--bg-card)',
          border: '1px solid #7c6ff755', borderRadius: '14px',
          padding: '12px', boxShadow: '0 12px 34px rgba(0,0,0,.4)',
          marginBottom: '14px',
        }}>
          <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.5, color: 'var(--text-primary)', fontWeight: 600 }}>
            {msg.text}
          </p>
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
            {msg.actions.map((a, i) => (
              <button
                key={a.label}
                type="button"
                onClick={() => { a.run(); setLeaving(true); }}
                style={{
                  padding: '6px 11px', borderRadius: '8px',
                  border: i === 0 ? 'none' : '1px solid var(--border)',
                  background: i === 0
                    ? 'linear-gradient(135deg, var(--accent), var(--accent-strong))'
                    : 'transparent',
                  color: i === 0 ? '#fff' : 'var(--text-secondary)',
                  fontSize: '12px', fontWeight: 800, cursor: 'pointer',
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        data-buddy={mode}
        style={{
          position: 'relative',
          // Toxunuş HƏR rejimdə işləyir — gəzərkən də tutmaq olar.
          pointerEvents: 'auto', cursor: 'pointer',
          transform: dir === -1 && walking ? 'scaleX(-1)' : 'none',
          // Küncdə yarımçıq görünsün deyə boylanmada bir az kənara çıxır.
          animation: poke ? `buddyPoke ${POKE_MS}ms cubic-bezier(.3,1.5,.5,1)` : 'none',
        }}
        onPointerDown={handlePoke}
      >
        {poke && (
          <span style={{
            position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)',
            background: '#fff', color: '#0f1020', fontSize: '12px', fontWeight: 800,
            padding: '3px 9px', borderRadius: '20px', whiteSpace: 'nowrap',
            animation: 'buddyShout .5s cubic-bezier(.2,1.6,.4,1)',
            boxShadow: '0 4px 12px rgba(0,0,0,.3)',
          }}>
            {poke.line}
          </span>
        )}
        <Character walking={walking} face={face} size={peeking ? 68 : 76} />
      </div>

      <style>{`
        @keyframes buddyIn {
          from { opacity: 0; transform: translateY(30px) scale(.85); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes buddyOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(30px) scale(.85); }
        }
        @keyframes buddyCrossR {
          from { transform: translateX(-90px); }
          to   { transform: translateX(100vw); }
        }
        @keyframes buddyCrossL {
          from { transform: translateX(100vw); }
          to   { transform: translateX(-90px); }
        }
        /* Boylanma: çıxır, bir az geri çəkilir (overshoot), baxır, gizlənir. */
        @keyframes buddyPeekR {
          0%   { transform: translateX(100%); }
          20%  { transform: translateX(34%); }
          30%  { transform: translateX(44%); }
          72%  { transform: translateX(38%); }
          100% { transform: translateX(100%); }
        }
        @keyframes buddyPeekL {
          0%   { transform: translateX(-100%); }
          20%  { transform: translateX(-34%); }
          30%  { transform: translateX(-44%); }
          72%  { transform: translateX(-38%); }
          100% { transform: translateX(-100%); }
        }
        /* Toxunuş: yastılanır (anticipation) → uzanaraq tullanır → yerə düşəndə
           yenə yastılanır → kiçik sıçrayışla oturur. */
        @keyframes buddyPoke {
          0%   { transform: translateY(0) scale(1, 1); }
          12%  { transform: translateY(2px) scale(1.16, .84); }
          38%  { transform: translateY(-30px) scale(.88, 1.14); }
          62%  { transform: translateY(0) scale(1.14, .88); }
          80%  { transform: translateY(-8px) scale(.97, 1.04); }
          100% { transform: translateY(0) scale(1, 1); }
        }
        @keyframes buddyShout {
          from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(.6); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @keyframes buddyBob {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50%      { transform: translateY(-5px) rotate(2deg); }
        }
        @keyframes buddyStride {
          0%, 100% { transform: translateY(0) scaleY(1); }
          50%      { transform: translateY(-4px) scaleY(1.03); }
        }
        /* Maye gövdədən gec çatır — kütlə hissi yaradan detal. */
        @keyframes buddySlosh {
          0%, 100% { transform: rotate(-4deg) translateY(0); }
          50%      { transform: rotate(4deg) translateY(-2px); }
        }
        @keyframes buddyLimb {
          0%, 100% { transform: rotate(22deg); }
          50%      { transform: rotate(-22deg); }
        }
        @keyframes buddyLimbAlt {
          0%, 100% { transform: rotate(-22deg); }
          50%      { transform: rotate(22deg); }
        }
        @keyframes buddyArmUpL {
          to { transform: rotate(-115deg); }
        }
        @keyframes buddyArmUpR {
          to { transform: rotate(115deg); }
        }
        @keyframes buddyBlink {
          0%, 92%, 100% { transform: scaleY(1); }
          95%           { transform: scaleY(0.1); }
        }
      `}</style>
    </div>
  );
}
