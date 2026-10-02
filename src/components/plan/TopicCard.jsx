import React, { useEffect, useState } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import { plainTopic } from '../../utils/topicLabel';
import './plan.css';

// Today's topic as a picture, not a line of text. Polad (2026-09-30): the app
// "reads like a wall of text" and the daily topic should look different from
// everything else. The photo is the day's first describe-a-picture frame
// (topicImages — frozen Pexels URLs, the same the call uses), loaded lazily so
// the 60-day image table stays out of the main bundle.
const cardUrl = (url) => String(url || '').replace('h=650&w=940', 'h=420&w=760');

// `kicker` replaces "Today's practice topic" where the card shows a lesson's
// topic (Today's lesson card, /class/:id); `cta` replaces the bottom line;
// `lesson` marks Today's lesson card so it never reads as the daily topic.
export default function TopicCard({ topic, onOpen, kicker = null, cta = null, lesson = false }) {
  const [photo, setPhoto] = useState(null);
  const [failed, setFailed] = useState(false);
  const day = topic?.day;

  useEffect(() => {
    if (!day) return undefined;
    let alive = true;
    setFailed(false);
    import('../../data/topicImages')
      .then(({ topicImages }) => { if (alive) setPhoto(topicImages[day]?.[0] || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [day]);

  const question = topic?.questions?.easy?.[new Date().getDate() % (topic?.questions?.easy?.length || 1)];
  const showPhoto = photo && !failed;

  return (
    <button
      type="button"
      id={kicker ? undefined : 'tour-topic'}
      className={`pl-topic ${showPhoto ? '' : 'pl-topic--plain'}${lesson ? ' pl-topic--lesson' : ''}`}
      onClick={onOpen}
      aria-label={`${kicker || "Today's practice topic"}: ${plainTopic(topic?.topic) || 'open'}`}
    >
      {showPhoto && (
        <img
          className="pl-topic-img"
          src={cardUrl(photo.url)}
          alt=""
          loading="lazy"
          onError={(e) => {
            // One step down to the smaller copy, then the plain card.
            if (photo.fallbackUrl && e.currentTarget.src !== photo.fallbackUrl) e.currentTarget.src = photo.fallbackUrl;
            else setFailed(true);
          }}
        />
      )}
      <span className="pl-topic-body">
        <span className="pl-topic-kicker">
          {!showPhoto && <BookOpen size={14} aria-hidden="true" />}
          {kicker || <>Today’s practice topic{day ? ` · Day ${day}` : ''}</>}
        </span>
        <span className="pl-topic-title">{plainTopic(topic?.topic) || 'Today’s topic'}</span>
        {question && <span className="pl-topic-q">{question}</span>}
        <span className="pl-topic-cta">{cta || 'Words, idioms and questions'} <ChevronRight size={16} aria-hidden="true" /></span>
      </span>
    </button>
  );
}
