// What a linked teacher sees of a learner's calls, said plainly (Polad,
// 2026-11-11). Shown under the learner's own report and once at the start of
// their first call (CallRoadmap).
//
// It has to stay TRUE: the teacher reads only callAnalysisTeacher and
// insights/teacherProgress (mistake types + neutral example sentences —
// functions/analysisPrivacy.js), never the transcript or a quote, and the
// recording is deleted once the analysis is written. Change the data path and
// this line together.
export const TEACHER_PRIVACY_LINE = 'Your teacher sees your progress and the types of mistakes you make. '
  + 'Your conversations stay between you and your partner.';
