import React, { useId } from 'react';

// Kolbanın rəsmi — LabBuddy (gəzən) və BuddySwing (yellənən) eyni fiquru
// paylaşır. Ayrı fayla çıxarılıb ki, üz ifadələri və üzvlər iki yerdə
// təkrarlanmasın: bir yerdə düzəliş edib digərini unutmaq ən asan səhvdir.
//
// Qradiyent id-ləri useId ilə unikaldır. Eyni səhifədə iki fiqur olanda sabit
// id-lər toqquşur və İKİNCİSİ birincinin qradiyentini oğurlayır — brauzer
// sənəddə eyni id-li ilk təyini götürür.
export default function KolbaFigure({
  size = 76,
  pose = 'stand',      // 'stand' | 'walk' | 'sit'
  face = 'normal',     // 'normal' | 'surprised' | 'dizzy' | 'peek' | 'happy'
  wave = false,
  glow = true,
}) {
  const uid = useId().replace(/:/g, '');
  const g = `kf-grad-${uid}`;
  const liq = `kf-liq-${uid}`;
  const clip = `kf-body-${uid}`;
  const halo = `kf-halo-${uid}`;
  const h = Math.round(size * 1.42);

  const walking = pose === 'walk';
  const sitting = pose === 'sit';
  const limb = walking ? 'kfLimb .52s linear infinite' : 'none';
  const limbAlt = walking ? 'kfLimbAlt .52s linear infinite' : 'none';

  const look = face === 'peek' ? 2.6 : 0;
  const wide = face === 'surprised';
  const dizzy = face === 'dizzy';
  const happy = face === 'happy';
  const eyeR = wide ? 7 : 5;

  // Oturuş: ayaqlar irəli sallanır, qollar ipdən yapışmaq üçün yuxarı qalxır.
  const legL = sitting ? 'rotate(-42deg)' : undefined;
  const legR = sitting ? 'rotate(-34deg)' : undefined;
  const armL = sitting ? 'rotate(78deg)' : undefined;
  const armR = sitting ? 'rotate(-78deg)' : undefined;

  return (
    <svg
      width={size} height={h} viewBox="8 18 112 152" aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        {/* userSpaceOnUse MƏCBURİDİR: standart objectBoundingBox qradiyenti hər
            formanın öz sərhəd qutusuna görə hesablanır, ayaq isə ŞAQULİ, pəncə
            ÜFÜQİ xəttdir — qutunun bir ölçüsü sıfır olur, qradiyent təyinsiz
            qalır və xətt HEÇ ÇƏKİLMİR. Personaj bir versiya boyu yalnız başdan
            ibarət görünürdü, səbəbi məhz bu idi. */}
        <linearGradient id={g} x1="20" y1="30" x2="108" y2="158" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5CCCFB" />
          <stop offset="0.5" stopColor="#8B6BF5" />
          <stop offset="1" stopColor="#C084FC" />
        </linearGradient>
        <linearGradient id={liq} x1="30" y1="128" x2="100" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#12BBD6" />
          <stop offset="1" stopColor="#7C4DFF" />
        </linearGradient>
        <clipPath id={clip}><circle cx="64" cy="88" r="30" /></clipPath>
        <radialGradient id={halo}>
          <stop offset="0" stopColor="#8B6BF5" stopOpacity="0.34" />
          <stop offset="1" stopColor="#8B6BF5" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Qaranlıq fonda fiqur itməsin deyə arxa işıq. Rənglər də bir pillə
          açıqlaşdırılıb (#38BDF8 → #5CCCFB), çünki tünd bənövşəyi fon üzərində
          orijinal ton kifayət qədər seçilmirdi. */}
      {glow && <ellipse cx="64" cy="96" rx="52" ry="58" fill={`url(#${halo})`} />}

      <g style={{
        transformOrigin: '64px 140px',
        animation: walking ? 'kfStride .52s ease-in-out infinite' : 'kfBob 3.4s ease-in-out infinite',
      }}>
        <g style={{ transformOrigin: '57px 114px', animation: limb, transform: legL }}>
          <line x1="57" y1="112" x2="57" y2="140" stroke={`url(#${g})`} strokeWidth="6" strokeLinecap="round" />
          <line x1="57" y1="141" x2="48" y2="141" stroke={`url(#${g})`} strokeWidth="6" strokeLinecap="round" />
        </g>
        <g style={{ transformOrigin: '71px 114px', animation: limbAlt, transform: legR }}>
          <line x1="71" y1="112" x2="71" y2="140" stroke={`url(#${g})`} strokeWidth="6" strokeLinecap="round" />
          <line x1="71" y1="141" x2="62" y2="141" stroke={`url(#${g})`} strokeWidth="6" strokeLinecap="round" />
        </g>

        <g style={{
          transformOrigin: '38px 90px',
          animation: wide ? 'kfArmUpL .5s ease forwards' : limbAlt,
          transform: armL,
        }}>
          <line x1="38" y1="90" x2="24" y2="104" stroke={`url(#${g})`} strokeWidth="6" strokeLinecap="round" />
        </g>
        <g style={{
          transformOrigin: '90px 90px',
          animation: wave ? 'kfWave .6s ease-in-out infinite' : (wide ? 'kfArmUpR .5s ease forwards' : limb),
          transform: wave ? undefined : armR,
        }}>
          <line x1="90" y1="90" x2="104" y2="104" stroke={`url(#${g})`} strokeWidth="6" strokeLinecap="round" />
        </g>

        {/* Maye gövdədən bir tempo GEC çalxalanır — kütlə hissini bu gecikmə verir. */}
        <g clipPath={`url(#${clip})`}>
          <g style={{ transformOrigin: '64px 110px', animation: 'kfSlosh 2.6s ease-in-out infinite' }}>
            <rect x="26" y="94" width="78" height="42" fill={`url(#${liq})`} opacity="0.34" />
          </g>
        </g>
        <circle cx="64" cy="88" r="30" fill="#0b0b1a" fillOpacity="0.72" />
        <circle cx="64" cy="88" r="30" fill="none" stroke={`url(#${g})`} strokeWidth="6.5" />
        <path d="M54,36 L54,60 M74,36 L74,60" fill="none" stroke={`url(#${g})`} strokeWidth="6.5" strokeLinecap="round" />
        <line x1="47" y1="36" x2="81" y2="36" stroke={`url(#${g})`} strokeWidth="6.5" strokeLinecap="round" />

        {dizzy ? (
          <>
            <path d="M50,80 L60,88 M60,80 L50,88" stroke="#eaeaff" strokeWidth="3" strokeLinecap="round" />
            <path d="M68,80 L78,88 M78,80 L68,88" stroke="#eaeaff" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="64" cy="99" rx="6" ry="4" fill="#eaeaff" />
          </>
        ) : happy ? (
          <>
            <path d="M49,86 Q55,78 61,86" fill="none" stroke="#eaeaff" strokeWidth="3.4" strokeLinecap="round" />
            <path d="M67,86 Q73,78 79,86" fill="none" stroke="#eaeaff" strokeWidth="3.4" strokeLinecap="round" />
            <path d="M55,95 Q64,105 73,95" fill="none" stroke="#eaeaff" strokeWidth="3.2" strokeLinecap="round" />
          </>
        ) : (
          <>
            <g style={{ transformOrigin: '64px 84px', animation: 'kfBlink 4.6s infinite' }}>
              <circle cx="55" cy="84" r={eyeR} fill="#eaeaff" />
              <circle cx="73" cy="84" r={eyeR} fill="#eaeaff" />
              <circle cx={55.8 + look} cy="85.4" r="2.1" fill="#0b0b1a" />
              <circle cx={73.8 + look} cy="85.4" r="2.1" fill="#0b0b1a" />
            </g>
            {wide
              ? <ellipse cx="64" cy="99" rx="5" ry="6" fill="#eaeaff" />
              : <path d="M56,96 Q64,103 72,96" fill="none" stroke="#eaeaff" strokeWidth="3" strokeLinecap="round" />}
          </>
        )}
      </g>

      <style>{`
        @keyframes kfBob    { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-5px) rotate(2deg)} }
        @keyframes kfStride { 0%,100%{transform:translateY(0) scaleY(1)} 50%{transform:translateY(-4px) scaleY(1.03)} }
        @keyframes kfSlosh  { 0%,100%{transform:rotate(-4deg) translateY(0)} 50%{transform:rotate(4deg) translateY(-2px)} }
        @keyframes kfLimb    { 0%,100%{transform:rotate(22deg)} 50%{transform:rotate(-22deg)} }
        @keyframes kfLimbAlt { 0%,100%{transform:rotate(-22deg)} 50%{transform:rotate(22deg)} }
        @keyframes kfArmUpL { to { transform: rotate(-115deg) } }
        @keyframes kfArmUpR { to { transform: rotate(115deg) } }
        @keyframes kfWave   { 0%,100%{transform:rotate(-118deg)} 50%{transform:rotate(-152deg)} }
        @keyframes kfBlink  { 0%,92%,100%{transform:scaleY(1)} 95%{transform:scaleY(0.1)} }
      `}</style>
    </svg>
  );
}
