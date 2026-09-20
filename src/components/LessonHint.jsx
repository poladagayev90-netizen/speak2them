import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight } from 'lucide-react';
import { nextInModule } from '../utils/lessonMap';
import { subscribeToLessonProgress } from '../utils/lessonProgress';

// A quiet line that offers the lesson written for the screen you are on: the
// describing lessons next to the describing activity, the conversation lessons
// next to the button that calls a stranger.
//
// It stays a LINE, not a card. The thing to do on those screens is to speak;
// this only has to be findable by somebody who has just realised they do not
// know what to say.
export default function LessonHint({ user, moduleId, text }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);

  useEffect(() => subscribeToLessonProgress(user?.uid, setProgress), [user?.uid]);

  const lesson = nextInModule(moduleId, progress);
  if (!lesson) return null;

  return (
    <button
      type="button"
      onClick={() => navigate(`/lessons/${lesson.id}`)}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
        width: '100%', padding: 'var(--s-2) 0', marginTop: 'var(--s-2)',
        background: 'none', border: 'none', font: 'inherit',
        color: 'var(--text-secondary)', textAlign: 'left', cursor: 'pointer',
      }}
    >
      <BookOpen size={16} strokeWidth={1.75} aria-hidden="true" style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-sm)', fontWeight: 600, lineHeight: 'var(--lh-body)' }}>
        {text} <b style={{ color: 'var(--text-primary)' }}>{lesson.title}</b>
      </span>
      <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
    </button>
  );
}
