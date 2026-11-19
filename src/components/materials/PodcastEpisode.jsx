import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play, Pause, RotateCcw, SkipForward, Eye, EyeOff, Mic, MessagesSquare, Sparkles,
  Maximize2, Minimize2, Languages, ArrowRight,
} from 'lucide-react';
import {
  activeLineAt, buildTerms, onlyWords, sceneAt, spokenText,
  replayLineAt, nextLineAt, lineTranslation, hasLineTranslations, levelTerms,
} from '../../utils/topicMaterials';
import { TermText, LangSwitch, WordCard } from './TermText';
import useMeaningLang from './useMeaningLang';
import MaterialQuestions from './MaterialQuestions';

const SPEEDS = [0.8, 0.9, 1, 1.1];
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
// A finger or wheel on the sheet pauses the auto-follow this long, so the
// learner can look back without being pulled to the spoken line.
const HANDS_OFF_MS = 4000;
// A levelled episode's Words step, in the order of the review sheets.
const WORD_GROUPS = [['Words', ['word']], ['Phrasal verbs', ['phrasal']], ['Idioms & phrases', ['idiom', 'chunk']]];

// The nearest box that scrolls the script: the topic sheet's content area.
function scrollBoxOf(el) {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return document.scrollingElement;
}

// One episode of The SpeakLab Podcast, in four steps: Words (the key words, a
// guess) → Listen → Check → Talk (what to ask a partner in the next call).
//
// Listen is the script itself, karaoke style (learner feedback 2026-11-18, via
// Polad: on a phone the subtitles sat below the picture, chapters and words,
// and once you reached them the player was off screen). The spoken line is
// big and kept near the top; heard lines dim; a tap on a line plays
// from there. On a phone the picture shrinks to a strip and the controls live
// in a dock under the thumb — Speed, Again (this line once more), Play, Next.
// «Listen first without the script» stays: the text starts blurred, one tap
// shows it.
//
// On a computer (the teacher shares this screen) the picture, the controls and
// the chapters stay on the left; the steps and a full-height script on the
// right. «Present» makes the type bigger still.
export default function PodcastEpisode({ podcast, topic }) {
  const audioRef = useRef(null);
  const rootRef = useRef(null);
  const lineRefs = useRef([]);
  const handsOffAt = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(podcast.duration || 0);
  const [speed, setSpeed] = useState(1);
  const [step, setStep] = useState('listen');
  const [blurred, setBlurred] = useState(true);
  const [showTr, setShowTr] = useState(false);
  const [picked, setPicked] = useState(null);
  const [present, setPresent] = useState(false);
  const [lang] = useMeaningLang();

  // A levelled episode brings its own list (core words, phrasal verbs, idioms
  // and chunks for that level); the live episode marks the topic's words.
  const levelWords = podcast.levelWords;
  const terms = useMemo(
    () => (levelWords ? levelTerms(levelWords) : onlyWords(buildTerms(topic), podcast.words)),
    [topic, podcast.words, levelWords],
  );
  const lines = podcast.lines;
  const idx = activeLineAt(lines, t);
  const chapters = podcast.chapters || [];
  const chapter = sceneAt(chapters, idx);
  // The picture: the cover through the intro, then each chapter's own scene
  // from `picFrom` (the line its story starts) — or from the chapter start.
  const pic = idx < 0 ? null : chapters.reduce((p, c) => ((c.picFrom ?? c.from) <= idx ? c : p), null);
  const hostNames = Object.keys(podcast.hosts || {});
  // Translate appears only when this episode carries line translations
  // (lines[i].az / .tr) — none do yet; see lineTranslation().
  const canTranslate = useMemo(() => hasLineTranslations(lines), [lines]);
  const keyWords = terms.filter((x) => x.kind !== 'phrase');
  // In list order, not the highlighter's longest-first order.
  const wordGroups = levelWords ? WORD_GROUPS.map(([label, kinds]) => [
    label, levelWords.map((w) => terms.find((x) => x.phrase === String(w.phrase).trim())).filter((x, i, a) => x && kinds.includes(x.kind) && a.indexOf(x) === i),
  ]).filter(([, list]) => list.length) : null;
  const hasCheck = podcast.questions?.length > 0;
  const hasTalk = podcast.talk?.length > 0;
  const steps = [['words', 'Words'], ['listen', 'Listen']];
  if (hasCheck) steps.push(['check', 'Check']);
  if (hasTalk) steps.push(['talk', 'Talk']);
  const wordButton = (w) => (
    <button key={w.key} type="button" className={`mt-word${picked?.key === w.key ? ' is-on' : ''}${w.kind === 'idiom' || w.kind === 'chunk' ? ' mt-word--idiom' : ''}`}
      onClick={(e) => { e.stopPropagation(); setPicked(picked?.key === w.key ? null : w); }}>{w.phrase}</button>
  );

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return undefined;
    const onTime = () => setT(a.currentTime);
    const onMeta = () => setDur(a.duration || podcast.duration || 0);
    const onEnd = () => setPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
      a.pause();
    };
  }, [podcast.duration]);

  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = speed; }, [speed]);

  // Follow the spoken line: keep its top a quarter of the way down the sheet,
  // so a long line still clears the dock.
  useEffect(() => {
    if (step !== 'listen' || idx < 0 || !playing) return;
    if (Date.now() - handsOffAt.current < HANDS_OFF_MS) return;
    const el = lineRefs.current[idx];
    if (!el) return;
    const box = scrollBoxOf(el);
    const top = box === document.scrollingElement ? 0 : box.getBoundingClientRect().top;
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    box.scrollBy({ top: el.getBoundingClientRect().top - top - box.clientHeight / 4, behavior: smooth ? 'smooth' : 'auto' });
  }, [idx, step, playing]);

  // A new step starts at its top, not halfway down the last one's scroll.
  const openStep = (s) => {
    setStep(s);
    setPicked(null);
    const root = rootRef.current;
    if (!root) return;
    const box = scrollBoxOf(root);
    if (box && box.scrollTop > 0) box.scrollTop = 0;
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    else { a.pause(); setPlaying(false); }
  };
  const seek = (sec, play = true) => {
    const a = audioRef.current;
    if (!a) return;
    handsOffAt.current = 0; // a jump is a request to follow again
    a.currentTime = Math.max(0, Math.min(sec, (a.duration || dur || sec)));
    setT(a.currentTime);
    if (play && a.paused) a.play().then(() => setPlaying(true)).catch(() => {});
  };
  const again = () => seek(replayLineAt(lines, t));
  const nextAt = nextLineAt(lines, t);
  const next = () => { if (nextAt != null) seek(nextAt); };
  const cycleSpeed = () => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]);
  const chapterStart = (c) => lines[c.from]?.at ?? 0;
  const handsOff = () => { handsOffAt.current = Date.now(); };

  const progress = (
    <div className="mt-progress">
      <div className="mt-track">
        <input type="range" min={0} max={dur || 1} step={0.1} value={Math.min(t, dur || 1)}
          onChange={(e) => seek(Number(e.target.value), false)} aria-label="Position" />
        {dur > 0 && chapters.slice(1).map((c) => (
          <span key={c.image} className="mt-tick" style={{ left: `${(chapterStart(c) / dur) * 100}%` }} aria-hidden="true" />
        ))}
      </div>
      <div className="mt-times"><span>{fmt(t)}</span><span>{fmt(dur)}</span></div>
    </div>
  );
  const playIcon = playing ? <Pause size={24} /> : <Play size={24} />;
  const trButton = canTranslate && (
    <button type="button" className={`mt-icon${showTr ? ' is-on' : ''}`} onClick={() => setShowTr((v) => !v)}
      aria-pressed={showTr} aria-label="Translate the line"><Languages size={18} /></button>
  );
  const card = <WordCard term={picked} onClose={() => setPicked(null)} />;

  return (
    <div ref={rootRef} className={`mt-ep${present ? ' mt-present' : ''}`}
      onClick={() => picked && setPicked(null)} onWheel={handsOff} onTouchMove={handsOff}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- the script is the transcript */}
      <audio ref={audioRef} src={podcast.audio} preload="metadata" />

      {/* Computer only: the picture, the controls and the chapters. */}
      <div className="mt-ep-media">
        <div className="mt-stage">
          {podcast.cover && <img src={podcast.cover} alt="" className={`mt-scene${!pic ? ' is-on' : ''}`} />}
          {chapters.map((c) => (
            <img key={c.image} src={c.src} alt="" loading="lazy" className={`mt-scene${pic === c ? ' is-on' : ''}`} />
          ))}
          <div className="mt-stage-shade" />
          <div className="mt-stage-caption">
            <span className="mt-chip mt-chip--onimg"><Mic size={12} /> The SpeakLab Podcast · Episode {podcast.episode} · {podcast.level}</span>
            <h3 className="mt-stage-title">{podcast.title}</h3>
            {idx >= 0 && playing && <p className="mt-now">{lines[idx].s} is speaking</p>}
          </div>
        </div>

        <div className="mt-controls">
          <button type="button" className="mt-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playIcon}</button>
          {progress}
        </div>
        <div className="mt-row">
          <div className="mt-row-group">
            <button type="button" className="mt-icon" onClick={again} aria-label="This line again"><RotateCcw size={18} /></button>
            <button type="button" className="mt-icon" onClick={next} disabled={nextAt == null} aria-label="Next line"><SkipForward size={18} /></button>
            {trButton}
          </div>
          <div className="mt-speeds" role="group" aria-label="Speed">
            {SPEEDS.map((s) => (
              <button key={s} type="button" className={`mt-speed${speed === s ? ' is-on' : ''}`} onClick={() => setSpeed(s)}>{s}×</button>
            ))}
          </div>
          <button type="button" className="mt-ghost mt-present-btn" onClick={() => setPresent((v) => !v)} aria-pressed={present}>
            {present ? <Minimize2 size={16} /> : <Maximize2 size={16} />} {present ? 'Normal size' : 'Present'}
          </button>
        </div>

        <ol className="mt-chapters" aria-label="Chapters">
          {chapters.map((c, i) => (
            <li key={c.image}>
              <button type="button" className={`mt-chapter${chapter === c && idx >= 0 ? ' is-on' : ''}`} onClick={() => { openStep('listen'); seek(chapterStart(c)); }}>
                <span className="mt-chapter-n">{i + 1}</span>
                <span className="mt-chapter-title">{c.title}</span>
                <span className="mt-chapter-time">{fmt(chapterStart(c))}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-ep-main">
        <div className="mt-steps" role="group" aria-label="Episode steps">
          {steps.map(([key, label]) => (
            <button key={key} type="button" className={`mt-steps-btn${step === key ? ' is-on' : ''}`}
              aria-pressed={step === key} onClick={() => openStep(key)}>{label}</button>
          ))}
        </div>

        {/* Phone only: the picture as a strip — which story, who is speaking. */}
        <div className="mt-mini">
          <img src={pic?.src || podcast.cover} alt="" className="mt-mini-img" />
          <div className="mt-mini-text">
            <b className="mt-mini-title">{podcast.title}</b>
            <span className="mt-mini-sub">
              {idx >= 0 && playing ? `${lines[idx].s} is speaking` : `Episode ${podcast.episode} · ${podcast.level}`}
              {chapter && idx >= 0 ? ` · ${chapter.title}` : ''}
            </span>
          </div>
        </div>

        {step === 'words' && (
          <section className="mt-step">
            <div className="mt-step-head">
              <p className="mt-hint">Tap a word to see it in your language.</p>
              <LangSwitch />
            </div>
            {wordGroups ? wordGroups.map(([label, list]) => (
              <div key={label} className="mt-word-group">
                <p className="mt-word-group-label">{label}</p>
                <div className="mt-words">{list.map(wordButton)}</div>
              </div>
            )) : (
              <div className="mt-words">{keyWords.map(wordButton)}</div>
            )}
            {podcast.before?.predict && (
              <p className="mt-predict"><Sparkles size={16} aria-hidden="true" /> {podcast.before.predict}</p>
            )}
            <div className="mt-who">
              {hostNames.map((name, i) => (
                <p key={name} className="mt-who-row"><span className={`mt-dot mt-dot--${i}`} /><b>{name}</b> {podcast.hosts[name]}</p>
              ))}
            </div>
            <button type="button" className="mt-ghost" onClick={() => openStep('listen')}>Start listening <ArrowRight size={16} /></button>
          </section>
        )}

        {step === 'listen' && (
          <section className="mt-step mt-step--listen">
            <div className="mt-listen-bar">
              <p className="mt-hint">{blurred ? 'First listen without the text.' : 'Tap a line to hear it again.'}</p>
              <button type="button" className="mt-ghost" onClick={(e) => { e.stopPropagation(); setBlurred((v) => !v); }} aria-pressed={!blurred}>
                {blurred ? <Eye size={16} /> : <EyeOff size={16} />} {blurred ? 'Show the text' : 'Hide the text'}
              </button>
            </div>

            <ol className={`mt-script${blurred ? ' is-blur' : ''}`}>
              {lines.map((l, i) => {
                const tr = showTr && i === idx ? lineTranslation(l, lang) : '';
                return (
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the speaker button is the keyboard way in
                  <li key={i} ref={(el) => { lineRefs.current[i] = el; }}
                    className={`mt-line${i === idx ? ' is-on' : ''}${i < idx ? ' is-past' : ''}`}
                    onClick={() => seek(l.at || 0)}>
                    <button type="button" className={`mt-line-who mt-dot-text--${Math.max(0, hostNames.indexOf(l.s))}`}
                      onClick={(e) => { e.stopPropagation(); seek(l.at || 0); }} aria-label={`Play from here: ${l.s}`}>
                      {l.s}
                    </button>
                    <span className="mt-line-text"><TermText text={spokenText(l.t)} terms={terms} picked={picked} onPick={setPicked} /></span>
                    {tr && <span className="mt-line-tr">{tr}</span>}
                  </li>
                );
              })}
            </ol>

            {hasCheck && <button type="button" className="mt-ghost" onClick={() => openStep('check')}>Check what you heard <ArrowRight size={16} /></button>}
            {!hasCheck && hasTalk && <button type="button" className="mt-ghost" onClick={() => openStep('talk')}>Talk about it <ArrowRight size={16} /></button>}

            <div className="mt-foot">
              {card}
              {/* Phone only: the controls under the thumb. A tap here (pause,
                  again) keeps an open word card — only a tap elsewhere closes it. */}
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- only stops the outside-tap close */}
              <div className="mt-dock" onClick={(e) => e.stopPropagation()}>
                {progress}
                <div className="mt-dock-row">
                  <button type="button" className="mt-dock-btn" onClick={cycleSpeed} aria-label={`Speed ${speed}×`}>
                    <span className="mt-icon mt-icon--text">{speed}×</span><span className="mt-dock-cap">Speed</span>
                  </button>
                  <button type="button" className="mt-dock-btn" onClick={again}>
                    <span className="mt-icon"><RotateCcw size={18} /></span><span className="mt-dock-cap">Again</span>
                  </button>
                  <button type="button" className="mt-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playIcon}</button>
                  <button type="button" className="mt-dock-btn" onClick={next} disabled={nextAt == null}>
                    <span className="mt-icon"><SkipForward size={18} /></span><span className="mt-dock-cap">Next</span>
                  </button>
                  {canTranslate ? (
                    <button type="button" className="mt-dock-btn" onClick={() => setShowTr((v) => !v)} aria-pressed={showTr}>
                      <span className={`mt-icon${showTr ? ' is-on' : ''}`}><Languages size={18} /></span><span className="mt-dock-cap">Translate</span>
                    </button>
                  ) : (
                    <button type="button" className="mt-dock-btn" onClick={() => setBlurred((v) => !v)} aria-pressed={!blurred}>
                      <span className={`mt-icon${!blurred ? ' is-on' : ''}`}>{blurred ? <Eye size={18} /> : <EyeOff size={18} />}</span>
                      <span className="mt-dock-cap">Text</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {step === 'check' && hasCheck && (
          <section className="mt-step">
            <MaterialQuestions questions={podcast.questions} title="Did you get it?" />
            {steps.some(([k]) => k === 'talk') && (
              <button type="button" className="mt-ghost" onClick={() => openStep('talk')}>Talk about it <ArrowRight size={16} /></button>
            )}
          </section>
        )}

        {step === 'talk' && podcast.talk?.length > 0 && (
          <section className="mt-step">
            <p className="mt-hint">Ask your partner in your next call — use two words from the list.</p>
            <ul className="mt-talk">
              {podcast.talk.map((q) => <li key={q}><MessagesSquare size={16} aria-hidden="true" /> {q}</li>)}
            </ul>
          </section>
        )}

        {step !== 'listen' && card}
      </div>
    </div>
  );
}
