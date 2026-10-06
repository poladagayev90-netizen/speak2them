import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { byDate } from '../utils/tutorLessons';

// A learner's individual lessons: the enrolment (tutorStudents/{uid}: level,
// package, platform) and their lessons (tutorLessons, each with its own date).
// Rules let each learner read only their own; a missing enrolment just means
// "no lessons". `active` is false when there are none or they are paused.
// `asTeacher` (a non-admin teacher reading a student's lessons) adds the
// teacherId filter the rules need to prove access.
export default function useMyLessons(uid, asTeacher) {
  const [enrolment, setEnrolment] = useState(undefined);
  const [lessons, setLessons] = useState([]);

  useEffect(() => {
    if (!uid) { setEnrolment(null); return undefined; }
    return onSnapshot(
      doc(db, 'tutorStudents', uid),
      (snap) => setEnrolment(snap.exists() ? snap.data() : null),
      () => setEnrolment(null)
    );
  }, [uid]);

  const active = !!enrolment && enrolment.active !== false;
  const enrolled = !!enrolment;
  useEffect(() => {
    if (!uid || !enrolled) { setLessons([]); return undefined; }
    return onSnapshot(
      asTeacher
        ? query(collection(db, 'tutorLessons'), where('uid', '==', uid), where('teacherId', '==', asTeacher))
        : query(collection(db, 'tutorLessons'), where('uid', '==', uid)),
      (snap) => setLessons(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byDate)),
      () => setLessons([])
    );
  }, [uid, enrolled, asTeacher]);

  return { enrolment, lessons, active, loading: enrolment === undefined };
}
