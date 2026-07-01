import React, { useState, useEffect } from 'react';
import { X, BookOpen, MessageCircle, Lightbulb, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { getTodayContent } from '../data/weeklyContent';

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function DailyQuiz({ content, onFinish }) {
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (!content) return;
    
    const quiz = [];
    
    // Vocab questions (3 questions)
    const shuffledVocab = shuffle(content.vocabulary || []);
    const vocabCount = Math.min(3, shuffledVocab.length);
    
    for (let i = 0; i < vocabCount; i++) {
      const target = shuffledVocab[i];
      const otherMeanings = content.vocabulary.filter(v => v.word !== target.word).map(v => v.meaning);
      const options = shuffle([
        { text: target.meaning, isCorrect: true },
        ...shuffle(otherMeanings).slice(0, 3).map(m => ({ text: m, isCorrect: false }))
      ]);
      quiz.push({
        qText: `"${target.word}" sözünün mənası aşağıdakılardan hansıdır?`,
        options,
      });
    }

    // Idiom questions (2 questions)
    const shuffledIdioms = shuffle(content.idioms || []);
    const idiomCount = Math.min(2, shuffledIdioms.length);
    
    for (let i = 0; i < idiomCount; i++) {
      const target = shuffledIdioms[i];
      const otherPhrases = content.idioms.filter(v => v.phrase !== target.phrase).map(v => v.phrase);
      
      const options = shuffle([
        { text: target.phrase, isCorrect: true },
        ...shuffle(otherPhrases).slice(0, 3).map(m => ({ text: m, isCorrect: false }))
      ]);
      quiz.push({
        qText: `Aşağıdakı ifadələrdən hansı "${target.meaning}" mənasına gəlir?`,
        options,
      });
    }
    
    setQuestions(shuffle(quiz));
    setCurrentQ(0);
    setScore(0);
    setSelected(null);
    setIsFinished(false);
  }, [content]);

  if (questions.length === 0) return <p style={{textAlign:'center', color:'#888', marginTop:20}}>Yüklənir...</p>;

  if (isFinished) {
    return (
      <div className="dt-quiz-result">
        <h3>Nəticə</h3>
        <div className="dt-score">{score} / {questions.length}</div>
        <p>{score === questions.length ? 'Möhtəşəm! Tamamilə hazırsınız! 🎉' : 'Bir az daha təkrar edin! 💪'}</p>
        <button className="dt-quiz-next" onClick={onFinish} style={{ width: '100%', marginTop: '20px' }}>
          Mövzuya Qayıt
        </button>
      </div>
    );
  }

  const q = questions[currentQ];

  const handleSelect = (idx, isCorrect) => {
    if (selected !== null) return;
    setSelected(idx);
    if (isCorrect) setScore(s => s + 1);
  };

  const handleNext = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(q => q + 1);
      setSelected(null);
    } else {
      setIsFinished(true);
    }
  };

  return (
    <div className="dt-quiz-container">
      <div className="dt-quiz-header">
        <span>Sual {currentQ + 1}/{questions.length}</span>
        <span>Xal: {score}</span>
      </div>
      <h3 className="dt-quiz-q">{q.qText}</h3>
      <div className="dt-quiz-options">
        {q.options.map((opt, i) => {
          let statusClass = '';
          if (selected !== null) {
            if (opt.isCorrect) statusClass = 'correct';
            else if (selected === i) statusClass = 'wrong';
          }
          return (
            <button 
              key={i} 
              className={`dt-quiz-opt ${statusClass} ${selected !== null ? 'disabled' : ''}`}
              onClick={() => handleSelect(i, opt.isCorrect)}
            >
              {opt.text}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <button className="dt-quiz-next" onClick={handleNext}>
          {currentQ < questions.length - 1 ? 'Növbəti' : 'Nəticəni Gör'}
        </button>
      )}
    </div>
  );
}

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
            <BookOpen size={14} /> Sözlər
          </button>
          <button
            className={`dt-tab ${activeSection === 'idioms' ? 'active' : ''}`}
            onClick={() => setActiveSection('idioms')}
          >
            <Lightbulb size={14} /> İdiomlar
          </button>
          <button
            className={`dt-tab ${activeSection === 'questions' ? 'active' : ''}`}
            onClick={() => setActiveSection('questions')}
          >
            <MessageCircle size={14} /> Suallar
          </button>
          <button
            className={`dt-tab ${activeSection === 'quiz' ? 'active' : ''}`}
            onClick={() => setActiveSection('quiz')}
          >
            <Brain size={14} /> Sınaq
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
                  🟢 Asan
                </button>
                <button
                  className={`dt-diff-btn ${difficulty === 'hard' ? 'active' : ''}`}
                  onClick={() => setDifficulty('hard')}
                >
                  🔴 Çətin
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

          {activeSection === 'quiz' && (
            <div className="dt-section">
              <DailyQuiz content={content} onFinish={() => setActiveSection('vocabulary')} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
