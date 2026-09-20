import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, ChevronLeft, ChevronRight, Maximize2, Minimize2, Eye,
} from 'lucide-react';
import { getTodayContent } from '../data/weeklyContent';
import { fetchTopicImages } from '../utils/fetchTopicImages';
import { plainTopic } from '../utils/topicLabel';
import { getFeedbackLanguage } from '../utils/feedbackLanguage';
import './Teach.css';

// Lesson mode: today's topic as a deck, for a teacher sharing their screen.
//
// WHY IT EXISTS. The app is a phone app, and it is now taught from: the lesson
// happens on a call, the teacher shares the screen and walks the group through
// today's words, questions and pictures. Stretched across a laptop that reads
// as a column of phone-sized cards in the middle of a very wide screen — fine
// to tap, useless to teach from, and smaller still once a video call has
// compressed it.
//
// So this is not a new screen full of new content. It is the SAME day's
// content — one thing at a time, as large as the screen allows, with nothing
// else on it.
//
// HOW IT IS DRIVEN: → or click for the next slide, ← for the previous one,
// Space or ↓ to reveal the answer half (a meaning, an example, the questions
// under a picture), F for fullscreen, Esc to leave. A teacher's hands are on
// the keyboard, so the keyboard is the primary control and the on-screen
// buttons are the fallback.

const REVEAL_KEYS = [' ', 'ArrowDown', 'Enter'];

export default function Teach() {
  const navigate = useNavigate();
  const content = useMemo(() => getTodayContent(), []);
  const lang = useMemo(() => getFeedbackLanguage(), []);
  const [images, setImages] = useState([]);
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [full, setFull] = useState(false);
  const stageRef = useRef(null);

  useEffect(() => {
    let alive = true;
    fetchTopicImages(content.day, content.imageKeywords, content.manualImageUrls)
      .then((list) => { if (alive) setImages(Array.isArray(list) ? list : []); })
      .catch(() => setImages([]));
    return () => { alive = false; };
  }, [content]);

  // The deck. Words first (they are the raw material), then idioms, then the
  // questions the words are for, then the pictures — the order a lesson runs
  // in, so the teacher never has to hunt.
  const slides = useMemo(() => {
    const out = [{ kind: 'cover' }];
    (content.vocabulary || []).forEach((v) => out.push({ kind: 'word', item: v, section: 'Words' }));
    (content.idioms || []).forEach((v) => out.push({ kind: 'idiom', item: v, section: 'Idioms' }));
    ((content.questions && content.questions.easy) || []).forEach((q) => out.push({ kind: 'question', text: q, level: 'Easy', section: 'Questions' }));
    ((content.questions && content.questions.hard) || []).forEach((q) => out.push({ kind: 'question', text: q, level: 'Harder', section: 'Questions' }));
    images.forEach((img) => out.push({ kind: 'picture', img, section: 'Pictures' }));
    out.push({ kind: 'end' });
    return out;
  }, [content, images]);

  // Where each section starts, for the jump bar. A lesson rarely runs the deck
  // end to end — "now the pictures" is the most common move there is.
  const sections = useMemo(() => {
    const seen = new Map();
    slides.forEach((s, idx) => { if (s.section && !seen.has(s.section)) seen.set(s.section, idx); });
    return [...seen.entries()].map(([name, index]) => ({ name, index }));
  }, [slides]);

  const slide = slides[Math.min(i, slides.length - 1)] || slides[0];

  const go = useCallback((delta) => {
    setI((prev) => {
      const next = Math.min(Math.max(prev + delta, 0), slides.length - 1);
      if (next !== prev) setRevealed(false);
      return next;
    });
  }, [slides.length]);

  const jump = (index) => { setI(index); setRevealed(false); };

  const toggleFull = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
      // e.code as well as e.key: some keyboard layouts and remote presenters
      // report the space bar as 'Spacebar' or nothing at all.
      else if (REVEAL_KEYS.includes(e.key) || e.code === 'Space') { e.preventDefault(); setRevealed(true); }
      else if (e.key === 'f' || e.key === 'F') { toggleFull(); }
      else if (e.key === 'Escape' && !document.fullscreenElement) { navigate('/daily'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, toggleFull, navigate]);

  const meaningL1 = (item) => (lang === 'tr' ? item.meaningTR : item.meaningAZ) || '';

  return (
    <div className="teach" ref={stageRef}>
      <div className="teach-bar">
        <button type="button" className="teach-icon" onClick={() => navigate('/daily')} aria-label="Leave lesson mode">
          <X size={18} strokeWidth={2} />
        </button>
        <div className="teach-jump">
          {sections.map((s) => (
            <button
              key={s.name}
              type="button"
              className={`teach-tab ${slide.section === s.name ? 'is-on' : ''}`}
              onClick={() => jump(s.index)}
            >
              {s.name}
            </button>
          ))}
        </div>
        <span className="teach-count">{i + 1} / {slides.length}</span>
        <button type="button" className="teach-icon" onClick={toggleFull} aria-label="Fullscreen">
          {full ? <Minimize2 size={18} strokeWidth={2} /> : <Maximize2 size={18} strokeWidth={2} />}
        </button>
      </div>

      <div className="teach-progress"><div style={{ width: `${((i + 1) / slides.length) * 100}%` }} /></div>

      {/* The stage. Clicking it advances, which is what a presenter expects —
          and the arrows stay for anyone driving with a mouse. */}
      <div className="teach-stage" onClick={() => (revealed ? go(1) : setRevealed(true))}>
        {slide.kind === 'cover' && (
          <div className="teach-slide teach-slide--cover">
            <p className="teach-eyebrow">Today’s topic</p>
            <h1 className="teach-title">{plainTopic(content.topic)}</h1>
            <p className="teach-sub">
              {(content.vocabulary || []).length} words · {(content.idioms || []).length} idioms ·{' '}
              {(((content.questions || {}).easy) || []).length + (((content.questions || {}).hard) || []).length} questions ·{' '}
              {images.length} pictures
            </p>
          </div>
        )}

        {slide.kind === 'word' && (
          <div className="teach-slide">
            <p className="teach-eyebrow">Word</p>
            <h1 className="teach-title">{slide.item.word}</h1>
            {revealed ? (
              <>
                <p className="teach-body">{slide.item.meaning}</p>
                {meaningL1(slide.item) && <p className="teach-l1">{meaningL1(slide.item)}</p>}
                {slide.item.example && <p className="teach-example">“{slide.item.example}”</p>}
              </>
            ) : <p className="teach-hint"><Eye size={16} /> Ask them first — press Space to show the meaning</p>}
          </div>
        )}

        {slide.kind === 'idiom' && (
          <div className="teach-slide">
            <p className="teach-eyebrow">Idiom</p>
            <h1 className="teach-title">{slide.item.phrase}</h1>
            {revealed ? (
              <>
                <p className="teach-body">{slide.item.meaning}</p>
                {meaningL1(slide.item) && <p className="teach-l1">{meaningL1(slide.item)}</p>}
                {slide.item.example && <p className="teach-example">“{slide.item.example}”</p>}
              </>
            ) : <p className="teach-hint"><Eye size={16} /> Press Space to show the meaning</p>}
          </div>
        )}

        {slide.kind === 'question' && (
          <div className="teach-slide">
            <p className="teach-eyebrow">{slide.level}</p>
            <h1 className="teach-question">{slide.text}</h1>
          </div>
        )}

        {slide.kind === 'picture' && (
          <div className="teach-slide teach-slide--picture">
            <div className="teach-photo">
              <img src={slide.img.url} alt={slide.img.alt || ''} />
            </div>
            <div className="teach-photo-side">
              <div className="teach-words">
                {(slide.img.keywords || []).map((w) => <span key={w} className="teach-word">{w}</span>)}
              </div>
              {revealed
                ? (slide.img.prompts || []).map((p) => <p key={p} className="teach-prompt">{p}</p>)
                : <p className="teach-hint"><Eye size={16} /> Let them describe it, then press Space for the questions</p>}
            </div>
          </div>
        )}

        {slide.kind === 'end' && (
          <div className="teach-slide teach-slide--cover">
            <h1 className="teach-title">That’s the topic.</h1>
            <p className="teach-sub">Now put them in pairs and let them speak.</p>
          </div>
        )}
      </div>

      <div className="teach-nav">
        <button type="button" className="teach-icon" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous">
          <ChevronLeft size={22} strokeWidth={2} />
        </button>
        <span className="teach-keyhint">← → to move · Space to reveal · F for fullscreen</span>
        <button type="button" className="teach-icon" onClick={() => go(1)} disabled={i >= slides.length - 1} aria-label="Next">
          <ChevronRight size={22} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
