import React, { useEffect, useState } from 'react';
import { fetchTopicImages } from '../utils/fetchTopicImages';

// In-call synchronized picture stage. Both parties see the exact same image
// (deterministic ?lock= seeded URLs) and either side can advance the index,
// which is synced through the call doc's imageStage field.
export default function CallImageStage({ content, imageIndex, onNext, onClose }) {
  const [images, setImages] = useState([]);

  useEffect(() => {
    fetchTopicImages(content.imageKeywords, content.manualImageUrls).then(setImages);
  }, [content]);

  if (!images.length) return null;

  const safeIndex = imageIndex % images.length;
  const image = images[safeIndex];
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

        <img
          src={image.url}
          alt={image.alt || 'Topic'}
          style={{ width: '100%', height: 190, objectFit: 'cover', display: 'block' }}
        />

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
