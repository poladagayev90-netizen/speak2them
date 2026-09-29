import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Bot, GraduationCap, ChevronRight } from 'lucide-react';
import { nextLesson } from '../../utils/lessonMap';
import { subscribeToLessonProgress } from '../../utils/lessonProgress';
import { plainTopic } from '../../utils/topicLabel';
import './plan.css';

// Get ready: three short ways in before a practice — the topic you will talk
// about, a warm-up with AInur, and the next lesson on HOW to keep a call
// going. They used to be three separate cards on Today (the topic banner,
// AInur's task card, the lessons card) competing with the practice itself;
// here they are one card, below it.
export default function GetReadyCard({ user, topic, onOpenTopic }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);
  useEffect(() => subscribeToLessonProgress(user?.uid, setProgress), [user?.uid]);
  const lesson = nextLesson(progress);
  const question = topic?.questions?.easy?.[new Date().getDate() % (topic.questions.easy.length || 1)];

  return (
    <section id="tour-get-ready" className="pl-card" aria-label="Get ready">
      <p className="ui-section-label" style={{ margin: 0 }}>Get ready</p>
      <div className="pl-rows">
        <button type="button" className="pl-row" onClick={onOpenTopic}>
          <span className="pl-row-icon pl-row-icon--plain" aria-hidden="true"><BookOpen size={18} /></span>
          <span className="pl-row-main">
            <p className="pl-row-title">{plainTopic(topic?.topic) || 'Today’s topic'}</p>
            <p className="pl-row-sub">{question || 'Words, idioms and questions for today'}</p>
          </span>
          <ChevronRight size={18} className="pl-row-end" aria-hidden="true" />
        </button>
        <button type="button" className="pl-row" onClick={() => navigate('/practice')}>
          <span className="pl-row-icon pl-row-icon--ai" aria-hidden="true"><Bot size={18} /></span>
          <span className="pl-row-main">
            <p className="pl-row-title">Warm up with AInur</p>
            <p className="pl-row-sub">A short speaking session, ready any time</p>
          </span>
          <ChevronRight size={18} className="pl-row-end" aria-hidden="true" />
        </button>
        <button type="button" className="pl-row" onClick={() => navigate(lesson ? `/lessons/${lesson.id}` : '/lessons')}>
          <span className="pl-row-icon pl-row-icon--plain" aria-hidden="true"><GraduationCap size={18} /></span>
          <span className="pl-row-main">
            <p className="pl-row-title">{lesson ? lesson.title : 'Lessons'}</p>
            <p className="pl-row-sub">{lesson ? 'Next lesson · a few minutes' : 'How to keep a conversation going'}</p>
          </span>
          <ChevronRight size={18} className="pl-row-end" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
