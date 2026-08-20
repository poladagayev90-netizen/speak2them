import React, { useEffect, useRef, useState } from 'react';
import KolbaFigure from './KolbaFigure';
import { sfxPop, sfxPeek, sfxGiggle } from '../utils/sfx';

// "Heç kim onlayn deyil" boşluğunu dolduran səhnə.
//
// Boş ekran ən pis andır: istifadəçi gəlir, heç nə tapmır və çıxır. Yerinə
// yellənçəkdə oturmuş Kolba var və İSTİFADƏÇİNİN GƏLİŞİNƏ reaksiya verir —
// qorxub qaçır, kənardan xəfifcə boylanır, sonra qayıdıb əl edir. Bir dəfəlik
// kiçik hekayədir; sonra sakitcə yellənməyə davam edir.
//
// Rejim ardıcıllığı vaxt xətti ilə qurulub, hər mərhələ öz animasiyasını
// daşıyır. Bitəndən sonra əbədi 'idle' qalır — heç nə fasiləsiz təkrarlanmır.
const PHASES = [
  { at: 1100, phase: 'startle' },
  { at: 1650, phase: 'flee' },
  { at: 2700, phase: 'peek' },
  { at: 4500, phase: 'back' },
  { at: 5600, phase: 'wave' },
  { at: 7600, phase: 'idle' },
];

const reducedMotion = () => typeof window !== 'undefined'
  && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function BuddySwing({ label }) {
  // Az hərəkət rejimində hekayə oynanmır — birbaşa oturmuş vəziyyət.
  const [phase, setPhase] = useState(reducedMotion() ? 'idle' : 'enter');
  const timers = useRef([]);

  useEffect(() => {
    if (reducedMotion()) return undefined;
    timers.current = PHASES.map(({ at, phase: p }) => setTimeout(() => {
      setPhase(p);
      if (p === 'startle') sfxPop();
      if (p === 'peek') sfxPeek();
      if (p === 'wave') sfxGiggle();
    }, at));
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const onSwing = phase === 'enter' || phase === 'startle' || phase === 'wave' || phase === 'idle';
  const face = phase === 'startle' ? 'surprised'
    : phase === 'peek' ? 'peek'
      : (phase === 'wave' || phase === 'idle') ? 'happy' : 'normal';

  // Qaçış/boylanma/qayıdış — yellənçəkdən kənar hərəkətlər.
  const looseAnim = {
    flee: 'bsFlee .95s cubic-bezier(.4,0,.7,.6) forwards',
    peek: 'bsPeek 1.8s cubic-bezier(.3,1.2,.4,1) forwards',
    back: 'bsBack 1.1s cubic-bezier(.3,.9,.4,1) forwards',
  }[phase];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0 4px' }}>
      <div style={{ position: 'relative', width: '230px', height: '208px' }}>

        {/* Çərçivə SABİTDİR — yalnız iplər və oturacaq yellənir. Əvvəl hamısı
            birlikdə fırlanırdı və dirək əyilirdi, bu da səhnəni dərhal saxta
            göstərirdi. */}
        <svg width="230" height="208" viewBox="0 0 230 208"
          style={{ position: 'absolute', inset: 0, display: 'block' }}>
          <line x1="42" y1="14" x2="188" y2="14" stroke="#5a5a80" strokeWidth="7" strokeLinecap="round" />
          <circle cx="115" cy="14" r="4" fill="#8a8ab8" />
        </svg>

        {/* Yellənən hissə. Boş qalanda da yellənməyə davam edir — personajın
            "indicə buradan tullandığı" hissini məhz bu verir. */}
        <div style={{
          position: 'absolute', inset: 0,
          transformOrigin: '115px 14px',
          animation: 'bsSwing 3.6s ease-in-out infinite',
        }}>
          {/* Rəng DÜZ boyadır, qradiyent deyil: ip şaquli xəttdir, sərhəd
              qutusunun eni sıfırdır və objectBoundingBox qradiyenti belə
              formada təyinsiz qalıb heç çəkilmir (fiqurun ayaqlarında da eyni
              tələ olmuşdu). */}
          <svg width="230" height="208" viewBox="0 0 230 208" style={{ display: 'block', overflow: 'visible' }}>
            <line x1="88" y1="14" x2="88" y2="150" stroke="#6f6f9c" strokeWidth="4" strokeLinecap="round" />
            <line x1="142" y1="14" x2="142" y2="150" stroke="#6f6f9c" strokeWidth="4" strokeLinecap="round" />
            <rect x="74" y="148" width="82" height="11" rx="5.5" fill="#6f6f9c" />
            <rect x="74" y="148" width="82" height="5" rx="2.5" fill="#9c9ccb" opacity=".75" />
          </svg>

          {onSwing && (
            /* Oturacaq y=148-dədir; fiqurun gövdə altı öz hündürlüyünün ~66%-inə
               düşür, ona görə yuxarı kənar 84px — belədə bədən taxtanın üstünə
               oturur, havada asılı qalmır. */
            <div style={{
              position: 'absolute', left: '115px', top: '84px',
              transform: 'translateX(-50%)',
              animation: phase === 'startle' ? 'bsJolt .45s cubic-bezier(.3,1.6,.5,1)' : 'none',
            }}>
              <KolbaFigure size={72} pose="sit" face={face} wave={phase === 'wave'} />
            </div>
          )}
        </div>

        {/* Yellənçəkdən kənar mərhələlər. */}
        {!onSwing && (
          <div style={{
            position: 'absolute', left: '115px', top: '92px',
            transform: 'translateX(-50%)',
            animation: looseAnim,
          }}>
            <KolbaFigure size={72} pose={phase === 'back' ? 'walk' : 'stand'} face={face} />
          </div>
        )}
      </div>

      <p style={{
        margin: '2px 0 0', fontSize: '14px', color: 'var(--text-secondary)',
        textAlign: 'center', lineHeight: 1.5,
      }}>
        {label}
      </p>
      <p style={{
        margin: '6px 0 0', fontSize: '12.5px', color: 'var(--text-muted)',
        textAlign: 'center', lineHeight: 1.5, maxWidth: '270px',
      }}>
        Pick a block above. Your call is confirmed automatically as soon as someone else joins that time.
      </p>

      <style>{`
        @keyframes bsSwing {
          0%, 100% { transform: rotate(-11deg); }
          50%      { transform: rotate(11deg); }
        }
        /* Diksinmə: bir anlıq yastılanıb yuxarı sıçrayır. */
        @keyframes bsJolt {
          0%   { transform: translateX(-50%) translateY(0) scale(1,1); }
          25%  { transform: translateX(-50%) translateY(2px) scale(1.12,.88); }
          60%  { transform: translateX(-50%) translateY(-14px) scale(.92,1.1); }
          100% { transform: translateX(-50%) translateY(0) scale(1,1); }
        }
        /* Qaçış: sağa doğru sürətlənərək kadrdan çıxır. */
        @keyframes bsFlee {
          0%   { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
          30%  { transform: translateX(-30%) translateY(-6px) scale(1.02); opacity: 1; }
          100% { transform: translateX(190px) translateY(0) scale(.86); opacity: 0; }
        }
        /* Boylanma: kənardan yarımçıq çıxır, azca geri çəkilir, baxır, qalır. */
        @keyframes bsPeek {
          0%   { transform: translateX(190px); opacity: 0; }
          25%  { transform: translateX(96px);  opacity: 1; }
          38%  { transform: translateX(108px); opacity: 1; }
          100% { transform: translateX(102px); opacity: 1; }
        }
        /* Qayıdış: yellənçəyə tərəf yeriyir. */
        @keyframes bsBack {
          0%   { transform: translateX(102px); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
