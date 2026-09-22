import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, CalendarDays, ChevronRight } from 'lucide-react';
import { nextLesson } from '../utils/lessonMap';
import { subscribeToLessonProgress } from '../utils/lessonProgress';
import { subscribeToCycle } from '../utils/cycle';
import { getTodayContent } from '../data/weeklyContent';
import { getTopicsCompleted } from '../utils/courseProgress';
import { plainTopic } from '../utils/topicLabel';
import './TodayMore.css';

// Everything on Today that is not the one next step, as rows in a single card.
//
// Home used to stack six full-size cards of the same weight — intro, AInur,
// "pick a time", talk to someone, a lesson, today's topic — so nothing said
// "do this first". Home now picks ONE hero card by where the learner is, and
// the rest live here: still one tap away, but quiet. This replaces LessonsCard
// and DailyTopicBanner, which were only ever used on Home.
//
// Colour still says who is on the other end: the AInur row takes her face, the
// partner row the deep --peer tint, lessons and the topic stay neutral.
function Row({ id, icon, iconTone = 'neutral', title, meta, onClick }) {
  return (
    <button id={id} type="button" className="today-row" onClick={onClick}>
      <span className={`today-row-icon today-row-icon--${iconTone}`} aria-hidden="true">{icon}</span>
      <span className="today-row-body">
        <span className="today-row-title">{title}</span>
        {meta && <span className="today-row-meta">{meta}</span>}
      </span>
      <ChevronRight size={18} strokeWidth={1.75} className="today-row-chev" aria-hidden="true" />
    </button>
  );
}

export default function TodayMore({ user, showAinur, live, onOpenTopic }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);
  const [cycle, setCycle] = useState(null);
  useEffect(() => subscribeToLessonProgress(user?.uid, setProgress), [user?.uid]);
  useEffect(() => subscribeToCycle(setCycle), []);

  const next = nextLesson(progress);
  const topic = getTodayContent();
  const completed = getTopicsCompleted(user, cycle);
  const topicLabel = completed !== null && completed > 0
    ? `Topic ${completed} · ${plainTopic(topic.topic)}`
    : plainTopic(topic.topic);

  return (
    <section className="today-more" aria-label="More for today">
      <p className="ui-section-label">More for today</p>
      <div className="today-more-card">
        {showAinur && (
          <Row
            id="tour-today-task"
            iconTone="ai"
            icon={<img src="/ainur_avatar.png" alt="" />}
            title="Describe pictures with AInur"
            meta={`${plainTopic(topic.topic) || 'Today’s topic'} · about 8 minutes`}
            onClick={() => navigate('/practice')}
          />
        )}
        {live && (
          <Row
            id="tour-live"
            iconTone="peer"
            icon={<Users size={18} strokeWidth={1.75} />}
            title="Talk to someone"
            meta={live.text}
            onClick={live.onClick}
          />
        )}
        <Row
          icon={<GraduationCap size={18} strokeWidth={1.75} />}
          title={next ? next.title : 'Lessons'}
          meta={next ? `Lesson · ${next.minutes} min` : 'Read any of them again before a call'}
          onClick={() => navigate(next ? `/lessons/${next.id}` : '/lessons')}
        />
        <Row
          id="tour-daily-topic"
          icon={<CalendarDays size={18} strokeWidth={1.75} />}
          title={topicLabel}
          meta="Today’s topic · words and questions"
          onClick={onOpenTopic}
        />
      </div>
    </section>
  );
}
