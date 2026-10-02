import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { weeklyContent } from '../../data/weeklyContent';
import { plainTopic } from '../../utils/topicLabel';
import { atMs, lessonWhen, PLATFORM_LABEL } from '../../utils/tutorLessons';
import '../cohort/cohort.css';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Teacher dashboard: every student's lessons from today to a week ahead, in
// time order — the timetable that used to live only in Preply and the
// calendar. Lessons whose time has passed but are not marked held stay at the
// top until the teacher marks them. Hidden when there are none.
export default function TeacherWeek({ uid, names = {} }) {
  const [lessons, setLessons] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!uid) return undefined;
    const from = Timestamp.fromMillis(Date.now() - 3 * 24 * 60 * 60 * 1000);
    return onSnapshot(
      query(collection(db, 'tutorLessons'), where('teacherId', '==', uid), where('at', '>=', from), orderBy('at')),
      (snap) => setLessons(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => { console.error('[TeacherWeek]', e); setLessons([]); }
    );
  }, [uid]);

  const now = Date.now();
  const rows = lessons.filter((l) => l.status === 'planned' && atMs(l) < now + WEEK_MS);
  if (rows.length === 0) return null;

  return (
    <section className="tl tw" aria-label="This week's lessons">
      <h2 className="tl-title">This week</h2>
      <ol className="cc-list">
        {rows.map((l) => {
          const topic = weeklyContent[l.topicIndex];
          const unmarked = atMs(l) < now - 60 * 60 * 1000;
          return (
            <li key={l.id}>
              <button type="button" className={`tw-row${unmarked ? ' tw-row--late' : ''}`} onClick={() => navigate(`/teacher/student/${l.uid}`)}>
                <span className="tw-when">{lessonWhen(atMs(l), 'Asia/Baku')}</span>
                <span className="tw-name">{names[l.uid] || 'Student'}</span>
                <span className="tw-topic">
                  {topic ? plainTopic(topic.topic) : 'No topic'} · {PLATFORM_LABEL[l.platform] || 'Preply'}
                  {unmarked && ' · not marked yet'}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
