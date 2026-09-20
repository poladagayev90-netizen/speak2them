import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, ChevronRight, Play } from 'lucide-react';
import { lessonModules } from '../data/lessons';
import {
  completedSet, nextLesson, moduleProgress, overallProgress, minutesLeft,
} from '../utils/lessonMap';
import { subscribeToLessonProgress } from '../utils/lessonProgress';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import './Lessons.css';
import '../components/ui/ui.css';

// The map. Four modules, seventeen short lessons, and one recommendation.
//
// It exists because of a number: the median call in production ran forty
// seconds, and two thirds of calls never opened an activity at all. The app had
// been telling learners WHAT to do without ever teaching them HOW, so the fix
// is not another button on the call screen — it is the sentences themselves,
// before the call.
//
// NOTHING IS LOCKED. Every lesson is open from the first visit; the only
// sequencing is a suggestion at the top and a highlighted row. A checklist that
// bars practice was tried once in the describe activity and rolled back the
// same day.
export default function Lessons({ user }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);

  useEffect(() => subscribeToLessonProgress(user?.uid, setProgress), [user?.uid]);

  const done = completedSet(progress);
  const next = nextLesson(progress);
  const { done: doneCount, total, percent } = overallProgress(progress);
  const left = minutesLeft(progress);

  return (
    <div className="lesson-page">
      <h1 className="lesson-head-title">Lessons</h1>
      <p className="lesson-head-sub">
        Short lessons that give you the sentences — so a call is never quiet.
      </p>

      <div className="lesson-bar" role="presentation">
        <div className="lesson-bar-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="lesson-bar-note">
        {doneCount} of {total} read
        {left > 0 ? ` · about ${left} minutes left` : ' · all of them'}
      </p>

      {next ? (
        <Card
          tone="peer"
          padding="md"
          onClick={() => navigate(`/lessons/${next.id}`)}
          style={{ marginTop: 'var(--s-4)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 'var(--r-md)', flexShrink: 0,
              background: 'var(--peer-soft)', color: 'var(--peer)', display: 'grid', placeItems: 'center',
            }}>
              <Play size={20} strokeWidth={2} aria-hidden="true" />
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <p className="lesson-eyebrow">{doneCount ? 'Carry on' : 'Start here'}</p>
              <p className="lesson-row-title" style={{ marginTop: 2 }}>{next.title}</p>
              <p className="lesson-row-meta">{next.moduleTitle} · {next.minutes} min</p>
            </div>
            <ChevronRight size={20} strokeWidth={1.75} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </div>
        </Card>
      ) : (
        <Card padding="md" style={{ marginTop: 'var(--s-4)' }}>
          <p className="lesson-row-title">You have read all of them.</p>
          <p className="lesson-row-meta" style={{ marginTop: 4 }}>
            Come back to any lesson before a call — that is what they are for.
          </p>
        </Card>
      )}

      {lessonModules.map((mod) => {
        const mp = moduleProgress(mod.id, progress);
        return (
          <section className="lesson-module" key={mod.id}>
            <div className="lesson-module-head">
              <h2 className="lesson-module-title">{mod.title}</h2>
              <span className="lesson-module-count">{mp.done}/{mp.total}</span>
            </div>
            <p className="lesson-module-blurb">{mod.blurb}</p>

            {mod.lessons.map((lesson) => {
              const isDone = done.has(lesson.id);
              const isNext = next && next.id === lesson.id;
              return (
                <button
                  key={lesson.id}
                  type="button"
                  className={`lesson-row ${isNext ? 'lesson-row--next' : ''}`}
                  onClick={() => navigate(`/lessons/${lesson.id}`)}
                >
                  <span className={`lesson-row-mark ${isDone ? 'lesson-row-mark--done' : ''}`}>
                    {isDone
                      ? <CheckCircle2 size={22} strokeWidth={2} aria-hidden="true" />
                      : <Circle size={22} strokeWidth={1.75} aria-hidden="true" />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="lesson-row-title" style={{ display: 'block' }}>{lesson.title}</span>
                    <span className="lesson-row-meta" style={{ display: 'block' }}>
                      {isDone ? 'Read' : `${lesson.minutes} min`}
                    </span>
                  </span>
                  <ChevronRight size={18} strokeWidth={1.75} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </button>
              );
            })}

            {/* Reading is not the point. Every module ends by handing the
                learner into the real activity it was written for. */}
            <Button
              variant={mod.practice.to === '/practice' ? 'ai' : 'primary'}
              size="md"
              full
              onClick={() => navigate(mod.practice.to)}
              style={{ marginTop: 'var(--s-2)' }}
            >
              {mod.practice.label}
            </Button>
          </section>
        );
      })}
    </div>
  );
}
