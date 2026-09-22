import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, VideoOff } from 'lucide-react';
import { videosForTopic } from '../utils/fetchTopicVideos';
import KeywordChips from './KeywordChips';

// The topic's six clips, inside the topic sheet.
//
// ONE AT A TIME, not a scrolling list of six players: this sheet is what a
// teacher SHARES on a call, so the clip has to be the biggest thing on the
// screen — nobody should have to zoom into a shared phone screen to see what
// is happening. Six players on one page would also pull six files at once on a
// classroom connection.
//
// It is the same deck, in the same order, as the in-call Video activity
// (videosForTopic) — the teacher shows a clip here, the pair then describes
// that same clip to each other.
export default function TopicVideos({ day }) {
  const clips = videosForTopic(day);
  const [i, setI] = useState(0);
  const [dead, setDead] = useState({});
  // The deck mixes portrait phone clips with landscape ones. A fixed-height
  // frame gives the landscape ones a band of dead space above and below, which
  // on a shared screen is the space the class needed. The frame takes the
  // clip's own shape instead, capped by the CSS so a 9:16 clip cannot push the
  // words and the questions off the page.
  const [ratio, setRatio] = useState(null);
  const videoRef = useRef(null);

  const clip = clips[i];

  // A new clip starts from the top: the element is reused across index changes.
  useEffect(() => {
    // Drop the previous clip's shape with it, or a portrait clip opens inside
    // the landscape box the last one left behind.
    setRatio(null);
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = 0;
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
  }, [clip?.id]);

  if (!clip) return null;

  const go = (d) => setI((prev) => (prev + d + clips.length) % clips.length);
  const replay = () => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.play().catch(() => {});
  };

  return (
    <div className="dt-section dt-section--video">
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
                muted
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
              <button type="button" className="dt-video-replay" onClick={replay} aria-label="Play again">
                <RotateCcw size={18} strokeWidth={2} aria-hidden="true" />
              </button>
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

        <KeywordChips words={clip.keywords || []} label="Words to use" />
      </div>

      {/* Rendered as the speaking cards are, so a question looks the same
          wherever the class meets it. Below the fold on a phone, on purpose:
          the clip and the words come first. */}
      <div className="dt-questions-list">
        {(clip.prompts || []).map((q, n) => (
          <div key={q} className="dt-question-card">
            <span className="dt-q-num">{n + 1}</span>
            <p className="dt-q-text">{q}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
