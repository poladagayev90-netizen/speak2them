import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { placementQuestions } from '../data/placementQuestions';

export default function PlacementTest({ user }) {
  const navigate = useNavigate();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const [finalLevel, setFinalLevel] = useState('');

  const currentUser = auth.currentUser || user;

  const handleAnswer = async (selectedIndex) => {
    const isCorrect = selectedIndex === placementQuestions[currentQuestionIndex].correct;
    const newScore = isCorrect ? score + 1 : score;
    setScore(newScore);

    if (currentQuestionIndex + 1 < placementQuestions.length) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Test finished
      let level = 'A1 – Beginner';
      if (newScore <= 2) level = 'A1 – Beginner';
      else if (newScore <= 5) level = 'A2 – Elementary';
      else if (newScore <= 10) level = 'B1 – Intermediate';
      else if (newScore <= 13) level = 'B2 – Upper-Intermediate';
      else level = 'C1 – Advanced';

      setFinalLevel(level);
      setFinished(true);
      await saveLevel(level);
    }
  };

  const saveLevel = async (level) => {
    if (!currentUser?.uid) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', currentUser.uid),
        { level, placementTestDone: true, placementScore: score, placementUpdatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error('Error saving placement level:', err);
    }
    setSaving(false);
  };

  const goBackToSurvey = () => {
    navigate('/survey');
  };

  const optionButtonStyle = {
    width: '100%',
    border: '1px solid #2e2e50',
    background: '#151520',
    color: '#d1d5db',
    padding: '16px 14px',
    borderRadius: '14px',
    fontSize: '15px',
    fontWeight: 500,
    textAlign: 'left',
    cursor: 'pointer',
    marginBottom: '10px',
    transition: 'background 0.2s',
  };

  if (finished) {
    return (
      <div className="auth-page" style={{ alignItems: 'center', padding: '40px 16px', justifyContent: 'center' }}>
        <div className="auth-card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <h2>🎉 Test Completed!</h2>
          <p className="auth-sub">Thank you for taking the placement test.</p>
          
          <div style={{ margin: '30px 0', padding: '20px', background: '#1a1a2e', borderRadius: '16px', border: '1px solid #2e2e50' }}>
            <p style={{ color: '#888', fontSize: '14px', marginBottom: '8px' }}>Your estimated level is:</p>
            <h3 style={{ color: '#7c6ff7', fontSize: '24px', margin: 0 }}>{finalLevel}</h3>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={goBackToSurvey}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Continue to Survey'}
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = placementQuestions[currentQuestionIndex];

  return (
    <div className="auth-page" style={{ alignItems: 'flex-start', padding: '40px 16px', overflowY: 'auto' }}>
      <div className="auth-card" style={{ margin: '0 auto', maxWidth: '400px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div className="auth-logo" style={{ marginBottom: 0 }}>🎙️ Placement Test</div>
          <span style={{ color: '#888', fontSize: '13px', fontWeight: 600 }}>
            {currentQuestionIndex + 1} / {placementQuestions.length}
          </span>
        </div>

        <div style={{ height: '4px', background: '#2e2e50', borderRadius: '2px', marginBottom: '30px', overflow: 'hidden' }}>
          <div style={{ 
            height: '100%', 
            background: '#7c6ff7', 
            width: `${((currentQuestionIndex) / placementQuestions.length) * 100}%`,
            transition: 'width 0.3s ease-out'
          }}></div>
        </div>

        <h3 style={{ fontSize: '18px', marginBottom: '24px', lineHeight: '1.4' }}>
          {currentQuestion.question}
        </h3>

        <div>
          {currentQuestion.options.map((option, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleAnswer(idx)}
              style={optionButtonStyle}
              onMouseOver={(e) => e.currentTarget.style.background = '#2e2e50'}
              onMouseOut={(e) => e.currentTarget.style.background = '#151520'}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
