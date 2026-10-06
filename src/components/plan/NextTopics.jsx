import React, { useEffect, useMemo, useState } from 'react';
import { weeklyContent } from '../../data/weeklyContent';
import { plainTopic } from '../../utils/topicLabel';
import { upcomingTopics } from '../../utils/topicQueue';
import { subscribeToSessionConfig } from '../../utils/sessionSchedule';
import './plan.css';

// The next few topics under today's card, with the day each one arrives, so a
// learner can prepare ahead (Polad 2026-10-06). A tap opens that topic's sheet.
export default function NextTopics({ todayIndex, onOpen, count = 4 }) {
  const [config, setConfig] = useState(null);
  useEffect(() => subscribeToSessionConfig(setConfig), []);
  const list = useMemo(
    () => (todayIndex < 0 ? [] : upcomingTopics({ currentIndex: todayIndex, total: weeklyContent.length, count, config })),
    [todayIndex, count, config],
  );
  if (!list.length) return null;
  return (
    <section className="pl-next-topics" aria-label="Next topics">
      <p className="pl-next-topics-k">Next topics</p>
      <div className="pl-next-topics-row">
        {list.map((t) => (
          <button key={t.dateStr} type="button" className="pl-next-topic" onClick={() => onOpen(t.index)}>
            <span className="pl-next-topic-when">{t.label}</span>
            <span className="pl-next-topic-t">{plainTopic(weeklyContent[t.index]?.topic)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
