// The relationship is authoritative; roster status also prevents late rollups
// from making a removed student visible again.
async function removeStudent(db, fieldValue, teacherUid, studentUid) {
  const fail = (status, message) => Object.assign(new Error(message), { httpStatus: status });
  if (typeof studentUid !== 'string' || !studentUid || studentUid.includes('/') || studentUid.length > 128 || studentUid === teacherUid) throw fail(400, 'invalid-student');
  return db.runTransaction(async tx => {
    const studentRef = db.collection('users').doc(studentUid);
    const teacherRef = db.collection('teachers').doc(teacherUid);
    const publicRef = db.collection('users').doc(teacherUid);
    const rosterRef = teacherRef.collection('roster').doc(studentUid);
    const [student, teacher, profile, roster] = await Promise.all([studentRef, teacherRef, publicRef, rosterRef].map(ref => tx.get(ref)));
    if (!student.exists) throw fail(404, 'student-not-found');
    if (student.data().teacherId !== teacherUid) {
      if (!student.data().teacherId && roster.data()?.status === 'removed') return { removed: true };
      throw fail(403, 'not-your-student');
    }
    tx.update(studentRef, { teacherId: fieldValue.delete(), teacherLinkedAt: fieldValue.delete(), teacherConsentAt: fieldValue.delete() });
    tx.set(rosterRef, { status: 'removed', removedAt: fieldValue.serverTimestamp() }, { merge: true });
    if (teacher.exists) tx.update(teacherRef, { studentCount: Math.max(0, (Number(teacher.data().studentCount) || 0) - 1) });
    if (profile.exists) tx.update(publicRef, { tutorStudentCount: Math.max(0, (Number(profile.data().tutorStudentCount) || 0) - 1) });
    return { removed: true };
  });
}
module.exports = { removeStudent };
