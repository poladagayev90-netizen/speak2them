import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import Pill from '../ui/Pill';
import DescribeFrames from '../DescribeFrames';
import './ai.css';

/**
 * One picture in an AInur describing session.
 *
 * The AI variant of CallImageStage rather than a change to it — that component
 * still serves the human call, where the picture index is synced through the
 * call document. Here there is no peer to stay in step with, so the two have
 * genuinely different jobs even though they read the same data.
 *
 * The keyword pills are the mechanic that makes this activity work. They turn
 * green the moment the learner actually says the word, which is scored on the
 * server by a plain string match — instant, and free. A learner who does not
 * know what to say always has six concrete targets in front of them.
 */
export default function AiDescribeStage({ image, hits = [], heard, reply, thinking }) {
  const [failed, setFailed] = useState(false);
  const [dead, setDead] = useState(false);
  const [loadedUrl, setLoadedUrl] = useState('');

  // A new picture starts its own load bookkeeping, or the previous picture's
  // "loaded" flag would make this one flash in before it is ready.
  useEffect(() => { setFailed(false); setDead(false); }, [image?.id]);

  if (!image) return null;

  const src = failed && image.fallbackUrl ? image.fallbackUrl : image.url;
  const loading = !dead && loadedUrl !== src;
  const keywords = Array.isArray(image.keywords) ? image.keywords : [];
  const hitSet = new Set(hits.map((h) => String(h).toLowerCase()));

  return (
    <>
      <div className="ai-photo">
        {dead ? (
          <div className="ai-photo-fallback">
            <ImageOff size={28} strokeWidth={1.5} aria-hidden="true" />
            The picture did not load. Describe the words below instead.
          </div>
        ) : (
          <img
            key={src}
            src={src}
            alt={image.alt || 'Picture to describe'}
            style={{ opacity: loading ? 0 : 1 }}
            onLoad={() => setLoadedUrl(src)}
            onError={() => {
              if (src === image.url && image.fallbackUrl) setFailed(true);
              else setDead(true);
            }}
          />
        )}
        {loading && !dead && <div className="ai-photo-fallback">Loading picture…</div>}
      </div>

      {keywords.length > 0 && (
        <div>
          <p className="ui-section-label">
            Use these words · {hitSet.size}/{keywords.length}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-2)' }}>
            {keywords.map((k) => {
              const word = k && k.word ? k.word : k;
              const hit = hitSet.has(String(word).toLowerCase());
              return (
                <Pill key={word} tone={hit ? 'default' : 'ai'} hit={hit}>
                  {hit && <span aria-hidden="true">✓</span>}
                  {word}
                </Pill>
              );
            })}
          </div>
        </div>
      )}

      {heard && (
        <p className="ai-heard">“{heard}”</p>
      )}

      {(reply || thinking) && (
        <div className="ai-bubble">
          <img
            src="/ainur_avatar.png"
            alt=""
            className={`ai-avatar${thinking ? ' ai-avatar--pulse' : ''}`}
          />
          <div className="ai-bubble-body">
            <p className="ai-bubble-name">AInur</p>
            <p className="ai-bubble-text">{thinking ? 'Listening…' : reply}</p>
          </div>
        </div>
      )}

      <DescribeFrames compact prompts={image.prompts || []} />
    </>
  );
}
