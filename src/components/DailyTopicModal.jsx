import React, { useState, useEffect } from 'react';
import { X, BookOpen, MessageCircle, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { weeklyContent, getTodayContent } from '../data/weeklyContent';

export default function DailyTopicModal({ open, onClose }) {
  const [content, setContent] = useState(null);
  const [activeSection, setActiveSection] = useState('vocabulary');
  const [difficulty, setDifficulty] = useState('easy');
  const [expandedVocab, setExpandedVocab] = useState(null);

  useEffect(() => {
    if (open) {
      setContent(getTodayContent());
      setActiveSection('vocabulary');
      setExpandedVocab(null);
    }
  }, [open]);

  if (!open || !content) return null;

  return (
    <div className="dt-overlay" onClick={onClose}>
      <div className="dt-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="dt-header">
          <div className="dt-header-info">
            <span className="dt-badge">Day {content.day}</span>
            <h2 className="dt-title">{content.topic}</h2>
          </div>
          <button className="dt-close" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="dt-tabs">
          <button
            className={`dt-tab ${activeSection === 'vocabulary' ? 'active' : ''}`}
            onClick={() => setActiveSection('vocabulary')}
          >
            <BookOpen size={14} /> Vocabulary
          </button>
          <button
            className={`dt-tab ${activeSection === 'idioms' ? 'active' : ''}`}
            onClick={() => setActiveSection('idioms')}
          >
            <Lightbulb size={14} /> Idioms
          </button>
          <button
            className={`dt-tab ${activeSection === 'questions' ? 'active' : ''}`}
            onClick={() => setActiveSection('questions')}
          >
            <MessageCircle size={14} /> Questions
          </button>
        </div>

        {/* Content Area */}
        <div className="dt-content">

          {activeSection === 'vocabulary' && (
            <div className="dt-section">
              {content.vocabulary.map((v, i) => (
                <div
                  key={i}
                  className={`dt-vocab-card ${expandedVocab === i ? 'expanded' : ''}`}
                  onClick={() => setExpandedVocab(expandedVocab === i ? null : i)}
                >
                  <div className="dt-vocab-row">
                    <span className="dt-vocab-word">{v.word}</span>
                    {expandedVocab === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                  <p className="dt-vocab-meaning">{v.meaning}</p>
                  {expandedVocab === i && (
                    <p className="dt-vocab-example">"{v.example}"</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeSection === 'idioms' && (
            <div className="dt-section">
              {content.idioms.map((idm, i) => (
                <div key={i} className="dt-idiom-card">
                  <p className="dt-idiom-phrase">"{idm.phrase}"</p>
                  <p className="dt-idiom-meaning">{idm.meaning}</p>
                  <p className="dt-idiom-example">💬 {idm.example}</p>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'questions' && (
            <div className="dt-section">
              <div className="dt-diff-toggle">
                <button
                  className={`dt-diff-btn ${difficulty === 'easy' ? 'active' : ''}`}
                  onClick={() => setDifficulty('easy')}
                >
                  🟢 Easy
                </button>
                <button
                  className={`dt-diff-btn ${difficulty === 'hard' ? 'active' : ''}`}
                  onClick={() => setDifficulty('hard')}
                >
                  🔴 Hard
                </button>
              </div>
              <div className="dt-questions-list">
                {content.questions[difficulty].map((q, i) => (
                  <div key={i} className="dt-question-card">
                    <span className="dt-q-num">{i + 1}</span>
                    <p className="dt-q-text">{q}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
