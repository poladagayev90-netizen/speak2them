import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, ChevronRight } from 'lucide-react';
import { nextLesson, overallProgress } from '../utils/lessonMap';
import { subscribeToLessonProgress } from '../utils/lessonProgress';
import Card from './ui/Card';
import './ui/ui.css';

// The lessons, from the home screen. It names the next lesson rather than the
// section, because "Lessons" is a place and "The first thirty seconds" is a
// thing you can do in three minutes.
//
// It goes quiet once everything is read — a card that keeps asking for
// something already done is noise, and the map is still on the row.
export default function LessonsCard({ user }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);

  useEffect(() => subscribeToLessonProgress(user?.uid, setProgress), [user?.uid]);

  const next = nextLesson(progress);
  const { done, total } = overallProgress(progress);

  return (
    <Card
      padding="md"
      onClick={() => navigate(next ? `/lessons/${next.id}` : '/lessons')}
      style={{ marginBottom: 'var(--s-3)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 'var(--r-md)', flexShrink: 0,
          background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
          display: 'grid', placeItems: 'center',
        }}>
          <GraduationCap size={22} strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <p style={{
            margin: 0, fontSize: 'var(--fs-h2)', fontWeight: 700,
            color: 'var(--text-primary)', lineHeight: 'var(--lh-tight)',
          }}>
            {next ? next.title : 'Lessons'}
          </p>
          <p style={{
            margin: '4px 0 0', fontSize: 'var(--fs-sm)', fontWeight: 600,
            color: 'var(--text-secondary)', lineHeight: 'var(--lh-body)',
          }}>
            {next
              ? (done
                ? `Lessons · ${done} of ${total} read`
                : 'Lessons · the sentences that keep a call going')
              : 'Read any of them again before a call'}
          </p>
        </div>
        <ChevronRight size={20} strokeWidth={1.75} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </div>
    </Card>
  );
}
