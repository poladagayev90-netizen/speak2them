import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircleQuestion, BookOpen, Quote, Headphones, ChevronDown, X } from 'lucide-react';
import { getTodayIndex, getContentByIndex, weeklyContent } from '../data/weeklyContent';
import SpeakingCards from '../components/SpeakingCards';
import ChapterListeningView from '../components/ChapterListeningView';

export default function DailyHub() {
  const navigate = useNavigate();
  const [topicIndex, setTopicIndex] = useState(() => getTodayIndex());
  const content = getContentByIndex(topicIndex);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [activeTab, setActiveTab] = useState('story');
  const [difficulty, setDifficulty] = useState('easy');
  const [flipped, setFlipped] = useState({});

  const toggleFlip = (index) => {
    setFlipped(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="hub-page">
      <div className="hub-header">
        <button className="btn-back" onClick={() => navigate('/')}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary, #aaa)' }}>
              Day {content.day || (topicIndex + 1)} of {weeklyContent.length}
            </span>
            <button
              onClick={() => setShowTopicModal(true)}
              style={{
                background: 'rgba(124, 77, 255, 0.15)',
                border: '1px solid rgba(124, 77, 255, 0.4)',
                color: 'var(--accent, #b6a6ff)',
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              All Topics <ChevronDown size={14} />
            </button>
          </div>
          <h1 className="hub-topic" style={{ margin: 0 }}>{content.topic}</h1>
        </div>
      </div>

      {/* TOPIC PICKER MODAL (FOR TEACHERS & STUDENTS) */}
      {showTopicModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card, #1c1830)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 18,
            width: '100%',
            maxWidth: 480,
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#fff' }}>
                  Select Topic / Chapter
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary, #aaa)' }}>
                  Browse all 30 curriculum units freely
                </p>
              </div>
              <button
                onClick={() => setShowTopicModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '12px 16px', overflowY: 'auto', display: 'grid', gap: 6 }}>
              {weeklyContent.map((item, idx) => {
                const isSelected = idx === topicIndex;
                const isChapter13 = item.day === 13 || item.topic.includes('Hobbies');

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setTopicIndex(idx);
                      setShowTopicModal(false);
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: isSelected ? '1px solid var(--accent, #7c4dff)' : '1px solid rgba(255,255,255,0.06)',
                      background: isSelected ? 'rgba(124, 77, 255, 0.25)' : 'rgba(255,255,255,0.03)',
                      color: isSelected ? '#fff' : '#ccc',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #888)', marginRight: 8 }}>
                        DAY {item.day}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: isSelected ? 700 : 600 }}>
                        {item.topic}
                      </span>
                    </div>

                    {isChapter13 && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        background: 'var(--accent, #7c4dff)',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: 4,
                        textTransform: 'uppercase'
                      }}>
                        Listening Ready 🎧
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="hub-tabs">
        <button
          className={`hub-tab ${activeTab === 'story' ? 'active' : ''}`}
          onClick={() => setActiveTab('story')}
        >
          <Headphones size={16} strokeWidth={1.75} aria-hidden="true" /> Story 🎧
        </button>
        <button
          className={`hub-tab ${activeTab === 'questions' ? 'active' : ''}`}
          onClick={() => setActiveTab('questions')}
        >
          <MessageCircleQuestion size={16} strokeWidth={1.75} aria-hidden="true" /> Questions
        </button>
        <button
          className={`hub-tab ${activeTab === 'vocabulary' ? 'active' : ''}`}
          onClick={() => setActiveTab('vocabulary')}
        >
          <BookOpen size={16} strokeWidth={1.75} aria-hidden="true" /> Vocabulary
        </button>
        <button
          className={`hub-tab ${activeTab === 'idioms' ? 'active' : ''}`}
          onClick={() => setActiveTab('idioms')}
        >
          <Quote size={16} strokeWidth={1.75} aria-hidden="true" /> Idioms
        </button>
      </div>

      <div className="hub-body">
        {/* STORY / CHAPTER LISTENING */}
        {activeTab === 'story' && (
          <ChapterListeningView chapterKey={content.day === 13 ? 'chapter13' : 'chapter14'} />
        )}

        {/* QUESTIONS */}
        {activeTab === 'questions' && (
          <div>
            <div className="difficulty-toggle">
              <button
                className={`diff-btn ${difficulty === 'easy' ? 'active' : ''}`}
                onClick={() => setDifficulty('easy')}
              >
                Easy
              </button>
              <button
                className={`diff-btn ${difficulty === 'hard' ? 'active' : ''}`}
                onClick={() => setDifficulty('hard')}
              >
                Hard
              </button>
            </div>
            <SpeakingCards questions={content.questions[difficulty]} />
          </div>
        )}

        {/* VOCABULARY */}
        {activeTab === 'vocabulary' && (
          <div className="vocab-list">
            {content.vocabulary.map((v, i) => (
              <div
                key={i}
                className={`vocab-card ${flipped[i] ? 'flipped' : ''}`}
                onClick={() => toggleFlip(i)}
              >
                {!flipped[i] ? (
                  <div className="vocab-front">
                    <h3>{v.word}</h3>
                    <span className="tap-hint">Tap to see meaning</span>
                  </div>
                ) : (
                  <div className="vocab-back">
                    <p className="vocab-meaning">{v.meaning}</p>
                    <p className="vocab-example">"{v.example}"</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* IDIOMS */}
        {activeTab === 'idioms' && (
          <div className="idioms-list">
            {content.idioms.map((idiom, i) => (
              <div key={i} className="idiom-card">
                <h3>"{idiom.phrase}"</h3>
                <p className="idiom-meaning"> {idiom.meaning}</p>
                <p className="idiom-example"> "{idiom.example}"</p>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}