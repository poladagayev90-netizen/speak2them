import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToCycle } from '../utils/cycle';
import { subscribeToSessionConfig } from '../utils/sessionSchedule';
import {
  COURSE_TOPIC_COUNT,
  getTopicsCompleted,
  getFinishDateStr,
  getTrialDaysLeft,
  formatAzDate,
} from '../utils/courseProgress';

// Home-un yuxarısındakı "finish xətti" kartı.
// - Kurs useri: Mövzu X/28 + neon-bənövşəyi proqres barı + hesablanmış
//   finish tarixi (sessionDays/bonusDays ritmindən).
// - Trial useri: "Sınaq: X gün qaldı" + incə "Kodla tam giriş" linki.
// - Digərləri (premium/köhnə userlər): heç nə göstərmir.
export default function CourseProgressCard({ user }) {
  const [cycle, setCycle] = useState(null);
  const [sessionConfig, setSessionConfig] = useState(null);
  const navigate = useNavigate();

  useEffect(() => subscribeToCycle(setCycle), []);
  useEffect(() => subscribeToSessionConfig(setSessionConfig), []);

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
    const finishStr = getFinishDateStr(completed, sessionConfig);
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
            : finishStr
              ? <>🏁 Finiş: <b style={{ color: 'var(--text-primary, #fff)' }}>{formatAzDate(finishStr)}</b></>
              : 'Sessiya günlərində bir mövzu irəliləyirsiniz'}
        </div>
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
