import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { Target, Check } from 'lucide-react';
import { db } from '../firebase';
import { subscribeToMyWeek } from '../utils/attendance';
import { needsIntro } from '../utils/intro';
import './WeekGoalCard.css';

// "Your week": the practices the learner committed to in onboarding
// (weeklyTarget) against the ones that actually happened this week.
//
// Only held conversations count, and only good news is shown here — a missed
// booking is handled by the gentle SlotNoticeModal, not by a red number on the
// home screen. The goal is to make the commitment visible, not to shame.
export default function WeekGoalCard({ user }) {
  const navigate = useNavigate();
  const [target, setTarget] = useState(0);
  const [attended, setAttended] = useState(0);
  const uid = user?.uid;
  const locked = needsIntro(user);

  useEffect(() => {
    if (!uid || locked) return undefined;
    let alive = true;
    getDoc(doc(db, 'onboarding', uid))
      .then((s) => { if (alive) setTarget(Number(s.exists() && s.get('weeklyTarget')) || 0); })
      .catch(() => {});
    const unsub = subscribeToMyWeek(uid, (events) => {
      setAttended(events.filter((e) => e.outcome === 'attended').length);
    });
    return () => { alive = false; unsub(); };
  }, [uid, locked]);

  if (!target || locked) return null;

  const done = attended >= target;
  const left = Math.max(0, target - attended);
  const dots = Math.max(target, Math.min(attended, 7));

  return (
    <section className={`wg ${done ? 'is-done' : ''}`} aria-label="Your week">
      <div className="wg-head">
        <span className="wg-icon" aria-hidden="true">{done ? <Check size={18} /> : <Target size={18} />}</span>
        <span className="wg-title">Your week</span>
        <span className="wg-count">{attended}/{target}{target === 4 ? '+' : ''}</span>
      </div>
      <div className="wg-dots" role="img" aria-label={`${attended} of ${target} practices this week`}>
        {Array.from({ length: dots }, (_, i) => <span key={i} className={i < attended ? 'is-on' : ''} />)}
      </div>
      <p className="wg-text">
        {done
          ? 'Weekly goal reached. Every extra practice is a bonus.'
          : attended === 0
            ? `You planned ${target} ${target === 1 ? 'practice' : 'practices'} this week.`
            : `${left} more to reach your weekly goal.`}
        {!done && (
          <button type="button" className="wg-link" onClick={() => navigate('/live')}>Find a time</button>
        )}
      </p>
    </section>
  );
}
