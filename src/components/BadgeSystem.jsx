// Badge System - Speak2Them
// Place in src/components/BadgeSystem.jsx

import React, { useEffect, useState } from 'react';
import { BADGE_DEFINITIONS, BADGE_ORDER } from '../badges/config';
import { checkNewBadges as checkBadgeUnlocks } from '../badges/checker';

function SimpleBadgeIcon({ colors, motif = 'star' }) {
  const [start, mid, end] = colors;
  const gradientId = `badge-${motif}-${start.replace('#', '')}`;

  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={gradientId} cx="50%" cy="28%" r="72%">
          <stop offset="0%" stopColor={mid}/>
          <stop offset="100%" stopColor={end}/>
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill={`url(#${gradientId})`}/>
      <circle cx="24" cy="24" r="22" fill="none" stroke={mid} strokeWidth="1.5" strokeOpacity=".55"/>
      {motif === 'moon' && (
        <>
          <path d="M30 12c-6 1.5-10 6-10 12s4 10.5 10 12c-8 2-16-4-16-12s8-14 16-12Z" fill="white" fillOpacity=".92"/>
          <circle cx="32" cy="16" r="2" fill="white" fillOpacity=".8"/>
          <circle cx="35" cy="25" r="1.5" fill="white" fillOpacity=".65"/>
        </>
      )}
      {motif === 'bolt' && (
        <path d="M27 9 15 27h8l-2 12 12-18h-8l2-12Z" fill="white" fillOpacity=".92"/>
      )}
      {motif === 'spark' && (
        <>
          <path d="M24 9l3.4 10.2H38l-8.6 6.2 3.3 10.1L24 29.3l-8.7 6.2 3.3-10.1L10 19.2h10.6L24 9Z" fill="white" fillOpacity=".92"/>
          <circle cx="36" cy="12" r="2" fill="white" fillOpacity=".75"/>
          <circle cx="12" cy="35" r="1.8" fill="white" fillOpacity=".6"/>
        </>
      )}
      {motif === 'person' && (
        <>
          <circle cx="24" cy="18" r="6" fill="white" fillOpacity=".92"/>
          <path d="M13 36c1.8-7 7-10 11-10s9.2 3 11 10" fill="white" fillOpacity=".85"/>
        </>
      )}
      {motif === 'clock' && (
        <>
          <circle cx="24" cy="24" r="12" stroke="white" strokeWidth="3" fill="none"/>
          <path d="M24 17v8l6 3" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        </>
      )}
      {motif === 'crown' && (
        <path d="M12 32h24l2-15-8 6-6-10-6 10-8-6 2 15Z" fill="white" fillOpacity=".92"/>
      )}
    </svg>
  );
}

export const BADGES = {
  first_call: {
    id: 'first_call', label: 'First Words', desc: 'Made your first call',
    tier: 'bronze', glow: '#5b3fa8',
    colors: ['#5b3fa8', '#8a6fd8', '#5b3fa8'],
    Icon: () => (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="ic1" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ded4ff"/>
            <stop offset="100%" stopColor="#241c52"/>
          </radialGradient>
        </defs>
        <circle cx="24" cy="24" r="22" fill="url(#ic1)"/>
        <circle cx="24" cy="24" r="22" fill="none" stroke="#8a6fd8" strokeWidth="1.5" strokeOpacity=".5"/>
        <path d="M17 26c0-3.9 3.1-7 7-7s7 3.1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        <line x1="31" y1="26" x2="33" y2="30" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="24" cy="24" r="3" fill="white"/>
        <path d="M18 20 Q24 14 30 20" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeOpacity=".6"/>
        <path d="M15 18 Q24 10 33 18" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeOpacity=".3"/>
      </svg>
    ),
  },
  chatterbox: {
    id: 'chatterbox', label: 'Chatterbox', desc: '10 calls completed',
    tier: 'silver', glow: '#8f85dd',
    colors: ['#8f85dd', 'var(--text-primary)', '#403a7e'],
    Icon: () => (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="ic2" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="var(--text-primary)"/>
            <stop offset="100%" stopColor="#2e2960"/>
          </radialGradient>
        </defs>
        <circle cx="24" cy="24" r="22" fill="url(#ic2)"/>
        <rect x="11" y="13" width="16" height="11" rx="3.5" fill="white" fillOpacity=".9"/>
        <path d="M14 24 L12 29 L18 26" fill="white" fillOpacity=".9"/>
        <rect x="21" y="20" width="16" height="11" rx="3.5" fill="white"/>
        <path d="M34 31 L36 36 L30 33" fill="white"/>
        <circle cx="17" cy="18.5" r="1.5" fill="#2e2960"/>
        <circle cx="21" cy="18.5" r="1.5" fill="#2e2960"/>
        <circle cx="25" cy="25.5" r="1.5" fill="#2e2960"/>
        <circle cx="29" cy="25.5" r="1.5" fill="#2e2960"/>
        <circle cx="33" cy="25.5" r="1.5" fill="#2e2960"/>
      </svg>
    ),
  },
  social_butterfly: {
    id: 'social_butterfly', label: 'Social Butterfly', desc: '50 calls completed',
    tier: 'gold', glow: '#b6a6ff',
    colors: ['var(--warning)', '#ded4ff', '#5b3fa8'],
    Icon: () => (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="ic3" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ded4ff"/>
            <stop offset="100%" stopColor="#3b3183"/>
          </radialGradient>
        </defs>
        <circle cx="24" cy="24" r="22" fill="url(#ic3)"/>
        <ellipse cx="15" cy="19" rx="6" ry="9" transform="rotate(-25 15 19)" fill="white" fillOpacity=".9"/>
        <ellipse cx="33" cy="19" rx="6" ry="9" transform="rotate(25 33 19)" fill="white" fillOpacity=".9"/>
        <ellipse cx="15" cy="30" rx="5" ry="6" transform="rotate(20 15 30)" fill="white" fillOpacity=".7"/>
        <ellipse cx="33" cy="30" rx="5" ry="6" transform="rotate(-20 33 30)" fill="white" fillOpacity=".7"/>
        <path d="M24 15 Q25 20 24 33" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="24" cy="14" r="2.5" fill="white"/>
        <path d="M21 12 Q24 10 27 12" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      </svg>
    ),
  },
  week_warrior: {
    id: 'week_warrior', label: 'Week Warrior', desc: '7-day streak',
    tier: 'fire', glow: '#8c4a91',
    colors: ['#8c4a91', 'var(--warning)', 'var(--danger)'],
    Icon: () => (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="ic4" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="var(--warning)"/>
            <stop offset="100%" stopColor="#4c2a72"/>
          </radialGradient>
        </defs>
        <circle cx="24" cy="24" r="22" fill="url(#ic4)"/>
        <path d="M24 10 C24 10 20 16 20 20 C16 18 17 14 17 14 C15 17 14 21 16 25 C18 29 22 31 24 31 C26 31 30 29 32 25 C34 21 33 17 31 14 C31 14 32 18 28 20 C28 16 24 10 24 10Z" fill="white" fillOpacity=".95"/>
        <path d="M22 24 C22 24 21 26 22 28 C23 30 25 30 26 28 C27 26 25 24 25 24" fill="white" fillOpacity=".5"/>
      </svg>
    ),
  },
  monthly_master: {
    id: 'monthly_master', label: 'Monthly Master', desc: '30-day streak',
    tier: 'platinum', glow: '#6f5ad0',
    colors: ['#6f5ad0', '#c9baff', '#403a7e'],
    Icon: () => (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="ic5" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#c9baff"/>
            <stop offset="100%" stopColor="#2e2960"/>
          </radialGradient>
        </defs>
        <circle cx="24" cy="24" r="22" fill="url(#ic5)"/>
        <path d="M24 10 L27 18 L36 18 L29 23 L32 32 L24 27 L16 32 L19 23 L12 18 L21 18 Z" fill="white" fillOpacity=".95"/>
        <path d="M24 14 L26.2 20.5 L33 20.5 L27.5 24.5 L29.5 31.5 L24 27.5 L18.5 31.5 L20.5 24.5 L15 20.5 L21.8 20.5 Z" fill="white" fillOpacity=".4"/>
      </svg>
    ),
  },
  beginner: {
    id: 'beginner', label: 'Getting Started', desc: '60 minutes spoken',
    tier: 'bronze', glow: '#5b3fa8',
    colors: ['#5b3fa8', '#8a6fd8', '#2e2960'],
    Icon: () => (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="ic6" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ded4ff"/>
            <stop offset="100%" stopColor="#241c52"/>
          </radialGradient>
        </defs>
        <circle cx="24" cy="24" r="22" fill="url(#ic6)"/>
        <circle cx="24" cy="24" r="12" stroke="white" strokeWidth="2.5" fill="none"/>
        <path d="M24 17 L24 24 L29 27" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="24" cy="13" r="2" fill="white"/>
        <circle cx="35" cy="24" r="2" fill="white"/>
        <circle cx="24" cy="35" r="2" fill="white"/>
        <circle cx="13" cy="24" r="2" fill="white"/>
      </svg>
    ),
  },
  expert: {
    id: 'expert', label: 'Expert Speaker', desc: '1000 minutes spoken',
    tier: 'diamond', glow: '#4a5bb0',
    colors: ['#4a5bb0', '#c9baff', '#2b2668'],
    Icon: () => (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="ic7" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#c9baff"/>
            <stop offset="100%" stopColor="#2b2668"/>
          </radialGradient>
        </defs>
        <circle cx="24" cy="24" r="22" fill="url(#ic7)"/>
        <polygon points="24,10 27.5,19 38,19 29.5,25 33,35 24,29 15,35 18.5,25 10,19 20.5,19" fill="white" fillOpacity=".15" stroke="white" strokeWidth="1.5"/>
        <polygon points="24,13 27,21 35,21 28.5,25.5 31,33 24,28.5 17,33 19.5,25.5 13,21 21,21" fill="white" fillOpacity=".9"/>
      </svg>
    ),
  },
  legend: {
    id: 'legend', label: 'L E G E N D', desc: '5000 minutes spoken',
    tier: 'legend', glow: '#dbd0ff',
    colors: ['#f0ecff', 'var(--warning)', '#2e2960'],
    Icon: () => (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="ic8" cx="50%" cy="20%" r="80%">
            <stop offset="0%" stopColor="#f4f2fc"/>
            <stop offset="50%" stopColor="var(--warning)"/>
            <stop offset="100%" stopColor="#241c52"/>
          </radialGradient>
          <linearGradient id="ic8s" x1="12" y1="8" x2="36" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff"/>
            <stop offset="40%" stopColor="#ded4ff"/>
            <stop offset="100%" stopColor="#5b3fa8"/>
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="22" fill="url(#ic8)"/>
        <circle cx="24" cy="24" r="22" fill="none" stroke="#ded4ff" strokeWidth="2" strokeOpacity=".6"/>
        <polygon points="24,8 27.8,17.5 38.5,17.5 30,23.5 33,34 24,28 15,34 18,23.5 9.5,17.5 20.2,17.5" fill="url(#ic8s)"/>
        <polygon points="24,8 27.8,17.5 38.5,17.5 30,23.5 33,34 24,28 15,34 18,23.5 9.5,17.5 20.2,17.5" fill="none" stroke="white" strokeWidth="1" strokeOpacity=".4"/>
        <circle cx="24" cy="8" r="2" fill="white" fillOpacity=".8"/>
        <circle cx="38.5" cy="17.5" r="2" fill="white" fillOpacity=".8"/>
        <circle cx="33" cy="34" r="2" fill="white" fillOpacity=".8"/>
        <circle cx="15" cy="34" r="2" fill="white" fillOpacity=".8"/>
        <circle cx="9.5" cy="17.5" r="2" fill="white" fillOpacity=".8"/>
      </svg>
    ),
  },
  well_rated: {
    id: 'well_rated', label: 'Well Rated', desc: '4.5+ average rating',
    tier: 'gold', glow: '#b6a6ff',
    colors: ['var(--warning)', '#ded4ff', '#5b3fa8'],
    Icon: () => (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="ic9" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#f0ecff"/>
            <stop offset="100%" stopColor="#3b3183"/>
          </radialGradient>
        </defs>
        <circle cx="24" cy="24" r="22" fill="url(#ic9)"/>
        <path d="M24 12 L27 20 L36 20 L29 25.5 L32 34 L24 28.5 L16 34 L19 25.5 L12 20 L21 20 Z" fill="white" fillOpacity=".95"/>
        <path d="M19 19 Q24 15 29 19" stroke="#3b3183" strokeWidth="1" fill="none" strokeOpacity=".3"/>
        <circle cx="24" cy="11" r="1.5" fill="white" fillOpacity=".6"/>
      </svg>
    ),
  },
  night_owl: {
    id: 'night_owl', label: 'Night Owl',
    desc: 'Made a call between 22:00-02:00',
    tier: 'silver', glow: '#5b3fa8',
    colors: ['#5b3fa8', '#b6a6ff', '#2e2960'],
    reward: { type: 'bonusMinutes', value: 10 },
    Icon: () => <SimpleBadgeIcon colors={['#5b3fa8', '#b6a6ff', '#2e2960']} motif="moon"/>,
  },
  marathon: {
    id: 'marathon', label: 'Marathon Speaker',
    desc: 'Single call over 45 minutes',
    tier: 'gold', glow: '#b6a6ff',
    colors: ['var(--warning)', '#ded4ff', '#5b3fa8'],
    reward: { type: 'bonusMinutes', value: 20 },
    Icon: () => <SimpleBadgeIcon colors={['var(--warning)', '#ded4ff', '#5b3fa8']} motif="clock"/>,
  },

  profile_pro: {
    id: 'profile_pro', label: 'Profile Pro',
    desc: 'Filled bio and set level',
    tier: 'bronze', glow: '#5b3fa8',
    colors: ['#5b3fa8', '#8a6fd8', '#2e2960'],
    reward: { type: 'bonusMinutes', value: 5 },
    Icon: () => <SimpleBadgeIcon colors={['#5b3fa8', '#8a6fd8', '#2e2960']} motif="person"/>,
  },
  century: {
    id: 'century', label: 'Century Club',
    desc: '100 total calls completed',
    tier: 'platinum', glow: '#6f5ad0',
    colors: ['#6f5ad0', '#c9baff', '#403a7e'],
    reward: { type: 'discountPremium', value: 30 },
    Icon: () => <SimpleBadgeIcon colors={['#6f5ad0', '#c9baff', '#403a7e']} motif="spark"/>,
  },
  daily_devotee: {
    id: 'daily_devotee', label: 'Daily Devotee',
    desc: '14-day streak',
    tier: 'fire', glow: '#8c4a91',
    colors: ['#8c4a91', 'var(--warning)', '#6d3583'],
    reward: { type: 'trialPremium', value: 3 },
    Icon: () => <SimpleBadgeIcon colors={['#8c4a91', 'var(--warning)', '#6d3583']} motif="bolt"/>,
  },
  speed_connector: {
    id: 'speed_connector', label: 'Speed Connector',
    desc: 'Found a match in under 30 seconds',
    tier: 'silver', glow: '#6f5ad0',
    colors: ['#6f5ad0', '#c9baff', '#403a7e'],
    reward: { type: 'bonusMinutes', value: 5 },
    Icon: () => <SimpleBadgeIcon colors={['#6f5ad0', '#c9baff', '#403a7e']} motif="bolt"/>,
  },
  premium_curious: {
    id: 'premium_curious', label: 'Pro Curious',
    desc: 'Visited the Pro page',
    tier: 'gold', glow: '#b6a6ff',
    colors: ['var(--warning)', '#ded4ff', '#5b3fa8'],
    reward: { type: 'discountPremium', value: 10 },
    Icon: () => <SimpleBadgeIcon colors={['var(--warning)', '#ded4ff', '#5b3fa8']} motif="crown"/>,
  },
  five_star: {
    id: 'five_star', label: 'Five Star',
    desc: 'Received a 5-star rating',
    tier: 'legend', glow: '#dbd0ff',
    colors: ['#f0ecff', 'var(--warning)', '#2e2960'],
    reward: { type: 'bonusMinutes', value: 15 },
    Icon: () => <SimpleBadgeIcon colors={['#f0ecff', 'var(--warning)', '#2e2960']} motif="spark"/>,
  },
};

// Tiers are seven steps of the one purple, not seven metals. They must stay
// LITERAL hexes: every use below concatenates an alpha suffix onto them
// (`${t.border}50`), which a var() would turn into nonsense — three tiers were
// already silently borderless for exactly that reason. The values are the
// dark-theme steps written out, because this card always draws on a dark
// surface of its own regardless of the app theme.
const TIER_STYLES = {
  bronze:   { bg: '#241e48', border: '#5b3fa8', shine: '#8a6fd8' },
  silver:   { bg: '#1e1940', border: '#8f85dd', shine: '#c8c2e4' },
  gold:     { bg: '#241e48', border: '#b6a6ff', shine: '#ded4ff' },
  fire:     { bg: '#241e48', border: '#8c4a91', shine: '#dfa6f0' },
  platinum: { bg: '#1e1940', border: '#a37fe8', shine: '#c9baff' },
  diamond:  { bg: '#171331', border: '#8fa3e8', shine: '#c9baff' },
  legend:   { bg: '#241e48', border: '#dbd0ff', shine: '#f0ecff' },
};

const BADGE_VISUALS = {
  ...BADGES,
  ten_minutes: { ...BADGES.beginner, id: 'ten_minutes', tier: 'bronze' },
  streak_3: { ...BADGES.week_warrior, id: 'streak_3', tier: 'fire' },
  ten_calls: { ...BADGES.chatterbox, id: 'ten_calls', tier: 'silver' },
  explorer: { ...BADGES.monthly_master, id: 'explorer', tier: 'platinum' },
};

function getBadgeVisual(badgeId) {
  const visual = BADGE_VISUALS[badgeId];
  const definition = BADGE_DEFINITIONS[badgeId];
  if (!visual) return null;

  return {
    ...visual,
    label: definition?.label || visual.label,
    desc: definition?.description || visual.desc,
    conditionText: definition?.conditionText,
    rewardText: definition?.rewardText,
  };
}

function Confetti({ color, x }) {
  const size = 6 + Math.random() * 6;
  const dur = 1.5 + Math.random();
  const isCircle = Math.random() > 0.5;
  return (
    <div style={{
      position: 'absolute', top: 0, left: x,
      width: size, height: isCircle ? size : size * 1.8,
      background: color, borderRadius: isCircle ? '50%' : '2px',
      animation: `cfFall ${dur}s ease-in forwards`,
      transform: `rotate(${Math.random()*360}deg)`,
      opacity: 0,
    }}/>
  );
}

export function BadgeUnlockModal({ badge, rewardMessage, onClose }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!badge) { setPhase(0); return; }
    const t1 = setTimeout(() => setPhase(1), 200);
    const t2 = setTimeout(() => setPhase(2), 700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [badge]);

  if (!badge) return null;
  const b = getBadgeVisual(badge);
  if (!b) return null;
  const t = TIER_STYLES[b.tier];

  const particles = Array.from({ length: 40 }, (_, i) => ({
    color: b.colors[i % b.colors.length],
    x: `${Math.random() * 100}%`,
    key: i,
  }));

  return (
    <>
      <style>{`
        @keyframes cfFall {
          0%   { opacity:1; transform: translateY(0) rotate(0deg) }
          100% { opacity:0; transform: translateY(500px) rotate(${Math.random()>0.5?'+':'-'}${360+Math.random()*360}deg) }
        }
        @keyframes bdBackdrop { from{opacity:0} to{opacity:1} }
        @keyframes bdCard {
          0%   { opacity:0; transform: scale(0.5) translateY(40px) }
          65%  { opacity:1; transform: scale(1.06) translateY(-6px) }
          82%  { transform: scale(0.97) translateY(2px) }
          100% { transform: scale(1) translateY(0) }
        }
        @keyframes bdBadge {
          0%   { opacity:0; transform: scale(0) rotate(-200deg) }
          65%  { opacity:1; transform: scale(1.15) rotate(8deg) }
          82%  { transform: scale(0.94) rotate(-4deg) }
          100% { transform: scale(1) rotate(0deg) }
        }
        @keyframes bdShimmer {
          0%   { transform: translateX(-120%) skewX(-20deg) }
          100% { transform: translateX(400%) skewX(-20deg) }
        }
        @keyframes bdGlow {
          0%,100% { opacity:.7 }
          50%      { opacity:1 }
        }
        @keyframes bdRing {
          0%   { transform:scale(1); opacity:.6 }
          100% { transform:scale(2.5); opacity:0 }
        }
        @keyframes bdText {
          from { opacity:0; transform: translateY(10px) }
          to   { opacity:1; transform: translateY(0) }
        }
      `}</style>

      <div onClick={onClose} style={{
        position:'fixed', inset:0, zIndex:99999,
        display:'flex', alignItems:'center', justifyContent:'center',
        background:'var(--overlay)', backdropFilter:'blur(12px)',
        animation:'bdBackdrop .3s ease forwards',
      }}>
        {/* confetti */}
        <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
          {phase>=1 && particles.map(p=>(
            <Confetti key={p.key} color={p.color} x={p.x}/>
          ))}
        </div>

        {/* card */}
        <div onClick={e=>e.stopPropagation()} style={{
          background: `radial-gradient(ellipse at 50% 0%, ${t.border}18 0%, ${t.bg} 60%)`,
          border:`1.5px solid ${t.border}50`,
          borderRadius:28, padding:'44px 36px 32px',
          textAlign:'center', width:300, position:'relative',
          overflow:'hidden',
          animation:'bdCard .9s cubic-bezier(.34,1.56,.64,1) .1s both',
          boxShadow:'0 24px 60px rgba(0,0,0,.55)',
        }}>
          {/* shimmer */}
          {phase>=1 && (
            <div style={{
              position:'absolute', inset:0, pointerEvents:'none',
              background:'linear-gradient(105deg,transparent 30%,rgba(255,255,255,.12) 50%,transparent 70%)',
              animation:'bdShimmer 1s ease .4s forwards',
            }}/>
          )}
          {/* top label */}
          <div style={{
            fontSize:10, fontWeight:800, letterSpacing:'4px',
            color:t.border, textTransform:'uppercase', marginBottom:22,
            animation:'bdText .4s ease .6s both',
          }}>Badge Unlocked</div>

          {/* icon area */}
          <div style={{position:'relative', display:'inline-block', marginBottom:20}}>
            {/* rings */}
            {phase>=1 && [0,1,2].map(i=>(
              <div key={i} style={{
                position:'absolute',
                inset: -12 - i*4,
                borderRadius:'50%',
                border:`1.5px solid ${t.border}`,
                animation:`bdRing 1.8s ease-out ${i*.35}s infinite`,
              }}/>
            ))}
            {/* glow bg */}
            <div style={{
              width:100, height:100, borderRadius:'50%',
              background:`radial-gradient(circle, ${b.glow}2e 0%, transparent 70%)`,
              display:'flex', alignItems:'center', justifyContent:'center',
              animation:'bdGlow 2s ease-in-out infinite',
            }}>
              <div style={{
                width:72, height:72,
                animation:'bdBadge .9s cubic-bezier(.34,1.56,.64,1) .35s both',
              }}>
                <b.Icon/>
              </div>
            </div>
          </div>

          {/* name */}
          <div style={{
            fontSize:22, fontWeight:800, color:'#fff',
            letterSpacing: b.tier==='legend'?'4px':'0',
            marginBottom:6,
            animation:'bdText .4s ease .8s both',
          }}>{b.label}</div>

          {/* desc */}
          <div style={{
            fontSize:13, fontWeight: 600, color:'var(--text-muted)', marginBottom:10,
            animation:'bdText .4s ease .92s both',
          }}>{b.desc}</div>

          {(rewardMessage || b.rewardText) && (
            <div style={{
              background:`${t.border}18`,
              border:`1px solid ${t.border}45`,
              borderRadius:12,
              padding:'10px 12px',
              color:'#fff',
              fontSize:12,
              fontWeight:700,
              lineHeight:1.4,
              marginBottom:14,
              animation:'bdText .4s ease 1s both',
            }}>
              You earned: {rewardMessage || b.rewardText}
            </div>
          )}

          {/* tier pill */}
          <div style={{
            display:'inline-block', marginBottom:24,
            background:`${t.border}18`, border:`1px solid ${t.border}55`,
            color:t.border, fontSize:10, fontWeight:800,
            letterSpacing:'3px', padding:'4px 16px', borderRadius:20,
            textTransform:'uppercase',
            animation:'bdText .4s ease 1.05s both',
          }}>{b.tier}</div>

          {/* button */}
          <button onClick={onClose} style={{
            display:'block', width:'100%', padding:'13px',
            background:`linear-gradient(135deg, ${b.colors[0]}, ${b.colors[2]})`,
            border:'none', borderRadius:14,
            color: b.tier==='silver'?'#241e48':'#fff',
            fontSize:15, fontWeight:700, cursor:'pointer',
            animation:'bdText .4s ease 1.15s both',
            transition:'transform .15s, box-shadow .15s',
          }}
            onMouseEnter={e=>{e.target.style.transform='scale(1.03)'}}
            onMouseLeave={e=>{e.target.style.transform='scale(1)'}}
          >Awesome!</button>
        </div>
      </div>
    </>
  );
}

export function BadgeCard({ badgeId, earned=true }) {
  const b = getBadgeVisual(badgeId);
  if (!b) return null;
  const t = TIER_STYLES[b.tier];
  return (
    <div style={{
      background: earned ? `radial-gradient(ellipse at 50% 0%, ${t.border}15 0%, ${t.bg} 70%)` : '#171331',
      border:`1px solid ${earned ? t.border+'55' : 'var(--bg-card)'}`,
      borderRadius:16, padding:'14px 10px',
      textAlign:'center', position:'relative', overflow:'hidden',
      opacity: earned ? 1 : 0.72,
      transition:'transform .2s, box-shadow .2s', cursor:'default',
    }}
      onMouseEnter={e=>{
        if(!earned) return;
        e.currentTarget.style.transform='translateY(-4px)';
        e.currentTarget.style.borderColor=t.border;
      }}
      onMouseLeave={e=>{
        e.currentTarget.style.transform='translateY(0)';
        e.currentTarget.style.boxShadow='none';
      }}
    >
      <div style={{width:44,height:44,margin:'0 auto 8px', filter:earned?'none':'grayscale(1)'}}>
        <b.Icon/>
      </div>
      <div style={{fontSize:11,fontWeight:700,color:earned?'#fff':'#ded4ff',lineHeight:1.3}}>{b.label}</div>
      <div style={{
        fontSize:9,
        fontWeight:600,
        color:earned?'#a49dc6':'#6f5ad0',
        lineHeight:1.35,
        marginTop:6,
      }}>
        How to earn: {b.conditionText || b.desc}
      </div>
      {b.rewardText && (
        <div style={{
          fontSize:9,
          fontWeight:700,
          color:earned?t.border:'#605c78',
          lineHeight:1.35,
          marginTop:5,
        }}>
          Reward: {b.rewardText}
        </div>
      )}
      {earned && (
        <div style={{
          position:'absolute',top:6,right:6,
          width:7,height:7,borderRadius:'50%',
          background:t.border, boxShadow:`0 0 6px ${t.border}`,
        }}/>
      )}
    </div>
  );
}

export function BadgeGrid({ earnedBadges=[] }) {
  return (
    <div>
      <div style={{fontSize:11,fontWeight:800,color:'#555',marginBottom:6,letterSpacing:'2px',textTransform:'uppercase'}}>
        Badges · {earnedBadges.filter(id => BADGE_ORDER.includes(id)).length}/{BADGE_ORDER.length}
      </div>
      <div style={{fontSize:11, fontWeight: 600,color:'var(--text-muted)',lineHeight:1.4,marginBottom:12}}>
        Each badge shows how to earn it.
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(98px,1fr))',gap:10}}>
        {BADGE_ORDER.map(id=>(
          <BadgeCard key={id} badgeId={id} earned={earnedBadges.includes(id)}/>
        ))}
      </div>
    </div>
  );
}

function AchievementTile({ badgeId, earned, onPreview }) {
  const b = getBadgeVisual(badgeId);
  if (!b) return null;
  const t = TIER_STYLES[b.tier];

  return (
    <button
      type="button"
      onClick={earned ? undefined : onPreview}
      aria-label={`${b.label}${earned ? '' : ' locked'}`}
      style={{
        width:'100%',
        minHeight:112,
        borderRadius:16,
        border:`1px solid ${earned ? t.border+'55' : '#292251'}`,
        background: earned ? `radial-gradient(ellipse at 50% 0%, ${t.border}16 0%, ${t.bg} 72%)` : '#1e1940',
        color:'#fff',
        padding:'16px 8px 14px',
        position:'relative',
        overflow:'hidden',
        textAlign:'center',
        fontFamily:'inherit',
        cursor:earned?'default':'pointer',
        opacity:earned?1:.74,
        transition:'transform .2s ease, box-shadow .2s ease, opacity .2s ease',
      }}
      onMouseEnter={e=>{
        e.currentTarget.style.transform='translateY(-4px) scale(1.02)';
        e.currentTarget.style.boxShadow='0 10px 24px rgba(0,0,0,.30)';
      }}
      onMouseLeave={e=>{
        e.currentTarget.style.transform='translateY(0) scale(1)';
        e.currentTarget.style.boxShadow='none';
      }}
    >
      <div style={{
        width:54,
        height:54,
        margin:'0 auto 9px',
        opacity:earned?1:.48,
        filter:earned ? 'none' : 'grayscale(1)',
      }}>
        <b.Icon/>
      </div>
      <div style={{fontSize:11,fontWeight:800,lineHeight:1.25,color:earned?'#fff':'#c9baff'}}>
        {b.label}
      </div>
      {earned && (
        <div style={{
          position:'absolute',
          top:8,
          right:8,
          width:7,
          height:7,
          borderRadius:'50%',
          background:t.border,
          boxShadow:`0 0 8px ${t.border}`,
        }}/>
      )}
    </button>
  );
}

function LockedBadgePreview({ badgeId, onClose }) {
  if (!badgeId) return null;
  const b = getBadgeVisual(badgeId);
  if (!b) return null;
  const t = TIER_STYLES[b.tier];

  return (
    <>
      <style>{`
        @keyframes achievementBackdropIn { from { opacity:0 } to { opacity:1 } }
        @keyframes achievementModalIn {
          from { opacity:0; transform:scale(.92) translateY(10px) }
          to { opacity:1; transform:scale(1) translateY(0) }
        }
        @keyframes achievementBadgeIn {
          from { opacity:0; transform:scale(.78) }
          to { opacity:1; transform:scale(1) }
        }
      `}</style>
      <div
        onClick={onClose}
        style={{
          position:'fixed',
          inset:0,
          zIndex:99999,
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          padding:24,
          background:'var(--overlay)',
          backdropFilter:'blur(10px)',
          animation:'achievementBackdropIn .2s ease both',
        }}
      >
        <div
          onClick={e=>e.stopPropagation()}
          style={{
            width:'min(320px, 100%)',
            padding:'30px 24px 24px',
            borderRadius:22,
            textAlign:'center',
            background:`radial-gradient(ellipse at 50% 0%, ${t.border}22 0%, #171331 58%, #171331 100%)`,
            border:`1px solid ${t.border}42`,
            boxShadow:'0 24px 70px rgba(0,0,0,.62)',
            animation:'achievementModalIn .28s cubic-bezier(.2,.9,.2,1) both',
          }}
        >
          <div style={{
            width:112,
            height:112,
            margin:'0 auto 18px',
            borderRadius:'50%',
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            background:`radial-gradient(circle, ${b.glow}36 0%, transparent 68%)`,
            animation:'achievementBadgeIn .32s cubic-bezier(.2,.9,.2,1) .06s both',
          }}>
            <div style={{width:82,height:82,filter:'grayscale(1) drop-shadow(0 14px 28px rgba(0,0,0,.35))',opacity:.68}}>
              <b.Icon/>
            </div>
          </div>
          <div style={{fontSize:20,fontWeight:800,color:'#fff',marginBottom:10}}>{b.label}</div>
          <div style={{display:'grid',gap:8,textAlign:'left'}}>
            <div style={{background:'#ffffff08',border:'1px solid #ffffff10',borderRadius:12,padding:'10px 12px'}}>
              <div style={{fontSize:10,fontWeight:800,letterSpacing:'1.8px',textTransform:'uppercase',color:'#605c78',marginBottom:4}}>Requirement</div>
              <div style={{fontSize:13,fontWeight:700,color:'#ebe8fb',lineHeight:1.35}}>{b.conditionText || b.desc}</div>
            </div>
            {b.rewardText && (
              <div style={{background:`${t.border}12`,border:`1px solid ${t.border}35`,borderRadius:12,padding:'10px 12px'}}>
                <div style={{fontSize:10,fontWeight:800,letterSpacing:'1.8px',textTransform:'uppercase',color:t.border,marginBottom:4}}>Reward</div>
                <div style={{fontSize:13,fontWeight:700,color:'#fff',lineHeight:1.35}}>{b.rewardText}</div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width:'100%',
              marginTop:18,
              padding:'12px 14px',
              borderRadius:12,
              border:'1px solid #ffffff14',
              background:'#ffffff0d',
              color:'#fff',
              fontSize:14,
              fontWeight:700,
              cursor:'pointer',
              transition:'transform .18s ease, background .18s ease',
            }}
            onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.02)';e.currentTarget.style.background='#ffffff14';}}
            onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.background='#ffffff0d';}}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

export function AchievementsPanel({ earnedBadges=[] }) {
  const [previewBadge, setPreviewBadge] = useState(null);
  const earnedSet = new Set(earnedBadges);
  const earnedCount = BADGE_ORDER.filter(id => earnedSet.has(id)).length;

  return (
    <div style={{marginTop:16, animation:'fadeInUp .28s ease both'}}>
      <div style={{
        display:'flex',
        alignItems:'center',
        justifyContent:'space-between',
        marginBottom:14,
      }}>
        <div>
          <div style={{fontSize:18,fontWeight:800,color:'#fff',lineHeight:1.2}}>Achievements</div>
          <div style={{fontSize:12,fontWeight:700,color:'#605c78',marginTop:4}}>{earnedCount}/{BADGE_ORDER.length} unlocked</div>
        </div>
        <div style={{
          minWidth:58,
          padding:'8px 10px',
          border:'1px solid var(--bg-secondary)',
          borderRadius:14,
          background:'#1e1940',
          color:'#ded4ff',
          fontSize:13,
          fontWeight:800,
          textAlign:'center',
        }}>
          {Math.round((earnedCount / BADGE_ORDER.length) * 100)}%
        </div>
      </div>

      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(auto-fit,minmax(92px,1fr))',
        gap:10,
      }}>
        {BADGE_ORDER.map(id => (
          <AchievementTile
            key={id}
            badgeId={id}
            earned={earnedSet.has(id)}
            onPreview={() => setPreviewBadge(id)}
          />
        ))}
      </div>

      <LockedBadgePreview badgeId={previewBadge} onClose={()=>setPreviewBadge(null)} />
    </div>
  );
}

export function checkNewBadges(userData, callData = {}) {
  return checkBadgeUnlocks(userData, callData);
}

export default function BadgeDemo() {
  const [showing, setShowing] = useState(null);
  return (
    <div style={{background:'#171331',minHeight:'100vh',padding:'32px 20px',fontFamily:'system-ui,sans-serif',color:'#fff'}}>
      <div style={{marginBottom:8,fontSize:22,fontWeight:800}}>Badge System</div>
      <div style={{color:'#555',fontSize:12,marginBottom:28}}>Tap any badge to preview unlock animation</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,maxWidth:340}}>
        {BADGE_ORDER.map(id=>(
          <div key={id} onClick={()=>setShowing(id)} style={{cursor:'pointer'}}>
            <BadgeCard badgeId={id} earned/>
          </div>
        ))}
      </div>
      <BadgeUnlockModal badge={showing} onClose={()=>setShowing(null)}/>
    </div>
  );
}
