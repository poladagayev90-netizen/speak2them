import React, { useState } from 'react';
import { localMeaning } from '../../utils/feedbackLanguage';
import './story.css';

// The pieces of one Julian episode (storyChapters doc). The homework shows
// them one step at a time; the teacher's review shows them all at once.

export function StoryAudio({ src, label }) {
  if (!src) return null;
  // eslint-disable-next-line jsx-a11y/media-has-caption -- the script is shown beside the player
  return <audio className="st-audio" controls preload="none" src={src} aria-label={label} />;
}

export function StoryListening({ chapter, showScript: initial = false }) {
  const [show, setShow] = useState(initial);
  const l = chapter.listening || {};
  return (
    <div className="st-block">
      <p className="st-kind">{l.kind || 'Listening'}</p>
      <StoryAudio src={l.audioUrl} label="Listening" />
      {initial ? null : (
        <button type="button" className="st-link" onClick={() => setShow(!show)} aria-expanded={show}>
          {show ? 'Hide the script' : 'Show the script'}
        </button>
      )}
      {show && <div className="st-script">{(l.text || '').split('\n').filter(Boolean).map((t, i) => <p key={i}>{t}</p>)}</div>}
    </div>
  );
}

// The reading with its target expressions marked; tapping one shows its
// meaning in the learner's language.
export function StoryReading({ chapter }) {
  const [openExp, setOpenExp] = useState(null);
  const exps = chapter.expressions || [];
  const mark = (text) => {
    if (!exps.length) return text;
    const re = new RegExp(`(${exps.map((e) => e.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    return text.split(re).map((part, i) => {
      const e = exps.find((x) => x.phrase.toLowerCase() === part.toLowerCase());
      return e
        ? <button key={i} type="button" className="st-exp" onClick={() => setOpenExp(e)}>{part}</button>
        : <React.Fragment key={i}>{part}</React.Fragment>;
    });
  };
  return (
    <div className="st-block">
      <StoryAudio src={chapter.readingAudioUrl} label="Read aloud" />
      <div className="st-reading">
        {(chapter.reading || '').split(/\n\s*\n/).map((para, i) => <p key={i}>{mark(para)}</p>)}
      </div>
      {openExp && (
        <button type="button" className="st-exp-card" onClick={() => setOpenExp(null)} aria-label={`${openExp.phrase}. Tap to close.`}>
          <p className="st-exp-phrase">{openExp.phrase}</p>
          <p className="st-exp-meaning">{localMeaning(openExp)}</p>
          {openExp.example && <p className="st-exp-example">“{openExp.example}”</p>}
        </button>
      )}
    </div>
  );
}

export function StoryQuestions({ chapter }) {
  const [picked, setPicked] = useState({});
  const qs = chapter.questions || [];
  if (!qs.length) return null;
  return (
    <div className="st-block">
      <p className="st-sub">Did you follow it?</p>
      {qs.map((q, i) => (
        <div key={i} className="st-q">
          <p className="st-q-text">{q.question}</p>
          <div className="st-q-opts">
            {q.options.map((o) => {
              const chosen = picked[i] === o;
              const state = picked[i] == null ? '' : o === q.answer ? ' is-right' : chosen ? ' is-wrong' : '';
              return (
                <button key={o} type="button" disabled={picked[i] != null} className={`st-opt${state}`}
                  onClick={() => setPicked((m) => ({ ...m, [i]: o }))}>{o}</button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StoryDilemma({ chapter }) {
  const d = chapter.dilemma;
  if (!d?.question) return null;
  return (
    <div className="st-dilemma">
      <p className="st-sub">Julian's choice — what would you do?</p>
      <p className="st-dilemma-q">{d.question}</p>
      <div className="st-sides">
        <p><b>One side:</b> {d.sideA}</p>
        <p><b>The other:</b> {d.sideB}</p>
      </div>
    </div>
  );
}

export default function StoryEpisode({ chapter }) {
  return (
    <div className="st-episode">
      <p className="st-sub">Listening — opens the episode</p>
      <StoryListening chapter={chapter} showScript />
      <p className="st-sub">Reading</p>
      <StoryReading chapter={chapter} />
      {chapter.expressions?.length > 0 && (
        <ul className="st-exps">
          {chapter.expressions.map((e) => <li key={e.phrase}><b>{e.phrase}</b> — {e.meaningAZ} / {e.meaningTR}</li>)}
        </ul>
      )}
      <StoryQuestions chapter={chapter} />
      {chapter.dictation?.length > 0 && (
        <div className="st-block">
          <p className="st-sub">Dictation</p>
          <ol className="st-dict">{chapter.dictation.map((d, i) => <li key={i}>{d.text}</li>)}</ol>
        </div>
      )}
      <StoryDilemma chapter={chapter} />
    </div>
  );
}
