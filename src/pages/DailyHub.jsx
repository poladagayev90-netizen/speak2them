import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTodayContent } from '../dailyContent';

export default function DailyHub() {
  const navigate = useNavigate();
  const content = getTodayContent();
  const [activeTab, setActiveTab] = useState('questions');
  const [difficulty, setDifficulty] = useState('easy');
  const [flipped, setFlipped] = useState({});

  const toggleFlip = (index) => {
    setFlipped(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="hub-page">
      <div className="hub-header">
        <button className="btn-back" onClick={() => navigate('/')}>← Back</button>
        <div>
          <h2>📅 Today's Topic</h2>
          <h1 className="hub-topic">{content.topic}</h1>
        </div>
      </div>

      <div className="hub-tabs">
        <button
          className={`hub-tab ${activeTab === 'questions' ? 'active' : ''}`}
          onClick={() => setActiveTab('questions')}
        >
          🗣️ Questions
        </button>
        <button
          className={`hub-tab ${activeTab === 'vocabulary' ? 'active' : ''}`}
          onClick={() => setActiveTab('vocabulary')}
        >
          📚 Vocabulary
        </button>
        <button
          className={`hub-tab ${activeTab === 'idioms' ? 'active' : ''}`}
          onClick={() => setActiveTab('idioms')}
        >
          💬 Idioms
        </button>
      </div>

      <div className="hub-body">

        {/* QUESTIONS */}
        {activeTab === 'questions' && (
          <div>
            <div className="difficulty-toggle">
              <button
                className={`diff-btn ${difficulty === 'easy' ? 'active' : ''}`}
                onClick={() => setDifficulty('easy')}
              >
                🟢 Easy (Type A)
              </button>
              <button
                className={`diff-btn ${difficulty === 'hard' ? 'active' : ''}`}
                onClick={() => setDifficulty('hard')}
              >
                🔴 Hard (Type B)
              </button>
            </div>
            <div className="questions-list">
              {content.questions[difficulty].map((q, i) => (
                <div key={i} className="question-card">
                  <span className="question-number">{i + 1}</span>
                  <p>{q}</p>
                </div>
              ))}
            </div>
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
                <p className="idiom-meaning">📌 {idiom.meaning}</p>
                <p className="idiom-example">💡 "{idiom.example}"</p>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}