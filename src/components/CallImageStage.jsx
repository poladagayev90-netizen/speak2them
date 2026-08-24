import React, { useEffect, useState } from 'react';
import { fetchTopicImages } from '../utils/fetchTopicImages';
import { X, ImageOff } from 'lucide-react';
import DescribeFrames from './DescribeFrames';

// In-call synchronized picture stage. Both parties see the exact same image —
// the list is a pure function of the topic (deterministic picsum seed URLs,
// no per-peer fallback), and the index is synced through the call doc's
// imageStage field — so neither the picture nor its order can drift apart.
export default function CallImageStage({ content, imageIndex, onNext, onClose }) {
  const [images, setImages] = useState([]);
  // Per-image load bookkeeping, keyed by image id:
  // failed  — primary URL errored, render the deterministic fallback instead
  // dead    — fallback errored too, render a static placeholder
  // loadedUrl — the src that last finished loading; anything else shows the skeleton
  const [failed, setFailed] = useState({});
  const [dead, setDead] = useState({});
  const [loadedUrl, setLoadedUrl] = useState('');

  useEffect(() => {
    fetchTopicImages(content.day, content.imageKeywords, content.manualImageUrls).then(setImages);
  }, [content]);

  // Warm the next picture while the current one is on screen, so "Növbəti"
  // swaps instantly instead of showing the skeleton again.
  useEffect(() => {
    if (!images.length) return;
    const next = images[(imageIndex + 1) % images.length];
    if (next?.url) { const img = new Image(); img.src = next.url; }
  }, [images, imageIndex]);

  if (!images.length) return null;

  const safeIndex = imageIndex % images.length;
  const image = images[safeIndex];
  const src = failed[image.id] && image.fallbackUrl ? image.fallbackUrl : image.url;
  const isDead = !!dead[image.id];
  const isLoading = !isDead && loadedUrl !== src;
  // Açar sözlər ŞƏKLİN ÖZÜNDƏN gəlir. Əvvəl mövzu lüğətindən götürülürdü və
  // ekrandakı şəkillə heç bir əlaqəsi olmurdu (morj şəkli + tamam başqa sözlər).
  const keywords = Array.isArray(image.keywords) ? image.keywords : [];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 'var(--z-stage)',
      // A dim behind the sheet. Without it the call screen reads straight
      // through every gap around the panel -- avatar, name, timer and the End
      // button competing with the activity's own text, which is exactly how
      // this looked once --bg-card went translucent. pointerEvents stays
      // 'none', so the call controls underneath remain reachable mid-activity.
      background: 'var(--overlay)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', pointerEvents: 'none',
    }}>
      <div style={{
        pointerEvents: 'auto', width: '100%', maxWidth: 360,
        background: 'var(--bg-card)',
        borderRadius: 'var(--r-xl)', border: '1px solid var(--border)',
        boxShadow: 'var(--glass-edge), var(--e-3)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px',
        }}>
          <p style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, margin: 0 }}>
            Describe the picture together
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

        {/* `contain` şəklin ətrafında boş zolaq qoyur; zolaq sabit #000 idi və
            light mode-da kartın ortasında qara qutu kimi görünürdü. */}
        <div style={{ position: 'relative', width: '100%', height: 230, background: 'var(--bg-secondary)' }}>
          {isDead ? (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 6,
              color: 'var(--text-muted)', fontSize: 13, fontWeight: 600,
            }}>
              <ImageOff size={28} strokeWidth={1.5} aria-hidden="true" />
              The picture did not load — describe the topic in words
            </div>
          ) : (
            <img
              key={src}
              src={src}
              alt={image.alt || 'Topic'}
              onLoad={() => setLoadedUrl(src)}
              onError={() => {
                if (src === image.url && image.fallbackUrl) {
                  setFailed((prev) => ({ ...prev, [image.id]: true }));
                } else {
                  setDead((prev) => ({ ...prev, [image.id]: true }));
                }
              }}
              style={{
                width: '100%', height: 230, objectFit: 'contain', display: 'block',
                opacity: isLoading ? 0 : 1, transition: 'opacity 200ms ease',
              }}
            />
          )}
          {isLoading && (
            <div aria-hidden="true" className="imgstage-skeleton" style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
            }}>
              Loading picture…
            </div>
          )}
        </div>

        {keywords.length > 0 && (
          <div style={{ padding: '12px 16px 4px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Keywords · {safeIndex + 1}/{images.length}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {keywords.map((v, i) => (
                <span key={i} style={{
                  background: 'var(--accent)', color: 'var(--text-on-accent)',
                  borderRadius: 20, padding: '5px 14px',
                  fontSize: 13, fontWeight: 600,
                }}>
                  {v.word || v}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Zəngdə yer azdır — qəliblər yığılı gəlir, şagird lazım olanda açır.
            Kart uzanmasın deyə bu blok öz içində sürüşür. */}
        <div style={{ maxHeight: '30vh', overflowY: 'auto' }}>
          <DescribeFrames compact prompts={image.prompts || []} />
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '14px 16px 16px' }}>
          <button
            onClick={onNext}
            style={{
              flex: 1, height: 44, borderRadius: 12, border: 'none',
              background: 'var(--accent)', color: 'var(--text-on-accent)',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Next picture →
          </button>
        </div>
      </div>
    </div>
  );
}
