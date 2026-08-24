import React, { useState, useEffect } from 'react';
import { generateQuizFromWords } from '../utils/aiQuizGenerator';

export default function PostCallQuizModal({ words, onClose }) {
  const [quizData, setQuizData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (!words || words.length === 0) {
      onClose();
      return;
    }
    
    generateQuizFromWords(words).then(res => {
      if (res && res.error) {
        setErrorMsg(res.error);
        setLoading(false);
      } else if (!res || !Array.isArray(res) || res.length === 0) {
        setErrorMsg('AInur could not build a question this time.');
        setLoading(false);
      } else {
        setQuizData(res);
        setLoading(false);
      }
    });
  }, [words, onClose]);

  if (loading) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <div className="spinner" style={{ margin: '0 auto 20px', borderTopColor: 'var(--accent)' }}></div>
          <h3 style={{ color: 'var(--text-primary)' }}>Building your quiz...</h3>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: 14 }}>A short quiz from the words you looked up during the conversation.</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <h3 style={{ color: 'var(--danger)', marginBottom: 10 }}>Something went wrong</h3>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: 14, marginBottom: 20 }}>{errorMsg}</p>
          <button style={btnStyle} onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  if (showResult) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <h2 style={{ fontSize: 48, marginBottom: 10 }}>{score === quizData.length ? '' : ''}</h2>
          <h3 style={{ color: 'var(--text-primary)', fontSize: 24, marginBottom: 10 }}>Your result</h3>
          <p style={{ color: 'var(--success)', fontSize: 20, fontWeight: 'bold', margin: '0 0 20px' }}>
            {score} / {quizData.length} Correct
          </p>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: 14, marginBottom: 30 }}>
            Practising the words you looked up helps you remember them.
          </p>
          <button style={btnStyle} onClick={onClose}>Great, let us continue</button>
        </div>
      </div>
    );
  }

  const q = quizData[currentQ];

  const handleSelect = (idx) => {
    if (selected !== null) return;
    setSelected(idx);
    if (idx === q.correctIdx) {
      setScore(s => s + 1);
    }
  };

  const handleNext = () => {
    if (currentQ < quizData.length - 1) {
      setCurrentQ(c => c + 1);
      setSelected(null);
    } else {
      setShowResult(true);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={{...modalStyle, textAlign: 'left', padding: '24px'}}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 14, marginBottom: 20 }}>
          <span style={{ fontWeight: 'bold', color: 'var(--accent)' }}>Quiz</span>
          <span>Sual {currentQ + 1}/{quizData.length}</span>
        </div>
        
        <h3 style={{ color: 'var(--text-primary)', fontSize: 20, lineHeight: 1.4, marginBottom: 24, textAlign: 'center' }}>
          {q.qText}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {q.options.map((opt, i) => {
            let bg = 'var(--bg-card)';
            let border = '2px solid var(--bg-secondary)';
            let color = '#fff';

            if (selected !== null) {
              if (i === q.correctIdx) {
                bg = 'var(--success-bg)';
                border = '2px solid var(--success)';
                color = 'var(--success-fg)';
              } else if (i === selected) {
                bg = 'var(--danger-bg)';
                border = '2px solid var(--danger)';
                color = 'var(--danger-fg)';
              }
            }

            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                style={{
                  padding: 16, borderRadius: 16, background: bg, border: border, color: color,
                  fontSize: 16, fontWeight: 600, textAlign: 'left', cursor: selected === null ? 'pointer' : 'default',
                  transition: 'all 0.2s'
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {selected !== null && (
          <button style={btnStyle} onClick={handleNext}>
            {currentQ < quizData.length - 1 ? 'Next question' : 'See result'}
          </button>
        )}
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
  background: 'var(--overlay)', backdropFilter: 'blur(8px)',
  zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20
};

const modalStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--accent-ring)',
  borderRadius: 24, width: '100%', maxWidth: 400,
  padding: '40px 24px', textAlign: 'center',
  boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
};

const btnStyle = {
  width: '100%', padding: 16, borderRadius: 16, border: 'none',
  background: 'var(--accent)',
  color: 'var(--text-on-accent)', fontSize: 16, fontWeight: 'bold', cursor: 'pointer',
};
