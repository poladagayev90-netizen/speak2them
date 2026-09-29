import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, GraduationCap, ChevronRight } from 'lucide-react';
import { nextLesson } from '../../utils/lessonMap';
import { subscribeToLessonProgress } from '../../utils/lessonProgress';
import './plan.css';

// Get ready: a warm-up with AInur and the next lesson on HOW to keep a call
// going. The day's topic has its own picture card (TopicCard) above this one.
export default function GetReadyCard({ user }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);
  useEffect(() => subscribeToLessonProgress(user?.uid, setProgress), [user?.uid]);
  const lesson = nextLesson(progress);

  return (
    <section id="tour-get-ready" className="pl-card" aria-label="Get ready">
      <p className="ui-section-label" style={{ margin: 0 }}>Get ready</p>
      <div className="pl-rows">
        <button type="button" className="pl-row" onClick={() => navigate('/practice')}>
          <span className="pl-row-icon pl-row-icon--ai" aria-hidden="true"><Bot size={18} /></span>
          <span className="pl-row-main">
            <p className="pl-row-title">Warm up with AInur</p>
            <p className="pl-row-sub">A short speaking session, ready any time</p>
          </span>
          <ChevronRight size={18} className="pl-row-end" aria-hidden="true" />
        </button>
        <button type="button" className="pl-row" onClick={() => navigate(lesson ? `/lessons/${lesson.id}` : '/lessons')}>
          <span className="pl-row-icon" aria-hidden="true"><GraduationCap size={18} /></span>
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
