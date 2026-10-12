import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Eye, EyeOff, Mic, MessagesSquare, Sparkles, Maximize2, Minimize2 } from 'lucide-react';
import { activeLineAt, buildTerms, onlyWords, sceneAt, spokenText } from '../../utils/topicMaterials';
import { TermText, LangSwitch, WordCard } from './TermText';
import MaterialQuestions from './MaterialQuestions';

const SPEEDS = [0.8, 0.9, 1, 1.1];
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// One episode of The SpeakLab Podcast: Before (the topic's key words, a
// guess) → Listen (chapters, pictures, the script with every key word
// tappable) → Check → Talk (what to ask a partner in the next call).
// On a computer it lays out in two columns — the teacher shares this screen,
// and «Present» makes the type big enough for a shared screen.
export default function PodcastEpisode({ podcast, topic }) {
  const audioRef = useRef(null);
  const scriptRef = useRef(null);
  const lineRefs = useRef([]);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(podcast.duration || 0);
  const [speed, setSpeed] = useState(1);
  const [showScript, setShowScript] = useState(false);
  const [picked, setPicked] = useState(null);
  const [present, setPresent] = useState(false);

  const terms = useMemo(() => onlyWords(buildTerms(topic), podcast.words), [topic, podcast.words]);
  const lines = podcast.lines;
  const idx = activeLineAt(lines, t);
  const chapters = podcast.chapters || [];
  const chapter = sceneAt(chapters, idx);
  // The picture: the cover through the intro, then each chapter's own scene
  // from `picFrom` (the line its story starts) — or from the chapter start.
  const pic = idx < 0 ? null : chapters.reduce((p, c) => ((c.picFrom ?? c.from) <= idx ? c : p), null);
  const hostNames = Object.keys(podcast.hosts || {});

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

  // Follow the spoken line inside the script box only — never scroll the page.
  useEffect(() => {
    if (!showScript || idx < 0 || !playing) return;
    const el = lineRefs.current[idx];
    const box = scriptRef.current;
    if (el && box) box.scrollTo({ top: el.offsetTop - box.offsetTop - box.clientHeight / 3, behavior: 'smooth' });
  }, [idx, showScript, playing]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    else { a.pause(); setPlaying(false); }
  };
  const seek = (sec, play = true) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(sec, (a.duration || dur || sec)));
    setT(a.currentTime);
    if (play && a.paused) a.play().then(() => setPlaying(true)).catch(() => {});
  };
  const chapterStart = (c) => lines[c.from]?.at ?? 0;

  const keyWords = terms.filter((x) => x.kind !== 'phrase');

  return (
    <div className={`mt-ep${present ? ' mt-present' : ''}`} onClick={() => picked && setPicked(null)}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- the script below is the transcript */}
      <audio ref={audioRef} src={podcast.audio} preload="metadata" />

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
          <button type="button" className="mt-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={22} /> : <Play size={22} />}
          </button>
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
          <button type="button" className="mt-icon" onClick={() => seek(t - 5)} aria-label="Back 5 seconds"><RotateCcw size={18} /></button>
        </div>

        <div className="mt-row">
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
              <button type="button" className={`mt-chapter${chapter === c && idx >= 0 ? ' is-on' : ''}`} onClick={() => seek(chapterStart(c))}>
                <span className="mt-chapter-n">{i + 1}</span>
                <span className="mt-chapter-title">{c.title}</span>
                <span className="mt-chapter-time">{fmt(chapterStart(c))}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-who">
          {hostNames.map((name, i) => (
            <p key={name} className="mt-who-row"><span className={`mt-dot mt-dot--${i}`} /><b>{name}</b> {podcast.hosts[name]}</p>
          ))}
        </div>
      </div>

      <div className="mt-ep-text">
        <section className="mt-step">
          <h3 className="mt-step-h"><span className="mt-step-n">1</span> Before you listen</h3>
          <div className="mt-step-head">
            <p className="mt-hint">Tap a word to see it in your language.</p>
            <LangSwitch />
          </div>
          <div className="mt-words">
            {keyWords.map((w) => (
              <button key={w.key} type="button" className={`mt-word${picked?.key === w.key ? ' is-on' : ''}${w.kind === 'idiom' ? ' mt-word--idiom' : ''}`}
                onClick={(e) => { e.stopPropagation(); setPicked(picked?.key === w.key ? null : w); }}>{w.phrase}</button>
            ))}
          </div>
          {podcast.before?.predict && (
            <p className="mt-predict"><Sparkles size={16} aria-hidden="true" /> {podcast.before.predict}</p>
          )}
        </section>

        <section className="mt-step">
          <h3 className="mt-step-h"><span className="mt-step-n">2</span> Listen</h3>
          <p className="mt-hint">First listen without the script. Then open it — every key word is marked.</p>
          <button type="button" className="mt-ghost" onClick={(e) => { e.stopPropagation(); setShowScript((v) => !v); }} aria-expanded={showScript}>
            {showScript ? <EyeOff size={16} /> : <Eye size={16} />} {showScript ? 'Hide the script' : 'Show the script'}
          </button>
          {showScript && (
            <ol className="mt-script" ref={scriptRef}>
              {lines.map((l, i) => (
                <li key={i} ref={(el) => { lineRefs.current[i] = el; }} className={`mt-line${i === idx ? ' is-on' : ''}`}>
                  <button type="button" className={`mt-line-who mt-dot-text--${Math.max(0, hostNames.indexOf(l.s))}`} onClick={() => seek(l.at || 0)} aria-label={`Play from here: ${l.s}`}>
                    {l.s}
                  </button>
                  <span className="mt-line-text"><TermText text={spokenText(l.t)} terms={terms} picked={picked} onPick={setPicked} /></span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="mt-step">
          <h3 className="mt-step-h"><span className="mt-step-n">3</span> Check</h3>
          <MaterialQuestions questions={podcast.questions} title="Did you get it?" />
        </section>

        {podcast.talk?.length > 0 && (
          <section className="mt-step">
            <h3 className="mt-step-h"><span className="mt-step-n">4</span> Talk about it</h3>
            <p className="mt-hint">Ask your partner in your next call — use two words from the list.</p>
            <ul className="mt-talk">
              {podcast.talk.map((q) => <li key={q}><MessagesSquare size={16} aria-hidden="true" /> {q}</li>)}
            </ul>
          </section>
        )}
      </div>

      <WordCard term={picked} onClose={() => setPicked(null)} />
    </div>
  );
}
