import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { subscribeToCycle } from '../utils/cycle';
import { subscribeToSessionConfig } from '../utils/sessionSchedule';
import { weeklyContent } from '../data/weeklyContent';
import {
  COURSE_TOPIC_COUNT,
  getTopicsCompleted,
} from '../utils/courseProgress';
import { homeworkStepKeys, isClassCohort, lessonSummary, topicsSinceJoin } from '../utils/cohortLessons';
import './homework/homework.css';
import './cohort/cohort.css';

const lessonWhen = (ms) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Baku', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
}).format(new Date(ms));

// A member of a class cohort: lesson X/N as one dot per lesson (coral = held,
// the progress colour), the next lesson's time and topic once the teacher has
// picked it. A lesson counts only when the teacher marked it held.
function ClassCard({ cohort, lessons, homework }) {
  const navigate = useNavigate();
  const s = useMemo(() => lessonSummary(cohort, lessons), [cohort, lessons]);
  if (!s) return null;
  const nextTopic = s.next && Number.isInteger(s.next.topicIndex) ? weeklyContent[s.next.topicIndex]?.topic : null;
  return (
    <div className="cls-card">
      <div className="cls-top">
        <span className="cls-title">Lesson {s.held}/{s.total}</span>
        <span className="cls-name">{cohort.name || 'Your class'}</span>
      </div>
      <div className="cls-dots" aria-hidden="true">
        {s.lessons.map((l) => (
          <span key={l.n} className={`cls-dot${l.status === 'held' ? ' cls-dot--held' : ''}`} />
        ))}
      </div>
      <p className="cls-line">
        {s.next
          ? <>Next: <b>{lessonWhen(s.next.startMs)}</b>{nextTopic && <> · {nextTopic}</>}</>
          : s.ended ? 'Your class has finished.' : 'All lessons are done.'}
      </p>
      {homework.length > 0 && (
        <div className="cls-hw">
          {homework.slice(0, 2).map((h) => {
            const keys = homeworkStepKeys(h.personal);
            const left = keys.filter((k) => !(h.doneSteps || []).includes(k)).length;
            return (
              <button key={h.id} type="button" className={`cls-hw-row${left === 0 ? ' is-done' : ''}`} onClick={() => navigate(`/homework/${h.id}`)}>
                <span className="cls-hw-name">Homework · lesson {h.n}</span>
                <span className="cls-hw-left">{left === 0 ? 'Done' : `${left} of ${keys.length} steps left`}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Kurs vəziyyəti kartı — Home-da əsas aksiyanın ALTINDA dayanır.
// - Kurs useri: Mövzu X/30 + proqres barı + kohort adı.
// - pending/accepted: müraciət statusu.
// - Trial/premium/köhnə userlər: heç nə (sınaq yalnız Profil-də görünür).
export default function CourseProgressCard({ user }) {
  const [cycle, setCycle] = useState(null);
  const [cohort, setCohort] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [sessionConfig, setSessionConfig] = useState(null);

  useEffect(() => subscribeToCycle(setCycle), []);
  useEffect(() => subscribeToSessionConfig(setSessionConfig), []);

  // Kohort otağı hissi: öz kohort sənədindən (rules üzvə GET icazəsi verir)
  // ad + üzv sayı real vaxtda. Kohortsuz userdə heç nə oxunmur.
  const cohortId = (user.mode === 'course' || user.cohortStatus === 'active') ? user.cohortId : null;
  useEffect(() => {
    if (!cohortId) { setCohort(null); return undefined; }
    return onSnapshot(
      doc(db, 'cohorts', cohortId),
      (snap) => setCohort(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      () => setCohort(null)
    );
  }, [cohortId]);

  // A class cohort's lessons (topic + held), read only once the cohort turns
  // out to be a class.
  const classId = isClassCohort(cohort) ? cohort.id : null;
  useEffect(() => {
    if (!classId) { setLessons([]); return undefined; }
    return onSnapshot(
      collection(db, 'cohorts', classId, 'lessons'),
      (snap) => setLessons(snap.docs.map((d) => d.data())),
      () => setLessons([])
    );
  }, [classId]);

  // This member's open homework for the class, newest lesson first.
  const [homework, setHomework] = useState([]);
  const uid = user.uid;
  useEffect(() => {
    if (!classId || !uid) { setHomework([]); return undefined; }
    return onSnapshot(
      query(collection(db, 'homework'), where('uid', '==', uid), where('cohortId', '==', classId)),
      (snap) => setHomework(snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((h) => !h.hidden).sort((a, b) => b.n - a.n)),
      () => setHomework([])
    );
  }, [classId, uid]);

  if (classId) return <ClassCard cohort={cohort} lessons={lessons} homework={homework} />;

  const cardStyle = {
    background: 'var(--accent-soft)',
    border: '1px solid var(--accent-ring)',
    borderRadius: '16px',
    padding: '14px 16px',
    marginTop: '12px',
    marginBottom: '12px',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  };

  const completed = getTopicsCompleted(user, cycle);

  if (completed !== null) {
    const pct = Math.round((completed / COURSE_TOPIC_COUNT) * 100);
    const done = completed >= COURSE_TOPIC_COUNT;

    // Yığcam: bir başlıq sətri, nazik bar, bir alt sətir — Home yığını
    // hündür kartlarla qarışmasın.
    return (
      <div style={{ ...cardStyle, padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '7px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
            📖 Topic {completed}/{COURSE_TOPIC_COUNT}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>{pct}%</span>
        </div>

        <div style={{
          height: '6px', borderRadius: '3px', overflow: 'hidden',
          background: 'var(--accent-soft)',
        }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--accent), var(--accent-strong))',
            borderRadius: '3px',
            transition: 'width 0.6s ease',
          }} />
        </div>

        {(done || cohort) && (
          <div style={{
            marginTop: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {done
              ? 'Course complete'
              : <> <b style={{ color: 'var(--text-primary)' }}>{cohort.name || cohort.title || 'Kohortunuz'}</b>
                  {Number(cohort.memberCount) > 0 && <> · {Number(cohort.memberCount)} members</>}</>}
          </div>
        )}
      </div>
    );
  }

  // Kohorta müraciət edib gözləyən / qəbul edilmiş — kurs hələ başlamayıb.
  if (user.cohortStatus === 'accepted') {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
          ✅ You have been accepted
        </div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Waiting for the course to start. Topics open as soon as an admin starts it.
        </div>
      </div>
    );
  }
  if (user.cohortStatus === 'pending') {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
          ⏳ Your application has been sent
        </div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Waiting for admin approval. You will see it here once accepted.
        </div>
      </div>
    );
  }

  // Everyone outside a cohort follows the general course: how far the shared
  // daily topics have moved since they joined. Progress only — no lessons, no
  // homework (those belong to a class), and no sales line. The trial counter
  // still lives only on Profile.
  const general = cohortId ? null : topicsSinceJoin(user, sessionConfig, COURSE_TOPIC_COUNT);
  if (general !== null && sessionConfig) {
    const pct = Math.round((general / COURSE_TOPIC_COUNT) * 100);
    return (
      <div style={{ ...cardStyle, padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '7px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
            General course · Topic {general}/{COURSE_TOPIC_COUNT}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>{pct}%</span>
        </div>
        <div style={{ height: '6px', borderRadius: '3px', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--coral)', borderRadius: '3px' }} />
        </div>
      </div>
    );
  }
  return null;
}
