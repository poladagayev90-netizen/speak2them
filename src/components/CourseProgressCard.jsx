import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { subscribeToCycle } from '../utils/cycle';
import {
  COURSE_TOPIC_COUNT,
  getTopicsCompleted,
  getTrialDaysLeft,
} from '../utils/courseProgress';

// Home-un yuxarısındakı "finish xətti" kartı.
// - Kurs useri: Mövzu X/28 + neon-bənövşəyi proqres barı + hesablanmış
//   finish tarixi (sessionDays/bonusDays ritmindən).
// - Trial useri: "Sınaq: X gün qaldı" + incə "Kodla tam giriş" linki.
// - Digərləri (premium/köhnə userlər): heç nə göstərmir.
export default function CourseProgressCard({ user }) {
  const [cycle, setCycle] = useState(null);
  const [cohort, setCohort] = useState(null);
  const navigate = useNavigate();

  useEffect(() => subscribeToCycle(setCycle), []);

  // Kohort otağı hissi: öz kohort sənədindən (rules üzvə GET icazəsi verir)
  // ad + üzv sayı real vaxtda. Kohortsuz userdə heç nə oxunmur.
  const cohortId = user.mode === 'course' ? user.cohortId : null;
  useEffect(() => {
    if (!cohortId) { setCohort(null); return undefined; }
    return onSnapshot(
      doc(db, 'cohorts', cohortId),
      (snap) => setCohort(snap.exists() ? snap.data() : null),
      () => setCohort(null)
    );
  }, [cohortId]);

  const cardStyle = {
    background: 'linear-gradient(135deg, rgba(124,111,247,0.14), rgba(91,77,232,0.10))',
    border: '1px solid rgba(124,111,247,0.35)',
    borderRadius: '16px',
    padding: '14px 16px',
    marginBottom: '12px',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  };

  const completed = getTopicsCompleted(user, cycle);

  if (completed !== null) {
    const pct = Math.round((completed / COURSE_TOPIC_COUNT) * 100);
    const done = completed >= COURSE_TOPIC_COUNT;

    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary, #fff)' }}>
            📖 Mövzu {completed}/{COURSE_TOPIC_COUNT}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#7c6ff7' }}>{pct}%</span>
        </div>

        <div style={{
          height: '8px', borderRadius: '4px', overflow: 'hidden',
          background: 'rgba(124,111,247,0.15)', marginBottom: '8px',
        }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: 'linear-gradient(90deg, #7c6ff7, #5b4de8)',
            borderRadius: '4px',
            boxShadow: '0 0 8px rgba(124,111,247,0.6)',
            transition: 'width 0.6s ease',
          }} />
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-secondary, #aaa)' }}>
          {done
            ? '🏁 Kurs tamamlandı!'
            : 'Hər sessiya günü bir mövzu irəliləyirsiniz'}
        </div>

        {cohort && (
          <div style={{
            marginTop: '10px', paddingTop: '10px',
            borderTop: '1px solid rgba(124,111,247,0.2)',
            fontSize: '12px', color: 'var(--text-secondary, #aaa)',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            🧪 <b style={{ color: 'var(--text-primary, #fff)' }}>{cohort.name || cohort.title || 'Kohortunuz'}</b>
            {Number(cohort.memberCount) > 0 && <> · {Number(cohort.memberCount)} iştirakçı</>}
          </div>
        )}
      </div>
    );
  }

  const daysLeft = getTrialDaysLeft(user);
  if (daysLeft === null) return null; // premium / pulsuz dövr / köhnə user — sakit ekran

  return (
    <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
        {daysLeft > 0 ? `⏳ Sınaq: ${daysLeft} gün qaldı` : '⏳ Sınaq müddəti bitdi'}
      </span>
      <button
        onClick={() => navigate('/redeem')}
        style={{
          background: 'none', border: 'none', color: '#7c6ff7',
          fontSize: '12px', fontWeight: 700, cursor: 'pointer',
          padding: 0, whiteSpace: 'nowrap',
        }}
      >
        Kodla tam giriş →
      </button>
    </div>
  );
}
