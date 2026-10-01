import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { isClassCohort } from '../../utils/cohortLessons';
import CohortClass from './CohortClass';
import './cohort.css';

// Teacher dashboard: the classes (cohorts) this teacher runs. Hidden when there
// are none, so a teacher without a class sees the dashboard as before.
export default function TeacherClasses({ uid }) {
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(
      query(collection(db, 'cohorts'), where('teacherId', '==', uid)),
      (snap) => setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(isClassCohort)),
      (e) => { console.error('[TeacherClasses]', e); setClasses([]); }
    );
  }, [uid]);

  if (classes.length === 0) return null;
  return (
    <section className="tc" aria-label="My classes">
      <h2 className="tc-title">My classes</h2>
      {classes.map((c) => (
        <div key={c.id} className="tc-class">
          <p className="tc-name">{c.name || c.id}</p>
          <CohortClass cohort={c} />
        </div>
      ))}
    </section>
  );
}
