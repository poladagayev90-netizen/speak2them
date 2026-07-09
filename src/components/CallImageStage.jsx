import React, { useEffect, useState } from 'react';
import { fetchTopicImages } from '../utils/fetchTopicImages';

// In-call synchronized picture stage. Both parties see the exact same image
// (deterministic ?lock= seeded URLs) and either side can advance the index,
// which is synced through the call doc's imageStage field.
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
    fetchTopicImages(content.imageKeywords, content.manualImageUrls).then(setImages);
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
  const vocab = content.vocabulary || [];
  const start = vocab.length ? (safeIndex * 2) % vocab.length : 0;
  const keywords = vocab.length
    ? [vocab[start], vocab[(start + 1) % vocab.length]].filter(Boolean)
    : [];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', pointerEvents: 'none',
    }}>
      <div style={{
        pointerEvents: 'auto', width: '100%', maxWidth: 360,
        background: 'var(--bg-card, #17172b)',
        borderRadius: 20, border: '1px solid #7c6ff755',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), 0 0 24px #7c6ff722',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px',
        }}>
          <p style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, margin: 0 }}>
            🖼️ Şəkli birlikdə təsvir edin
          </p>
          <button
            onClick={onClose}
            aria-label="Bağla"
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-secondary)',
              fontSize: 18, cursor: 'pointer', padding: '2px 6px',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ position: 'relative', width: '100%', height: 190, background: 'var(--bg-input, #14132b)' }}>
          {isDead ? (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 6,
              color: 'var(--text-muted)', fontSize: 13,
            }}>
              <span style={{ fontSize: 30 }} aria-hidden="true">🖼️</span>
              Şəkil yüklənmədi — mövzunu sözlə təsvir edin
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
                width: '100%', height: 190, objectFit: 'cover', display: 'block',
                opacity: isLoading ? 0 : 1, transition: 'opacity 200ms ease',
              }}
            />
          )}
          {isLoading && (
            <div aria-hidden="true" className="imgstage-skeleton" style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: 12,
            }}>
              Şəkil yüklənir…
            </div>
          )}
        </div>

        {keywords.length > 0 && (
          <div style={{ padding: '12px 16px 4px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 11, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Açar sözlər
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {keywords.map((v, i) => (
                <span key={i} style={{
                  background: 'linear-gradient(135deg, #7c6ff7, #6355e0)', color: '#fff',
                  borderRadius: 20, padding: '5px 14px',
                  fontSize: 13, fontWeight: 600,
                }}>
                  {v.word || v}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, padding: '14px 16px 16px' }}>
          <button
            onClick={onNext}
            style={{
              flex: 1, height: 44, borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #7c6ff7, #6355e0)', color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Növbəti şəkil →
          </button>
        </div>
      </div>
    </div>
  );
}
