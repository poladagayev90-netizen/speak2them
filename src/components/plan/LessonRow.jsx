import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ExternalLink } from 'lucide-react';
import { Button } from '../ui';
import { weeklyContent } from '../../data/weeklyContent';
import { plainTopic } from '../../utils/topicLabel';
import { whenLabel, countdownLabel } from '../../utils/planState';
import { PLATFORM_LABEL } from '../../utils/tutorLessons';
import { practiceText } from '../../data/practiceCopy';
import './plan.css';

// One individual lesson on the Plan tab's schedule, next to the booked
// practices but marked as a lesson: the topic, where it happens, and the way
// in to its materials (/class/:id — the topic sheet and the Julian episode),
// plus Join when the teacher gave a Meet link. Moving or cancelling a lesson
// is the teacher's (it happens on Preply or by message), so there is no
// Cancel here.
export default function LessonRow({ lesson, now, lang = 'en' }) {
  const pt = (k, v) => practiceText(lang, k, v);
  const navigate = useNavigate();
  const topic = weeklyContent[lesson.topicIndex];
  return (
    <div className="pl-booking pl-booking--lesson">
      <div className="pl-booking-top">
        <span className="pl-coming-avatar pl-coming-avatar--lesson" aria-hidden="true"><BookOpen size={18} /></span>
        <span className="pl-row-main">
          <p className="pl-row-title">{pt('home.lessonNum', { n: lesson.number })}{topic ? ` · ${plainTopic(topic.topic)}` : ''}</p>
          {lesson.teaching && <p className="pl-row-sub">{pt('tw.with', { name: lesson.studentName })}</p>}
          <p className="pl-row-sub">
            {whenLabel(lesson.startMs, now, lang)} · {PLATFORM_LABEL[lesson.platform] || 'Preply'} · {countdownLabel(lesson.startMs, now, lang)}
          </p>
        </span>
      </div>
      <div className="pl-actions">
        <Button size="sm" icon={<BookOpen size={16} aria-hidden="true" />} onClick={() => navigate(`/class/${lesson.id}`)}>
          {lesson.teaching ? pt('lr.open') : pt('lr.prepare')}
        </Button>
        {lesson.link && (
          <Button size="sm" variant="secondary" icon={<ExternalLink size={16} aria-hidden="true" />}
            onClick={() => window.open(lesson.link, '_blank', 'noopener,noreferrer')}>
            {pt('lr.join')}
          </Button>
        )}
      </div>
    </div>
  );
}
