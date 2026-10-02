import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { episodeFor, homeworkStepKeys, nextLesson, packageSummary, PLATFORM_LABEL } from '../../utils/tutorLessons';
import '../homework/homework.css';
import '../cohort/cohort.css';

const MAX_DOTS = 24;

// Today, for a learner with individual lessons: where they are in their
// package (one dot per lesson, coral = held — the progress colour) and the
// homework of the lessons already held. The lessons themselves — time, topic,
// the way in to their materials — are in "Coming up" with the practices.
export default function LessonsCard({ enrolment, lessons, homework }) {
  const navigate = useNavigate();
  const sum = useMemo(() => packageSummary(enrolment, lessons), [enrolment, lessons]);
  const next = useMemo(() => nextLesson(lessons), [lessons]);
  const dots = Math.min(MAX_DOTS, Math.max(sum.size, sum.held));

  return (
    <div className="cls-card">
      <div className="cls-top">
        <span className="cls-title">
          {next ? `Lesson ${episodeFor(next, lessons)} of ${sum.size}` : `${sum.held} of ${sum.size} lessons done`}
        </span>
        <span className="cls-name">{PLATFORM_LABEL[next?.platform || enrolment.platform] || 'Your lessons'}</span>
      </div>
      {dots > 0 && (
        <div className="cls-dots" aria-hidden="true">
          {Array.from({ length: dots }, (_, i) => (
            <span key={i} className={`cls-dot${i < sum.held ? ' cls-dot--held' : ''}`} />
          ))}
        </div>
      )}
      {!next && <p className="cls-line">No lesson planned yet. Your teacher will add the next one.</p>}
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
