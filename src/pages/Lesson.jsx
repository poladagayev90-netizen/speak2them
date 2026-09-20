import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Check, X, Mic, Languages, CheckCircle2 } from 'lucide-react';
import { findLesson, findModule } from '../data/lessons';
import { lessonAfter, isLessonDone } from '../utils/lessonMap';
import { subscribeToLessonProgress, markLessonDone } from '../utils/lessonProgress';
import { getFeedbackLanguage } from '../utils/feedbackLanguage';
import Button from '../components/ui/Button';
import './Lessons.css';
import '../components/ui/ui.css';

// One lesson, read top to bottom. No carousel: a learner who wants to look
// again at the four opening sentences should be able to scroll back to them,
// and a card-by-card wizard makes that a hunt.
//
// The phrases are the lesson. Everything else on the page is there to say when
// to use them.

// English is what is shown; the meaning is one deliberate tap away, in the
// learner's own language (users.preferredLanguage — NOT the phone's language,
// which says nothing about which language somebody thinks in). A phrase with no
// translation for their language is still shown, just not tappable.
function Phrase({ text, meaning }) {
  const [shown, setShown] = useState(false);
  const has = Boolean(meaning);
  return (
    <button
      type="button"
      className={`lesson-phrase ${shown ? 'lesson-phrase--shown' : ''}`}
      onClick={has ? () => setShown((v) => !v) : undefined}
      aria-label={has ? `${text} — tap for the meaning` : text}
      style={has ? undefined : { cursor: 'default' }}
    >
      {has && (
        <span className="lesson-phrase-icon" aria-hidden="true">
          <Languages size={16} strokeWidth={2} />
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>{shown ? meaning : text}</span>
    </button>
  );
}

function LessonCard({ card, lang }) {
  return (
    <div className="lesson-card">
      <h3 className="lesson-card-title">{card.title}</h3>

      {card.trap && (
        <div className="lesson-trap">
          <p className="lesson-trap-line lesson-trap-line--wrong">
            <X size={18} strokeWidth={2.5} className="lesson-trap-icon--wrong" aria-hidden="true" />
            <span>{card.trap.wrong}</span>
          </p>
          <p className="lesson-trap-line lesson-trap-line--right">
            <Check size={18} strokeWidth={2.5} className="lesson-trap-icon--right" aria-hidden="true" />
            <span>{card.trap.right}</span>
          </p>
        </div>
      )}

      {card.body && <p className="lesson-card-body">{card.body}</p>}

      {card.phrases && (
        <div className="lesson-phrases" style={card.body ? { marginTop: 'var(--s-3)' } : undefined}>
          {card.phrases.map((p, i) => (
            <Phrase key={`${p.en}-${i}`} text={p.en} meaning={p[lang]} />
          ))}
        </div>
      )}

      {card.example && (
        <div className="lesson-example" style={{ marginTop: card.body || card.phrases ? 'var(--s-3)' : 0 }}>
          <p className="lesson-example-label">{card.example.label}</p>
          {card.example.lines.map((line, i) => (
            <p className="lesson-example-line" key={i}>{line}</p>
          ))}
        </div>
      )}

      {card.say && (
        <div className="lesson-say">
          <Mic size={18} strokeWidth={2} className="lesson-say-icon" aria-hidden="true" />
          <p className="lesson-say-text">{card.say}</p>
        </div>
      )}
    </div>
  );
}

export default function Lesson({ user }) {
  const navigate = useNavigate();
  const { lessonId } = useParams();
  const [progress, setProgress] = useState(null);
  const [saving, setSaving] = useState(false);
  const lang = useMemo(() => getFeedbackLanguage(), []);

  const lesson = findLesson(lessonId);
  const mod = lesson ? findModule(lesson.moduleId) : null;
  const next = lesson ? lessonAfter(lesson.id) : null;
  const position = mod ? mod.lessons.findIndex((l) => l.id === lessonId) + 1 : 0;

  useEffect(() => subscribeToLessonProgress(user?.uid, setProgress), [user?.uid]);

  // A lesson that no longer exists (an old link, a renamed id) goes back to the
  // map rather than showing an empty page.
  useEffect(() => {
    if (!lesson) navigate('/lessons', { replace: true });
  }, [lesson, navigate]);

  // Every lesson opens at the top: React Router keeps the scroll position, so
  // arriving at lesson three from the bottom of lesson two would land halfway
  // down it.
  useEffect(() => { window.scrollTo(0, 0); }, [lessonId]);

  if (!lesson) return null;

  const read = isLessonDone(progress, lesson.id);

  const finish = async (to) => {
    if (!read) {
      setSaving(true);
      await markLessonDone(user?.uid, lesson.id);
      setSaving(false);
    }
    navigate(to);
  };

  return (
    <div className="lesson-page">
      <div className="lesson-top">
        <button
          type="button"
          className="lesson-back"
          onClick={() => navigate('/lessons')}
          aria-label="Back to the lessons"
        >
          <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="lesson-eyebrow">
            {mod ? `${mod.title} · ${position} of ${mod.lessons.length}` : 'Lesson'}
          </p>
        </div>
        {read && (
          <CheckCircle2
            size={22}
            strokeWidth={2}
            style={{ color: 'var(--accent)', flexShrink: 0 }}
            aria-label="You have read this one"
          />
        )}
      </div>

      <h1 className="lesson-title">{lesson.title}</h1>
      <p className="lesson-why">{lesson.why}</p>

      {lesson.cards.map((card, i) => <LessonCard key={i} card={card} lang={lang} />)}

      <div className="lesson-foot">
        {next ? (
          <Button variant="primary" size="lg" full disabled={saving} onClick={() => finish(`/lessons/${next.id}`)}>
            {read ? `Next: ${next.title}` : `Done — next: ${next.title}`}
          </Button>
        ) : (
          <Button variant="primary" size="lg" full disabled={saving} onClick={() => finish('/lessons')}>
            {read ? 'Back to the lessons' : 'Done — that was the last one'}
          </Button>
        )}

        {/* The lesson is only worth the call that follows it, so the activity is
            one tap from the bottom of the page. */}
        {mod && (
          <Button
            variant={mod.practice.to === '/practice' ? 'ai' : 'secondary'}
            size="md"
            full
            onClick={() => finish(mod.practice.to)}
          >
            {mod.practice.label}
          </Button>
        )}

        {!read && <p className="lesson-foot-note">Either button marks this lesson as read.</p>}
      </div>
    </div>
  );
}
