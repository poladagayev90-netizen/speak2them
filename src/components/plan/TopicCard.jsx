import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronRight, ChevronsRight } from 'lucide-react';
import { weeklyContent } from '../../data/weeklyContent';
import { plainTopic } from '../../utils/topicLabel';
import { hasMaterials } from '../../utils/topicMaterialsLoader';
import { practiceText } from '../../data/practiceCopy';
import { upcomingTopics } from '../../utils/topicQueue';
import { DEFAULT_SESSION_CONFIG, subscribeToSessionConfig } from '../../utils/sessionSchedule';
import './plan.css';

const SWIPE_HINT_KEY = 'sl.topicSwipeHint_v1';
const SWIPE_HINT_MAX_SHOWS = 3;
let hintSessionBumped = false;

function initSwipeHint() {
  try {
    const raw = localStorage.getItem(SWIPE_HINT_KEY);
    if (raw === 'done') return false;
    const count = Number(raw) || 0;
    if (count >= SWIPE_HINT_MAX_SHOWS) return false;
    if (!hintSessionBumped) {
      localStorage.setItem(SWIPE_HINT_KEY, String(count + 1));
      hintSessionBumped = true;
    }
    return true;
  } catch {
    return false;
  }
}

function dismissSwipeHint() {
  try { localStorage.setItem(SWIPE_HINT_KEY, 'done'); } catch { /* private mode */ }
}

// Today's topic as a picture, not a line of text. Polad (2026-09-30): the app
// "reads like a wall of text" and the daily topic should look different from
// everything else. The photo is the day's first describe-a-picture frame
// (topicImages — frozen Pexels URLs, the same the call uses), loaded lazily so
// the 60-day image table stays out of the main bundle.
const cardUrl = (url) => String(url || '').replace('h=650&w=940', 'h=420&w=760');

// `kicker` replaces "Today's practice topic" where the card shows a lesson's
// topic (Today's lesson card, /class/:id); `cta` replaces the bottom line;
// `lesson` marks Today's lesson card so it never reads as the daily topic.
// `lang` translates the card's own chrome only (data/practiceCopy.js); the
// topic title and question are the lesson and stay English.
export default function TopicCard({ topic, onOpen, kicker = null, cta = null, lesson = false, lang = 'en' }) {
  const t = (key, vars) => practiceText(lang, key, vars);
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
      aria-label={`${kicker || t('topic.kicker')}: ${plainTopic(topic?.topic) || 'open'}`}
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
        {/* lang: the kicker is CSS-uppercased, and under the page's lang="en"
            Turkish «pratik» became «PRATIK» (dotless). The learner's own
            language gives «PRATİK». */}
        <span className="pl-topic-kicker" lang={kicker ? undefined : lang}>
          {!showPhoto && <BookOpen size={14} aria-hidden="true" />}
          {kicker || <>{t('topic.kicker')}{day ? ` · ${t('topic.day', { day })}` : ''}</>}
        </span>
        <span className="pl-topic-title">{plainTopic(topic?.topic) || t('topic.fallback')}</span>
        {question && <span className="pl-topic-q">{question}</span>}
        <span className="pl-topic-cta">{cta || (hasMaterials(day) ? t('topic.ctaFull') : t('topic.ctaShort'))} <ChevronRight size={16} aria-hidden="true" /></span>
      </span>
    </button>
  );
}

// Swipeable deck for Today: today's topic first, then the next four topics on
// horizontal scroll-snap cards (Polad 2026-11-24: removes the separate Next
// Topics row so Leaderboard + Academy stay above the phone fold).
export function TopicCardDeck({ todayTopic, todayIndex = -1, lang = 'en', isGuest = false, onOpen }) {
  const [config, setConfig] = useState(DEFAULT_SESSION_CONFIG);
  const [active, setActive] = useState(0);
  const [showHint, setShowHint] = useState(() => initSwipeHint());
  const deckRef = useRef(null);

  useEffect(() => {
    if (isGuest) {
      setConfig(DEFAULT_SESSION_CONFIG);
      return undefined;
    }
    return subscribeToSessionConfig(setConfig);
  }, [isGuest]);

  const slides = useMemo(() => {
    if (!todayTopic) return [];
    const base = [{
      key: 'today',
      topic: todayTopic,
      topicIndex: null,
      kicker: null,
      aria: plainTopic(todayTopic.topic) || practiceText(lang, 'today'),
    }];
    if (todayIndex < 0) return base;
    const next = upcomingTopics({
      currentIndex: todayIndex,
      total: weeklyContent.length,
      count: 4,
      config,
    });
    for (const item of next) {
      const t = weeklyContent[item.index];
      if (!t) continue;
      base.push({
        key: item.dateStr,
        topic: t,
        topicIndex: item.index,
        kicker: `${item.label} · ${practiceText(lang, 'topic.day', { day: t.day })}`,
        aria: `${item.label}: ${plainTopic(t.topic)}`,
      });
    }
    return base;
  }, [todayTopic, todayIndex, config, lang]);

  const handleScroll = () => {
    const el = deckRef.current;
    if (!el || !el.clientWidth) return;
    const idx = Math.max(0, Math.min(slides.length - 1, Math.round(el.scrollLeft / el.clientWidth)));
    if (idx !== active) {
      setActive(idx);
      if (idx > 0 && showHint) {
        setShowHint(false);
        dismissSwipeHint();
      }
    }
  };

  const jumpTo = (idx) => {
    const el = deckRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
    setActive(idx);
    if (idx > 0 && showHint) {
      setShowHint(false);
      dismissSwipeHint();
    }
  };

  if (!slides.length) {
    return <TopicCard topic={todayTopic} lang={lang} onOpen={() => onOpen(null)} />;
  }

  return (
    <div className="pl-topic-deck-wrap">
      <div
        ref={deckRef}
        className="pl-topic-deck"
        onScroll={handleScroll}
        aria-label="Practice topics"
      >
        {slides.map((s) => (
          <div key={s.key} className="pl-topic-slide">
            <TopicCard
              topic={s.topic}
              kicker={s.kicker}
              lang={lang}
              onOpen={() => onOpen(s.topicIndex)}
            />
          </div>
        ))}
      </div>
      {showHint && slides.length > 1 && active === 0 && (
        <span className="pl-topic-swipe-hint" aria-hidden="true">
          <ChevronsRight size={16} strokeWidth={2.4} />
        </span>
      )}
      {slides.length > 1 && (
        <div className="pl-topic-dots" role="tablist" aria-label="Topic slides">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={s.aria}
              className={`pl-topic-dot${i === active ? ' is-on' : ''}`}
              onClick={() => jumpTo(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
