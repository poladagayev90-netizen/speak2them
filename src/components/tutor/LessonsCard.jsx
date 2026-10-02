import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { weeklyContent } from '../../data/weeklyContent';
import { plainTopic } from '../../utils/topicLabel';
import { atMs, episodeFor, homeworkStepKeys, lessonWhen, nextLesson, packageSummary, PLATFORM_LABEL } from '../../utils/tutorLessons';
import Button from '../ui/Button';
import '../homework/homework.css';
import '../cohort/cohort.css';

const MAX_DOTS = 24;

// Today, for a learner with individual lessons: where they are in their
// package (one dot per lesson, coral = held — the progress colour), the next
// lesson's time in THEIR clock and its topic, a way to prepare for it, and the
// homework of the lessons already held.
export default function LessonsCard({ enrolment, lessons, homework }) {
  const navigate = useNavigate();
  const sum = useMemo(() => packageSummary(enrolment, lessons), [enrolment, lessons]);
  const next = useMemo(() => nextLesson(lessons), [lessons]);
  const topic = next && Number.isInteger(next.topicIndex) ? weeklyContent[next.topicIndex] : null;
  const link = next?.link || '';
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
      <p className="cls-line">
        {next
          ? <>Next: <b>{lessonWhen(atMs(next))}</b>{topic && <> · {plainTopic(topic.topic)}</>}</>
          : 'No lesson planned yet. Your teacher will add the next one.'}
      </p>
      {next && (
        <div className="cls-btns">
          <Button size="sm" onClick={() => navigate(`/class/${next.id}`)}>Prepare for the lesson</Button>
          {link && (
            <a className="cls-join" href={link} target="_blank" rel="noopener noreferrer">
              Join <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
        </div>
      )}
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
