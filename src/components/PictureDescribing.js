import KeywordChips from './KeywordChips';
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { fetchTopicImages } from '../utils/fetchTopicImages';
import DescribeFrames from './DescribeFrames';

// Phone: one column — the picture, dots, then the words and sentence starters
// in a panel that scrolls inside itself. A computer screen (the sheet a
// teacher shares, App.css `.pd-*` in the wide-screen block) gets the same
// layout as the topic videos: the picture fills the left, the words, starters
// and questions sit beside it at reading size, ‹ 1 / 12 › below the picture.
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

  const go = (step) => setCurrentIndex((i) => Math.min(images.length - 1, Math.max(0, i + step)));

  // ← → on a keyboard, as in the video sheet.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') setCurrentIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setCurrentIndex((i) => Math.min(images.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [images.length]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) go(diff > 0 ? 1 : -1);
  };

  // Açar sözlər ŞƏKLİN ÖZÜNDƏN gəlir — eynilə CallImageStage kimi. Əvvəl mövzu
  // lüğətindən dövr edilirdi (getVocabForImage), ona görə ekrandakı şəkillə heç
  // bir əlaqəsi olmurdu (morj şəkli + tamam başqa sözlər).
  const getVocabForImage = (index) => {
    const kw = images[index]?.keywords;
    return Array.isArray(kw) ? kw : [];
  };

  return (
    <div className="pd" onClick={e => e.stopPropagation()}>
      <div className="pd-header">
        <div className="pd-heading">
          {day && <span className="dt-badge pd-badge">Day {day}</span>}
          <div>
            <p className="pd-kicker">Describe the picture</p>
            <p className="pd-title">{topic}</p>
          </div>
        </div>
        <button type="button" className="pd-close" onClick={onClose} aria-label="Close"><X size={20} strokeWidth={1.75} /></button>
      </div>

      {loading ? (
        <div className="pd-message"><p>Loading pictures...</p></div>
      ) : images.length === 0 ? (
        <div className="pd-message"><p>No pictures found. Check your connection.</p></div>
      ) : (
        <div className="pd-body">
          <div className="pd-stage" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <img src={images[currentIndex]?.url} alt={images[currentIndex]?.alt} />
            {currentIndex > 0 && (
              <button type="button" className="pd-arrow pd-arrow--prev" onClick={() => go(-1)} aria-label="Previous picture">‹</button>
            )}
            {currentIndex < images.length - 1 && (
              <button type="button" className="pd-arrow pd-arrow--next" onClick={() => go(1)} aria-label="Next picture">›</button>
            )}
          </div>

          <div className="pd-dots" aria-hidden="true">
            {images.map((_, i) => (
              <span key={i} className={i === currentIndex ? 'is-on' : ''} />
            ))}
          </div>

          <div className="dt-video-nav pd-nav">
            <button type="button" className="dt-video-arrow" onClick={() => go(-1)} disabled={currentIndex === 0} aria-label="Previous picture">
              <ChevronLeft size={22} strokeWidth={2.25} aria-hidden="true" />
            </button>
            <span className="dt-video-count">{currentIndex + 1} / {images.length}</span>
            <button type="button" className="dt-video-arrow" onClick={() => go(1)} disabled={currentIndex === images.length - 1} aria-label="Next picture">
              <ChevronRight size={22} strokeWidth={2.25} aria-hidden="true" />
            </button>
          </div>

          {/* Şəklin sözləri + danışıq qəlibləri. Öz içində sürüşür, yoxsa
              qəliblər açılanda şəkli ekrandan itələyirdi. */}
          <div className="pd-side">
            <div className="pd-words">
              <KeywordChips words={getVocabForImage(currentIndex)} label="Use these words" />
            </div>
            <DescribeFrames prompts={images[currentIndex]?.prompts || []} />
          </div>
        </div>
      )}
    </div>
  );
}
