import KeywordChips from './KeywordChips';
import React, { useEffect, useRef, useState } from 'react';
import { videosForTopic } from '../utils/fetchTopicVideos';
import { X, VideoOff, RotateCcw, Play, Pause } from 'lucide-react';
import DescribeFrames from './DescribeFrames';

// In-call synchronized CLIP stage — the moving-picture twin of CallImageStage.
//
// WHAT IS SYNCED AND WHAT IS NOT: the deck and the index are, the playhead is
// not. Both peers compute the list from the topic pinned in the call doc, so
// index 3 is the same clip on both phones; each side then plays it on its own,
// because the clips are 6–26 s and loop, and a shared playhead would mean a
// seek storm on every "Next" and a stall on the slower connection. The activity
// is "you two describe this", not "watch it in unison".
//
// MUTED, ALWAYS: the files carry no audio track at all (stripped at encode
// time). Muted also happens to be what every mobile browser requires before it
// will autoplay without a tap — so the clip starts by itself, which is what a
// pair mid-call needs.
export default function CallVideoStage({ content, videoIndex, onNext, onClose }) {
  const videos = videosForTopic(content.day);
  const videoRef = useRef(null);
  const [dead, setDead] = useState({});
  const [paused, setPaused] = useState(false);
  // See TopicVideos: a fixed box wastes the card's height on a landscape clip.
  const [ratio, setRatio] = useState(null);

  const safeIndex = videos.length ? videoIndex % videos.length : 0;
  const clip = videos[safeIndex];

  // A new clip always starts from the beginning and playing: React reuses the
  // same <video> node across index changes, so without this the element kept
  // the previous clip's paused state and its "Play" overlay.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    setPaused(false);
    setRatio(null);
    el.currentTime = 0;
    const p = el.play();
    if (p && p.catch) p.catch(() => setPaused(true));
  }, [clip?.id]);

  // Warm the next clip while this one is on screen, so "Next" starts instantly
  // instead of showing a poster and a spinner.
  //
  // Keyed on the SRC string, not on `videos`: videosForTopic builds a new array
  // on every call, and Chat re-renders this stage once a second for the call
  // timer — so an array dependency started a fresh preload every second, on
  // the same connection that carries the voice.
  const nextSrc = videos.length ? videos[(safeIndex + 1) % videos.length]?.src : null;
  useEffect(() => {
    if (!nextSrc) return;
    const pre = document.createElement('video');
    pre.preload = 'auto';
    pre.src = nextSrc;
  }, [nextSrc]);

  if (!clip) return null;

  const isDead = !!dead[clip.id];

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) { el.play().catch(() => {}); setPaused(false); }
    else { el.pause(); setPaused(true); }
  };

  const replay = () => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.play().catch(() => {});
    setPaused(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 'var(--z-stage)',
      background: 'var(--overlay)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', pointerEvents: 'none',
    }}>
      {/* The clip is taller than a photo, so unlike the picture card this one
          can run out of screen on a small phone. Same fix the debate panel
          needed: cap the card, let the one scrollable block inside it scroll,
          and pin the header and the Next button so they are always reachable. */}
      <div style={{
        pointerEvents: 'auto', width: '100%', maxWidth: 360,
        maxHeight: 'calc(100vh - 32px)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-card)',
        borderRadius: 'var(--r-xl)', border: '1px solid var(--border)',
        boxShadow: 'var(--glass-edge), var(--e-3)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', flexShrink: 0,
        }}>
          <p style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, margin: 0 }}>
            Describe the video together
          </p>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-secondary)',
              fontSize: 18, cursor: 'pointer', padding: '2px 6px',
            }}
          >
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>

        {/* Portrait clips contained whole, not cropped: `cover` on a 9:16 frame
            keeps its middle third, which is the part being described. Tall
            enough to see a face, capped so the card still fits a short phone
            with the keywords and the Next button on it. */}
        <div style={{
          position: 'relative', width: '100%',
          ...(ratio
            ? { aspectRatio: String(ratio), maxHeight: 'min(46vh, 340px)' }
            : { height: 'min(46vh, 340px)' }),
          background: 'var(--bg-secondary)', flexShrink: 0,
        }}>
          {isDead ? (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 6,
              color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, textAlign: 'center',
              padding: '0 16px',
            }}>
              <VideoOff size={28} strokeWidth={1.5} aria-hidden="true" />
              The clip did not load — describe the topic in words
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                key={clip.id}
                src={clip.src}
                poster={clip.poster}
                muted
                loop
                playsInline
                autoPlay
                preload="auto"
                onClick={togglePlay}
                onLoadedMetadata={(e) => {
                  const { videoWidth: w, videoHeight: h } = e.currentTarget;
                  if (w && h) setRatio(w / h);
                }}
                onError={() => setDead((prev) => ({ ...prev, [clip.id]: true }))}
                aria-label={clip.alt}
                style={{
                  width: '100%', height: '100%', objectFit: 'contain', display: 'block',
                  cursor: 'pointer', background: 'var(--bg-secondary)',
                }}
              />
              {/* Paused is a state a learner can land in by tapping the frame,
                  and a still frame with no control on it looks broken. */}
              {paused && (
                <button
                  onClick={togglePlay}
                  aria-label="Play"
                  style={{
                    position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                    background: 'rgba(0,0,0,0.35)', border: 'none', cursor: 'pointer',
                    color: '#fff',
                  }}
                >
                  <Play size={34} strokeWidth={2} />
                </button>
              )}
              <div style={{
                position: 'absolute', right: 8, bottom: 8, display: 'flex', gap: 6,
              }}>
                <button
                  onClick={togglePlay}
                  aria-label={paused ? 'Play' : 'Pause'}
                  style={overlayBtn}
                >
                  {paused ? <Play size={15} strokeWidth={2} /> : <Pause size={15} strokeWidth={2} />}
                </button>
                {/* The one control a describing pair genuinely reaches for:
                    "wait, play it again" is half of what they say out loud. */}
                <button onClick={replay} aria-label="Play again" style={overlayBtn}>
                  <RotateCcw size={15} strokeWidth={2} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Everything below the clip shares what is left of the card. */}
        <div style={{ overflowY: 'auto', minHeight: 0, flex: 1 }}>
          <KeywordChips
            words={clip.keywords || []}
            label={`Keywords · ${safeIndex + 1}/${videos.length}`}
            style={{ padding: '12px 16px 4px' }}
          />
          <DescribeFrames compact prompts={clip.prompts || []} />
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '14px 16px 16px', flexShrink: 0 }}>
          <button
            onClick={onNext}
            style={{
              flex: 1, height: 44, borderRadius: 12, border: 'none',
              background: 'var(--accent)', color: 'var(--text-on-accent)',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Next video →
          </button>
        </div>
      </div>
    </div>
  );
}

// Sits ON the video frame, so it cannot use a theme surface token: the frame
// underneath is whatever the clip is showing, in both themes.
const overlayBtn = {
  width: 30, height: 30, borderRadius: '50%',
  display: 'grid', placeItems: 'center',
  background: 'rgba(0,0,0,0.55)', color: '#fff',
  border: 'none', cursor: 'pointer',
};
