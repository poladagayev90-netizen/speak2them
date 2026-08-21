import React, { useEffect, useState } from 'react';
import { ChevronRight, CalendarDays } from 'lucide-react';
import { subscribeToCycle } from '../utils/cycle';
import { getTodayContent } from '../data/weeklyContent';
import { getTopicsCompleted } from '../utils/courseProgress';
import { plainTopic } from '../utils/topicLabel';
import Card from './ui/Card';
import './ui/ui.css';

// The one entry to today's topic: a single row, one tap.
//
// This card was once three layers — topic title, a "words · idioms · questions"
// chip, a 21:00 countdown and an explanation of main days — and took up half
// the home screen, pushing the real action below the fold. SessionCountdown was
// removed entirely: 21:00 is not a separate announcement, it is the starred
// 20–22 block on the practice board. Explaining the same thing in two places,
// once as "the session" and once as "a block", only confused people.
//
// It was also a saturated violet gradient with a glow. On a screen where the
// primary action is now a card of its own, a second loud block competed with it
// and won on nothing but volume. Reference material should look like reference
// material.
export default function DailyTopicBanner({ user, onOpenTopic }) {
  const [cycle, setCycle] = useState(null);
  useEffect(() => subscribeToCycle(setCycle), []);

  const topic = getTodayContent();
  const completed = getTopicsCompleted(user, cycle);
  const topicLabel = completed !== null && completed > 0
    ? `Topic ${completed} · ${plainTopic(topic.topic)}`
    : plainTopic(topic.topic);

  return (
    <Card
      id="tour-daily-topic"
      padding="md"
      onClick={onOpenTopic}
      style={{ marginBottom: 'var(--s-3)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
        <CalendarDays
          size={20}
          strokeWidth={1.75}
          aria-hidden="true"
          style={{ color: 'var(--text-muted)', flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="ui-section-label" style={{ margin: 0 }}>Today’s topic</p>
          <p style={{
            margin: '2px 0 0',
            color: 'var(--text-primary)',
            fontWeight: 600,
            fontSize: 'var(--fs-body)',
            lineHeight: 'var(--lh-tight)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {topicLabel}
          </p>
        </div>
        {onOpenTopic && (
          <ChevronRight
            size={18}
            strokeWidth={1.75}
            style={{ color: 'var(--text-muted)', flexShrink: 0 }}
          />
        )}
      </div>
    </Card>
  );
}
