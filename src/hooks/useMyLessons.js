import { useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
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

// The lessons a teacher (or the admin) TEACHES, with each student's name, for
// their own Today / Plan "Coming up" (Polad 2026-10-06: the teacher should see
// the next lesson and get into its topic in one tap). The rules let a teacher
// read lessons only with `teacherId == me`, which is exactly this query.
export function useTeachingLessons(uid, enabled) {
  const [lessons, setLessons] = useState([]);
  useEffect(() => {
    if (!uid || !enabled) { setLessons([]); return undefined; }
    const names = {};
    let alive = true;
    // The names are fetched after each snapshot; a slower fetch for an OLDER
    // snapshot must not overwrite a newer list.
    let seq = 0;
    const unsub = onSnapshot(
      query(collection(db, 'tutorLessons'), where('teacherId', '==', uid)),
      async (snap) => {
        const mine = ++seq;
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const missing = [...new Set(all.map((l) => l.uid))].filter((u) => u && !(u in names));
        await Promise.all(missing.map(async (u) => {
          const s = await getDoc(doc(db, 'users', u)).catch(() => null);
          names[u] = s && s.exists() ? (s.get('name') || '') : '';
        }));
        if (alive && mine === seq) setLessons(all.map((l) => ({ ...l, studentName: names[l.uid] || 'Student' })).sort(byDate));
      },
      () => setLessons([]),
    );
    return () => { alive = false; unsub(); };
  }, [uid, enabled]);
  return lessons;
}
