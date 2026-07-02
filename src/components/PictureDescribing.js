import React, { useState, useEffect, useRef } from 'react';
import { fetchTopicImages } from '../utils/fetchTopicImages';

export default function PictureDescribing({ topic, imageKeywords, manualImageUrls, vocabulary, onClose }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(0);

  useEffect(() => {
    setLoading(true);
    fetchTopicImages(imageKeywords, manualImageUrls).then((imgs) => {
      setImages(imgs);
      setLoading(false);
    });
  }, [imageKeywords, manualImageUrls]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex < images.length - 1) {
        setCurrentIndex(i => i + 1);
      } else if (diff < 0 && currentIndex > 0) {
        setCurrentIndex(i => i - 1);
      }
    }
  };

  // Show 3 relevant vocabulary words per image (cycle through topic vocab)
  const getVocabForImage = (index) => {
    if (!vocabulary || vocabulary.length === 0) return [];
    const start = (index * 2) % vocabulary.length;
    return [vocabulary[start], vocabulary[(start + 1) % vocabulary.length]].filter(Boolean);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg-primary)',
      zIndex: 9999, display: 'flex', flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px', borderBottom: '1px solid var(--border)'
      }}>
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 11, margin: 0, textTransform: 'uppercase' }}>
            Şəkli Təsvir Et
          </p>
          <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, margin: 0 }}>
            {topic}
          </p>
        </div>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none',
          color: 'var(--text-secondary)', fontSize: 22, cursor: 'pointer'
        }}>✕</button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Şəkillər yüklənir...</p>
        </div>
      ) : images.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
            Şəkillər tapılmadı. İnternet bağlantısını yoxlayın.
          </p>
        </div>
      ) : (
        <>
          {/* Image */}
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{
              flex: 1, position: 'relative', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#000'
            }}
          >
            <img
              src={images[currentIndex]?.url}
              alt={images[currentIndex]?.alt}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {/* Nav arrows for desktop */}
            {currentIndex > 0 && (
              <button
                onClick={() => setCurrentIndex(i => i - 1)}
                style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff',
                  fontSize: 20, cursor: 'pointer'
                }}
              >‹</button>
            )}
            {currentIndex < images.length - 1 && (
              <button
                onClick={() => setCurrentIndex(i => i + 1)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff',
                  fontSize: 20, cursor: 'pointer'
                }}
              >›</button>
            )}
          </div>

          {/* Dots indicator */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '12px 0' }}>
            {images.map((_, i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i === currentIndex ? 'var(--accent)' : 'var(--border)'
              }} />
            ))}
          </div>

          {/* Vocabulary chips for current image */}
          <div style={{ padding: '0 20px 24px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 8 }}>
              Bu sözlərdən istifadə et:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {getVocabForImage(currentIndex).map((v, i) => (
                <span key={i} style={{
                  background: 'var(--accent)', color: '#fff',
                  borderRadius: 20, padding: '6px 14px',
                  fontSize: 13, fontWeight: 600
                }}>
                  {v?.word}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
