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
        setErrorMsg('Süni intellekt uyğun sual hazırlaya bilmədi.');
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
          <div className="spinner" style={{ margin: '0 auto 20px', borderTopColor: '#7c6ff7' }}></div>
          <h3 style={{ color: '#fff' }}>Süni İntellekt Sınaq Hazırlayır...</h3>
          <p style={{ color: '#a0a0b8', fontSize: 14 }}>Söhbət zamanı öyrəndiyiniz sözlərdən ibarət kiçik sınaq yaradılır.</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <h3 style={{ color: '#ff4757', marginBottom: 10 }}>Xəta Baş Verdi</h3>
          <p style={{ color: '#a0a0b8', fontSize: 14, marginBottom: 20 }}>{errorMsg}</p>
          <button style={btnStyle} onClick={onClose}>Bağla</button>
        </div>
      </div>
    );
  }

  if (showResult) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <h2 style={{ fontSize: 48, marginBottom: 10 }}>{score === quizData.length ? '🏆' : '👏'}</h2>
          <h3 style={{ color: '#fff', fontSize: 24, marginBottom: 10 }}>Nəticəniz</h3>
          <p style={{ color: '#2ed573', fontSize: 20, fontWeight: 'bold', margin: '0 0 20px' }}>
            {score} / {quizData.length} Düzgün
          </p>
          <p style={{ color: '#a0a0b8', fontSize: 14, marginBottom: 30 }}>
            Tərcümə edib öyrəndiyiniz sözləri praktika etmək yadda saxlamağınıza kömək edir!
          </p>
          <button style={btnStyle} onClick={onClose}>Əla, davam edək</button>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a0a0b8', fontSize: 14, marginBottom: 20 }}>
          <span style={{ fontWeight: 'bold', color: '#7c6ff7' }}>AI Sınağı</span>
          <span>Sual {currentQ + 1}/{quizData.length}</span>
        </div>
        
        <h3 style={{ color: '#fff', fontSize: 20, lineHeight: 1.4, marginBottom: 24, textAlign: 'center' }}>
          {q.qText}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {q.options.map((opt, i) => {
            let bg = '#1a1a2e';
            let border = '2px solid #2e2e50';
            let color = '#fff';

            if (selected !== null) {
              if (i === q.correctIdx) {
                bg = 'rgba(46, 213, 115, 0.15)';
                border = '2px solid #2ed573';
                color = '#2ed573';
              } else if (i === selected) {
                bg = 'rgba(255, 71, 87, 0.15)';
                border = '2px solid #ff4757';
                color = '#ff4757';
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
            {currentQ < quizData.length - 1 ? 'Növbəti Sual' : 'Nəticəni Gör'}
          </button>
        )}
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
  background: 'rgba(10, 10, 20, 0.85)', backdropFilter: 'blur(8px)',
  zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20
};

const modalStyle = {
  background: 'linear-gradient(145deg, #1e1e30, #141420)',
  border: '1px solid rgba(124, 111, 247, 0.3)',
  borderRadius: 24, width: '100%', maxWidth: 400,
  padding: '40px 24px', textAlign: 'center',
  boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
};

const btnStyle = {
  width: '100%', padding: 16, borderRadius: 16, border: 'none',
  background: 'linear-gradient(135deg, #7c6ff7, #5a4de3)',
  color: '#fff', fontSize: 16, fontWeight: 'bold', cursor: 'pointer',
  boxShadow: '0 8px 20px rgba(124, 111, 247, 0.3)'
};
