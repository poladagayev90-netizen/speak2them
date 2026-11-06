import React from 'react';
import { Mic } from 'lucide-react';
import { warmupVsSelf } from '../utils/matching';

// ADMIN ONLY — what a learner's warm-up call says about them (warmupInsights/
// {uid}, written by warmupCallEnd). A model's reading of a 3-minute transcript:
// a first estimate shown NEXT TO the self-declared level, never instead of it.

const UNDERSTOOD = { well: 'understood well', mostly: 'mostly understood', struggled: 'struggled to understand' };
const TALK = { quiet: 'short answers', balanced: 'balanced answers', talkative: 'talkative' };
const VS = { higher: 'above own pick', lower: 'below own pick' };

const short = (lv) => String(lv || '').slice(0, 2).toUpperCase();

// The badge on the People row: «warm-up A2 · below own pick».
export function WarmupTag({ warmup }) {
  if (!warmup) return null;
  const ins = warmup.insight;
  if (!ins) return <span className="aa-badge">warm-up · too little speech</span>;
  const vs = VS[warmupVsSelf(warmup.selfLevel, ins.level)];
  return (
    <span className={`aa-badge ${vs ? '' : 'aa-badge--soft'}`} title={ins.summary || ''}>
      warm-up {ins.level}{vs ? ` · ${vs}` : ''}
    </span>
  );
}

export default function WarmupInsight({ warmup }) {
  if (!warmup) return null;
  const ins = warmup.insight;
  const s = warmup.stats || {};
  const when = warmup.atMs ? new Date(warmup.atMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
  return (
    <div className="wi-box">
      <h4 className="aa-sub"><Mic size={12} aria-hidden="true" /> Warm-up call {when && `· ${when}`}</h4>
      {ins ? (
        <>
          <p className="aa-line">
            <span className="aa-muted">Spoken level</span> <strong>{ins.level}</strong>
            {' '}({ins.levelSure} confidence) · own pick {short(warmup.selfLevel) || '—'}
          </p>
          <p className="aa-line">
            <span className="aa-muted">How</span> {UNDERSTOOD[ins.understood]}, {TALK[ins.talk]}
            {ins.usedL1 ? ', switched to own language' : ''}
          </p>
          {ins.about && <p className="aa-line"><span className="aa-muted">About</span> {ins.about}</p>}
          {ins.interests.length > 0 && <p className="aa-line"><span className="aa-muted">Interests</span> {ins.interests.join(', ')}</p>}
          {ins.partnerTip && <p className="aa-line"><span className="aa-muted">Partner</span> {ins.partnerTip}</p>}
          {ins.summary && <p className="aa-line wi-summary">{ins.summary}</p>}
        </>
      ) : (
        <p className="aa-line aa-muted">Not enough speech for a reading{warmup.why && warmup.why !== 'too-little-speech' ? ` (${warmup.why})` : ''}.</p>
      )}
      <p className="aa-line aa-muted wi-stats">
        {Math.round((warmup.seconds || 0) / 60 * 10) / 10} min · {s.turns || 0} answers · {s.words || 0} words · {s.avgWords || 0} per answer · longest {s.longest || 0}
      </p>
    </div>
  );
}
