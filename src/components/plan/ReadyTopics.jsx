import React, { useMemo } from 'react';
import { weeklyContent } from '../../data/weeklyContent';
import { plainTopic } from '../../utils/topicLabel';
import { hasMaterials } from '../../utils/topicMaterialsLoader';
import './plan.css';

// Admin only (Polad 2026-10-12): every topic whose Listen/Read materials are
// already published, so a finished podcast episode can be checked long before
// the cycle reaches its day. Same chips as «Next topics»; a tap opens the sheet.
export default function ReadyTopics({ onOpen }) {
  const list = useMemo(
    () => weeklyContent
      .map((t, index) => ({ index, day: t.day, topic: t.topic }))
      .filter((t) => hasMaterials(t.day)),
    [],
  );
  if (!list.length) return null;
  return (
    <section className="pl-next-topics" aria-label="Topics with materials">
      <p className="pl-next-topics-k">Materials ready · {list.length}</p>
      <div className="pl-next-topics-row">
        {list.map((t) => (
          <button key={t.day} type="button" className="pl-next-topic" onClick={() => onOpen(t.index)}>
            <span className="pl-next-topic-when">Episode {t.day}</span>
            <span className="pl-next-topic-t">{plainTopic(t.topic)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
