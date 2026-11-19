import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { ChevronLeft, ChevronRight, RotateCcw, Sparkles, VideoOff, Volume2, VolumeX } from 'lucide-react';
import KeywordChips from './KeywordChips';
import HowToDescribe from './HowToDescribe';

// Sound is web/PWA only (Polad, 2026-10-13); the Android app keeps every clip
// silent. Only clips marked `sound` in describeVideos.js have an audio track.
// The choice is remembered per device, but a clip always TRIES its sound and
// falls back to muted when the browser refuses unmuted autoplay (no tap yet).
const SOUND_ALLOWED = !Capacitor.isNativePlatform();
const SOUND_KEY = 'clipSound';
const readSound = () => {
  try { return localStorage.getItem(SOUND_KEY) === 'on'; } catch { return false; }
};

// One clip at a time, with arrows, its words and its two questions. Shared by
// the topic sheet (a topic's six clips) and the teacher's video library (the
// whole deck), so a clip looks the same wherever a class meets it.
//
// ONE AT A TIME, not a scrolling list of players: both places are what a
// teacher SHARES on a call, so the clip has to be the biggest thing on the
// screen. Several players on one page would also pull several files at once on
// a classroom connection.
//
// The index is controlled when the caller passes `index` + `onIndexChange`
// (the library keeps it in the URL so the browser's back button leaves the
// clip), and local otherwise (the topic sheet).
export default function ClipViewer({ clips, index, onIndexChange, footer = null }) {
  const [localIndex, setLocalIndex] = useState(0);
  const controlled = typeof index === 'number';
  const i = controlled ? index : localIndex;
  const [dead, setDead] = useState({});
  // The deck mixes portrait phone clips with landscape ones. A fixed-height
  // frame gives the landscape ones a band of dead space above and below, which
  // on a shared screen is the space the class needed. The frame takes the
  // clip's own shape instead, capped by the CSS so a 9:16 clip cannot push the
  // words and the questions off the page.
  const [ratio, setRatio] = useState(null);
  const videoRef = useRef(null);
  const pendingRef = useRef(null);
  const [soundOn, setSoundOn] = useState(readSound);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const sectionRef = useRef(null);
  const [clipBox, setClipBox] = useState(null);

  const clip = clips[i];
  const hasSound = SOUND_ALLOWED && !!clip?.sound;

  // On a computer (App.css wide grid) the clip's COLUMN is as wide as the clip
  // is at full height — Polad 2026-11-19: a portrait clip sat in a 1.35fr
  // column with grey bands either side while the words were squeezed. The
  // height of the clip's grid area (rows 1–2: the fr row fills the sheet, so
  // it does not depend on the clip), times the clip's shape, is that width;
  // it is capped so the words column keeps MIN_TEXT_W. A wide clip that hits
  // the cap gets its own height too, so it has no bands above and below
  // either. Only the wide grid reads --clip-w / --clip-h; phones ignore them.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !ratio || typeof ResizeObserver === 'undefined') { setClipBox(null); return undefined; }
    const MIN_TEXT_W = 380;
    const measure = () => {
      const cs = getComputedStyle(el);
      if (cs.display !== 'grid') { setClipBox(null); return; }
      const rows = cs.gridTemplateRows.split(' ').map(parseFloat);
      const rowGap = parseFloat(cs.rowGap) || 0;
      const colGap = parseFloat(cs.columnGap) || 0;
      const h = (rows[0] || 0) + (rows[1] || 0) + rowGap;
      const maxW = el.clientWidth - MIN_TEXT_W - colGap;
      if (h <= 0 || maxW <= 0) { setClipBox(null); return; }
      const w = Math.floor(Math.min(h * ratio, maxW));
      const fitH = Math.floor(w / ratio);
      setClipBox((prev) => (prev && prev.w === w && prev.h === fitH ? prev : { w, h: fitH, cut: fitH < h - 1 }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratio]);

  useEffect(() => { pendingRef.current = null; }, [i]);

  // A new clip starts from the top: the element is reused across index changes.
  useEffect(() => {
    // Drop the previous clip's shape with it, or a portrait clip opens inside
    // the landscape box the last one left behind. But a CACHED clip can report
    // its metadata before this effect runs, and a blind reset then wiped the
    // shape it had just given — the portrait clip sat in the 4:3 placeholder.
    // Read the shape off the element instead of assuming it is not there yet.
    const el = videoRef.current;
    setRatio(el && el.videoWidth && el.videoHeight ? el.videoWidth / el.videoHeight : null);
    if (!el) return;
    el.currentTime = 0;
    el.muted = !(hasSound && soundRef.current);
    el.play().catch(() => {
      // Unmuted autoplay refused: play silently and show the speaker as off,
      // without forgetting the choice — the next tap on it turns sound on.
      if (el.muted) return;
      el.muted = true;
      setSoundOn(false);
      el.play().catch(() => {});
    });
  }, [clip?.id, hasSound]);

  // Arrow keys step through the clips when the sheet owns the index (the
  // library has its own keys). A teacher sharing a laptop screen changes clips
  // without reaching for the mouse — and never while typing somewhere.
  useEffect(() => {
    if (controlled || clips.length < 2) return undefined;
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.target?.isContentEditable) return;
      if (e.key === 'ArrowRight') setLocalIndex((n) => (n + 1) % clips.length);
      else if (e.key === 'ArrowLeft') setLocalIndex((n) => (n - 1 + clips.length) % clips.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controlled, clips.length]);

  if (!clip) return null;

  // A controlled index arrives a render later (the library's comes back
  // through the URL), so two quick taps would both step from the same stale
  // value and one would be lost. Step from the last index asked for until the
  // new one lands.
  const go = (d) => {
    const base = pendingRef.current ?? i;
    const next = (base + d + clips.length) % clips.length;
    pendingRef.current = next;
    if (controlled) onIndexChange?.(next);
    else setLocalIndex(next);
  };
  const replay = () => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.play().catch(() => {});
  };
  const toggleSound = () => {
    const el = videoRef.current;
    const next = !soundOn;
    setSoundOn(next);
    try { localStorage.setItem(SOUND_KEY, next ? 'on' : 'off'); } catch { /* private mode */ }
    if (!el) return;
    el.muted = !next;
    if (el.paused) el.play().catch(() => {});
  };

  return (
    <div
      ref={sectionRef}
      className="dt-section dt-section--video"
      style={clipBox ? { '--clip-w': `${clipBox.w}px`, ...(clipBox.cut ? { '--clip-h': `${clipBox.h}px` } : {}) } : undefined}
    >
      {/* Clip + arrows + words are one screenful; see .dt-video-fit. */}
      <div className="dt-video-fit">
        {/* The clip's own shape decides the height — until the screen runs out,
            at which point it gives way so the words stay visible. */}
        <div
          className="dt-video-frame"
          style={ratio ? { aspectRatio: String(ratio), height: 'auto', maxHeight: '100%' } : undefined}
        >
          {dead[clip.id] ? (
            <div className="dt-video-dead">
              <VideoOff size={34} strokeWidth={1.5} aria-hidden="true" />
              This clip did not load
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                key={clip.id}
                src={clip.src}
                poster={clip.poster}
                muted={!(hasSound && soundOn)}
                loop
                playsInline
                autoPlay
                preload="auto"
                aria-label={clip.alt}
                onLoadedMetadata={(e) => {
                  const { videoWidth: w, videoHeight: h } = e.currentTarget;
                  if (w && h) setRatio(w / h);
                }}
                onError={() => setDead((prev) => ({ ...prev, [clip.id]: true }))}
              />
              {/* A Veo clip looks like a real moment caught on a phone — say it is not. */}
              {clip.ai && (
                <span className="dt-video-ai"><Sparkles size={12} strokeWidth={2.25} aria-hidden="true" /> AI video</span>
              )}
              <button type="button" className="dt-video-replay" onClick={replay} aria-label="Play again">
                <RotateCcw size={18} strokeWidth={2} aria-hidden="true" />
              </button>
              {hasSound && (
                <button
                  type="button"
                  className="dt-video-replay dt-video-sound"
                  onClick={toggleSound}
                  aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'}
                  aria-pressed={soundOn}
                >
                  {soundOn
                    ? <Volume2 size={18} strokeWidth={2} aria-hidden="true" />
                    : <VolumeX size={18} strokeWidth={2} aria-hidden="true" />}
                </button>
              )}
            </>
          )}
        </div>

        <div className="dt-video-nav">
          <button type="button" className="dt-video-arrow" onClick={() => go(-1)} aria-label="Previous video">
            <ChevronLeft size={22} strokeWidth={2.25} aria-hidden="true" />
          </button>
          <span className="dt-video-count">{i + 1} / {clips.length}</span>
          <button type="button" className="dt-video-arrow" onClick={() => go(1)} aria-label="Next video">
            <ChevronRight size={22} strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>

        <div className="dt-video-words">
          <KeywordChips words={clip.keywords || []} label="Words to use" />
        </div>
      </div>

      {/* Rendered as the speaking cards are, so a question looks the same
          wherever the class meets it. Below the fold on a phone, on purpose:
          the clip and the words come first. */}
      <div className="dt-questions-list">
        <HowToDescribe key={clip.id} howTo={clip.howTo} />
        {(clip.prompts || []).map((q, n) => (
          <div key={q} className="dt-question-card">
            <span className="dt-q-num">{n + 1}</span>
            <p className="dt-q-text">{q}</p>
          </div>
        ))}
      </div>

      {footer && <div className="dt-video-footer">{footer}</div>}
    </div>
  );
}
