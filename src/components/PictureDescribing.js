import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { fetchTopicImages } from '../utils/fetchTopicImages';
import DescribeFrames from './DescribeFrames';

export default function PictureDescribing({ topic, day, imageKeywords, manualImageUrls, onClose }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(0);

  useEffect(() => {
    setLoading(true);
    fetchTopicImages(day, imageKeywords, manualImageUrls).then((imgs) => {
      setImages(imgs);
      setLoading(false);
    });
  }, [day, imageKeywords, manualImageUrls]);

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

  // Açar sözlər ŞƏKLİN ÖZÜNDƏN gəlir — eynilə CallImageStage kimi. Əvvəl mövzu
  // lüğətindən dövr edilirdi (getVocabForImage), ona görə ekrandakı şəkillə heç
  // bir əlaqəsi olmurdu (morj şəkli + tamam başqa sözlər).
  const getVocabForImage = (index) => {
    const kw = images[index]?.keywords;
    return Array.isArray(kw) ? kw : [];
  };

  return (
    <div 
      onClick={e => e.stopPropagation()}
      style={{
      position: 'fixed', inset: 0, background: 'var(--bg-primary)',
      zIndex: 9999, display: 'flex', flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px', paddingTop: 'calc(16px + var(--safe-area-top, 0px))', borderBottom: '1px solid var(--border)'
      }}>
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 11, margin: 0, textTransform: 'uppercase' }}>
            Describe the picture
          </p>
          <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, margin: 0 }}>
            {topic}
          </p>
        </div>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none',
          color: 'var(--text-secondary)', fontSize: 22, cursor: 'pointer'
        }}><X size={20} strokeWidth={1.75} /></button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Loading pictures...</p>
        </div>
      ) : images.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
            No pictures found. Check your connection.
          </p>
        </div>
      ) : (
        <>
          {/* Image */}
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{
              flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              // Şəkil `contain` ilə oturur, yəni ətrafında boş zolaq qalır. Bu
              // zolaq əvvəl sabit #000 idi — light mode-da ekranın ortasında qara
              // qutu kimi görünürdü. İndi tema səthidir, hər iki rejimdə oturur.
              background: 'var(--bg-secondary)'
            }}
          >
            <img
              src={images[currentIndex]?.url}
              alt={images[currentIndex]?.alt}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
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

          {/* Alt panel: şəklin sözləri + danışıq qəlibləri. Öz içində sürüşür,
              yoxsa qəliblər açılanda şəkli ekrandan itələyirdi. */}
          <div style={{
            flexShrink: 0, maxHeight: '45vh', overflowY: 'auto',
            paddingBottom: 'calc(16px + var(--safe-area-bottom, 0px))',
            borderTop: '1px solid var(--border)',
          }}>
            <div style={{ padding: '12px 20px 8px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 11, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Use these words
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {getVocabForImage(currentIndex).map((v, i) => (
                  <span key={i} style={{
                    background: 'var(--accent)', color: '#fff',
                    borderRadius: 20, padding: '6px 14px',
                    fontSize: 13, fontWeight: 600
                  }}>
                    {v?.word || v}
                  </span>
                ))}
              </div>
            </div>
            <DescribeFrames prompts={images[currentIndex]?.prompts || []} />
          </div>
        </>
      )}
    </div>
  );
}
