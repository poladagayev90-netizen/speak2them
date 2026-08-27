import React, { useEffect, useState } from 'react';
import { ImageOff, Check } from 'lucide-react';
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
export default function AiDescribeStage({ image, hits = [], heard }) {
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

      {/* A RECEIPT, not a decoration. On a silent activity this line is the
          only proof the learner has that their voice reached AInur at all, and
          unlabelled it just looked like more text on the screen. */}
      {heard && (
        <div className="ai-heard-block">
          <p className="ai-heard-label">
            <Check size={12} strokeWidth={3} aria-hidden="true" /> AInur heard you say
          </p>
          <p className="ai-heard">“{heard}”</p>
        </div>
      )}

      <DescribeFrames compact prompts={image.prompts || []} />
    </>
  );
}
