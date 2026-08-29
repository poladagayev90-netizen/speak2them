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
 * The keyword pills are the mechanic that makes this activity work, and since
 * the picture does not end until every one of them has been used, they are no
 * longer a hint — they ARE the task. So each one has to announce the moment it
 * is won: it flips, it pops, and a short blip plays (see wordWon in
 * utils/cue.js for why a sound is safe here and nowhere else). Getting a word
 * used to be a silent colour change nobody watching the photograph noticed.
 *
 * Scoring is the server's: a stemming match on the transcript, so "kneeling"
 * counts for "kneel". Instant and free — no model is involved.
 */
export default function AiDescribeStage({ image, hits = [], justHit = [], heard, showRule = false }) {
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
  const freshSet = new Set(justHit.map((h) => String(h).toLowerCase()));
  const allUsed = keywords.length > 0 && hitSet.size >= keywords.length;

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
            Use all these words · {hitSet.size}/{keywords.length}
          </p>
          <div className="ai-words">
            {keywords.map((k) => {
              const word = k && k.word ? k.word : k;
              const lower = String(word).toLowerCase();
              const hit = hitSet.has(lower);
              return (
                <span
                  key={word}
                  className={`ai-word${hit ? ' ai-word--hit' : ''}${freshSet.has(lower) ? ' ai-word--won' : ''}`}
                >
                  <Pill tone={hit ? 'default' : 'ai'} hit={hit}>
                    {hit && <span aria-hidden="true">✓</span>}
                    {word}
                  </Pill>
                </span>
              );
            })}
          </div>
          {/* Said ONCE, on the first picture of a learner's first session. The
              rule is not guessable from a row of words, and a learner who does
              not know it reads the pills as decoration. After the first picture
              the counter above carries the same meaning without the sentence. */}
          {showRule && !allUsed && (
            <p className="ai-word-rule">Use every word to finish the picture.</p>
          )}
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
