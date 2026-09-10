import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, BookOpen, MessageSquare, 
  HelpCircle, ChevronRight, CheckCircle2, XCircle, Sparkles 
} from 'lucide-react';
import { chapterStories } from '../data/chapterStories';

export default function ChapterListeningView({ chapterKey = 'chapter14' }) {
  const [activeChapterKey, setActiveChapterKey] = useState(chapterKey || 'chapter14');

  useEffect(() => {
    if (chapterKey && chapterStories[chapterKey]) {
      setActiveChapterKey(chapterKey);
    }
  }, [chapterKey]);

  const story = chapterStories[activeChapterKey] || chapterStories.chapter14 || chapterStories.chapter13;
  const [selectedLevel, setSelectedLevel] = useState('a2');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [activeScene, setActiveScene] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [showExplanation, setShowExplanation] = useState({});

  const audioRef = useRef(null);
  const levelData = story.levels[selectedLevel];

  // Reset playback and quiz state on level or chapter change
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setActiveScene(0);
    setQuizAnswers({});
    setShowExplanation({});
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [activeChapterKey, selectedLevel]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn("Playback prevented or audio missing:", err);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || levelData.targetDurationSec);
    }
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleSpeedChange = (rate) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleAnswerSelect = (questionId, optionIdx, correctIdx) => {
    if (quizAnswers[questionId] !== undefined) return; // already answered
    setQuizAnswers(prev => ({ ...prev, [questionId]: optionIdx }));
    setShowExplanation(prev => ({ ...prev, [questionId]: true }));
  };

  const formatTime = (secs) => {
    if (!Number.isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="chapter-listening-container" style={{
      maxWidth: 680,
      margin: '0 auto',
      padding: '16px 12px 48px',
      color: 'var(--text-primary, #ffffff)'
    }}>
      {/* Hidden HTML5 Audio Element */}
      <audio
        ref={audioRef}
        src={levelData.audioSrc}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Chapter Switcher Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          onClick={() => setActiveChapterKey('chapter14')}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            border: activeChapterKey === 'chapter14' ? '1px solid var(--accent, #7c4dff)' : '1px solid rgba(255,255,255,0.1)',
            background: activeChapterKey === 'chapter14' ? 'rgba(124, 77, 255, 0.25)' : 'rgba(255,255,255,0.04)',
            color: activeChapterKey === 'chapter14' ? '#fff' : 'var(--text-secondary, #aaa)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'all 0.15s'
          }}
        >
          <span>👗 Chapter 14: Fashion</span>
        </button>
        <button
          onClick={() => setActiveChapterKey('chapter13')}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            border: activeChapterKey === 'chapter13' ? '1px solid var(--accent, #7c4dff)' : '1px solid rgba(255,255,255,0.1)',
            background: activeChapterKey === 'chapter13' ? 'rgba(124, 77, 255, 0.25)' : 'rgba(255,255,255,0.04)',
            color: activeChapterKey === 'chapter13' ? '#fff' : 'var(--text-secondary, #aaa)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'all 0.15s'
          }}
        >
          <span>🎨 Chapter 13: Hobbies</span>
        </button>
      </div>

      {/* Chapter Banner & Header */}
      <div style={{
        background: 'linear-gradient(145deg, rgba(58, 38, 92, 0.6) 0%, rgba(29, 21, 48, 0.8) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 'var(--r-xl, 16px)',
        padding: '20px 18px',
        marginBottom: 20,
        boxShadow: 'var(--glass-lift, 0 8px 24px rgba(0,0,0,0.3))'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            background: 'var(--accent, #7c4dff)',
            color: '#fff',
            padding: '2px 8px',
            borderRadius: 6
          }}>
            Chapter {story.chapterNumber}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary, #b3b3b3)' }}>
            {story.topicTitle}
          </span>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 8px', letterSpacing: '-0.02em' }}>
          {story.episodeTitle}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #ccc)', lineHeight: 1.45, margin: 0 }}>
          {story.synopsis}
        </p>
      </div>

      {/* 3-Level Selector Pills */}
      <div style={{
        display: 'flex',
        gap: 8,
        background: 'rgba(255, 255, 255, 0.05)',
        padding: 4,
        borderRadius: 12,
        marginBottom: 20
      }}>
        {[
          { key: 'a2', label: 'Weak A2', badge: '~75s' },
          { key: 'b1', label: 'B1 Dialogue', badge: '~90s' },
          { key: 'b2', label: 'B2 Wit & Irony', badge: '~105s' }
        ].map(item => (
          <button
            key={item.key}
            onClick={() => setSelectedLevel(item.key)}
            style={{
              flex: 1,
              padding: '10px 8px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              transition: 'all 0.2s',
              background: selectedLevel === item.key ? 'var(--accent, #7c4dff)' : 'transparent',
              color: selectedLevel === item.key ? '#fff' : 'var(--text-secondary, #aaa)'
            }}
          >
            <span>{item.label}</span>
            <span style={{ fontSize: 11, opacity: 0.8, fontWeight: 500 }}>{item.badge}</span>
          </button>
        ))}
      </div>

      {/* Storyboard Visual Scene Preview */}
      <div style={{
        background: 'rgba(20, 16, 32, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 'var(--r-xl, 16px)',
        padding: '16px',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={16} color="var(--accent, #b6a6ff)" />
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Scene {activeScene + 1} of {story.scenes.length}: {story.scenes[activeScene].title}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {story.scenes.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveScene(i)}
                style={{
                  width: 22,
                  height: 6,
                  borderRadius: 3,
                  border: 'none',
                  background: activeScene === i ? 'var(--accent, #7c4dff)' : 'rgba(255,255,255,0.2)',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>
        </div>

        {/* Scene Card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(82, 45, 128, 0.25) 0%, rgba(35, 25, 58, 0.5) 100%)',
          borderRadius: 12,
          padding: '12px',
          textAlign: 'center',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          marginBottom: 10,
          overflow: 'hidden'
        }}>
          {story.scenes[activeScene].imageSrc ? (
            <img 
              src={story.scenes[activeScene].imageSrc} 
              alt={story.scenes[activeScene].title}
              style={{
                width: '100%',
                maxHeight: 280,
                objectFit: 'cover',
                borderRadius: 8,
                marginBottom: 10,
                display: 'block'
              }}
            />
          ) : (
            <div style={{ fontSize: 36, margin: '16px 0 8px' }}>
              {activeScene === 0 ? '🛋️ 📱' : activeScene === 1 ? '📅 🤨' : activeScene === 2 ? '🏺 💥' : '☕ 😆'}
            </div>
          )}
          <p style={{ fontSize: 14, fontWeight: 600, color: '#f0eaff', margin: '0 0 4px' }}>
            "{story.scenes[activeScene].caption}"
          </p>
          <span style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>
            Protagonist: {story.protagonist} • Supporting: {story.sideCharacters.join(', ')}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setActiveScene((activeScene + 1) % story.scenes.length)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent, #b6a6ff)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            Next Scene <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Audio Player Card */}
      <div style={{
        background: 'linear-gradient(160deg, #241e48 0%, #1e1940 55%, #171331 100%)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 16,
        padding: '18px',
        marginBottom: 24,
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)'
      }}>
        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)', minWidth: 32 }}>
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={duration || levelData.targetDurationSec}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            style={{
              flex: 1,
              accentColor: 'var(--accent, #7c4dff)',
              cursor: 'pointer'
            }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)', minWidth: 32 }}>
            {formatTime(duration || levelData.targetDurationSec)}
          </span>
        </div>

        {/* Player controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Speed controls */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[0.8, 1.0, 1.2].map(rate => (
              <button
                key={rate}
                onClick={() => handleSpeedChange(rate)}
                style={{
                  background: playbackRate === rate ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                  border: 'none',
                  borderRadius: 6,
                  color: playbackRate === rate ? '#fff' : 'var(--text-secondary, #aaa)',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 8px',
                  cursor: 'pointer'
                }}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Main Play / Pause Button */}
          <button
            onClick={togglePlay}
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: 'var(--accent, #7c4dff)',
              border: 'none',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(124, 77, 255, 0.4)'
            }}
          >
            {isPlaying ? <Pause size={24} fill="#fff" /> : <Play size={24} fill="#fff" style={{ marginLeft: 3 }} />}
          </button>

          {/* Transcript toggle */}
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            style={{
              background: showTranscript ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer'
            }}
          >
            <BookOpen size={14} />
            {showTranscript ? 'Hide Text' : 'Read Text'}
          </button>
        </div>

        {/* Expandable Transcript */}
        {showTranscript && (
          <div style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: '1px solid rgba(255,255,255,0.1)',
            fontSize: 14,
            lineHeight: 1.65,
            color: '#e2dcf5',
            whiteSpace: 'pre-line'
          }}>
            {levelData.script}
          </div>
        )}
      </div>

      {/* Golden Chunks Section */}
      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={16} color="var(--accent, #7c4dff)" /> Golden Chunks to Learn ({levelData.goldenChunks.length})
        </h3>
        <div style={{ display: 'grid', gap: 10 }}>
          {levelData.goldenChunks.map((chunk, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 12,
                padding: '12px 14px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent, #b6a6ff)' }}>
                  {chunk.chunk}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)' }}>
                  {chunk.meaningAZ}
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#ccc', margin: '0 0 4px', lineHeight: 1.4 }}>
                {chunk.definition}
              </p>
              <p style={{ fontSize: 12, fontStyle: 'italic', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                "{chunk.example}"
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Comprehension Quiz */}
      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <HelpCircle size={16} color="var(--accent, #7c4dff)" /> Comprehension Check
        </h3>
        <div style={{ display: 'grid', gap: 14 }}>
          {levelData.comprehensionQuestions.map((q, qIdx) => {
            const userAnswer = quizAnswers[q.id];
            const isAnswered = userAnswer !== undefined;

            return (
              <div
                key={q.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '14px'
                }}
              >
                <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px', color: '#fff' }}>
                  {qIdx + 1}. {q.question}
                </p>

                <div style={{ display: 'grid', gap: 6 }}>
                  {q.options.map((opt, optIdx) => {
                    const isSelected = userAnswer === optIdx;
                    const isCorrect = optIdx === q.correctIndex;

                    let btnStyle = {
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: 8,
                      fontSize: 13,
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.05)',
                      color: '#ddd',
                      cursor: isAnswered ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    };

                    if (isAnswered) {
                      if (isCorrect) {
                        btnStyle.background = 'rgba(76, 175, 80, 0.2)';
                        btnStyle.border = '1px solid #4caf50';
                        btnStyle.color = '#a5d6a7';
                      } else if (isSelected) {
                        btnStyle.background = 'rgba(244, 67, 54, 0.2)';
                        btnStyle.border = '1px solid #f44336';
                        btnStyle.color = '#ef9a9a';
                      }
                    }

                    return (
                      <button
                        key={optIdx}
                        disabled={isAnswered}
                        onClick={() => handleAnswerSelect(q.id, optIdx, q.correctIndex)}
                        style={btnStyle}
                      >
                        <span>{opt}</span>
                        {isAnswered && isCorrect && <CheckCircle2 size={16} color="#4caf50" />}
                        {isAnswered && isSelected && !isCorrect && <XCircle size={16} color="#f44336" />}
                      </button>
                    );
                  })}
                </div>

                {showExplanation[q.id] && (
                  <p style={{
                    fontSize: 12,
                    color: '#c5cae9',
                    marginTop: 8,
                    marginBottom: 0,
                    padding: '6px 10px',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 6
                  }}>
                    💡 {q.explanation}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Speaking Mission Card (Dərsdə Müəllimlə / Partnyorla Danışıq) */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(82, 45, 128, 0.3) 0%, rgba(45, 27, 85, 0.6) 100%)',
        border: '1px solid var(--accent, #7c4dff)',
        borderRadius: 16,
        padding: '18px',
        boxShadow: '0 8px 20px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <MessageSquare size={18} color="var(--accent, #b6a6ff)" />
          <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#fff' }}>
            Live Speaking Mission
          </span>
        </div>

        <h4 style={{ fontSize: 16, fontWeight: 700, color: '#f3e8ff', margin: '0 0 6px' }}>
          {levelData.speakingMission.title}
        </h4>
        <p style={{ fontSize: 13, color: '#d1c4e9', margin: '0 0 12px', lineHeight: 1.4 }}>
          {levelData.speakingMission.context}
        </p>

        <div style={{
          background: 'rgba(0, 0, 0, 0.25)',
          borderRadius: 10,
          padding: '12px',
          marginBottom: 12
        }}>
          <p style={{ fontSize: 13, margin: '0 0 6px', color: '#fff' }}>
            <strong>Your Role:</strong> {levelData.speakingMission.roles.student}
          </p>
          <p style={{ fontSize: 13, margin: 0, color: '#bbb' }}>
            <strong>Teacher / Partner:</strong> {levelData.speakingMission.roles.partner}
          </p>
        </div>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          alignItems: 'center'
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #aaa)' }}>
            Must use:
          </span>
          {levelData.speakingMission.mandatoryChunks.map((chunk, i) => (
            <span
              key={i}
              style={{
                fontSize: 11,
                fontWeight: 600,
                background: 'rgba(124, 77, 255, 0.3)',
                color: '#e0d4fc',
                padding: '2px 8px',
                borderRadius: 4,
                border: '1px solid rgba(124, 77, 255, 0.4)'
              }}
            >
              {chunk}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
