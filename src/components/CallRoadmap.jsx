import React from 'react';

// Conversation roadmap shown to both peers the moment a call connects, so
// nobody sits in silence wondering what to talk about. Content comes from the
// shared daily topic (deterministic on both sides), and the 📅 panel carries
// the full question/vocab set for anyone who wants more.
export default function CallRoadmap({ content, onStart, onOpenDaily }) {
  if (!content) return null;

  return (
    <div className="call-roadmap">
      <div className="call-roadmap-card">
        <p className="call-roadmap-label">🗺️ Bugünün mövzusu</p>
        <h2 className="call-roadmap-topic">{content.topic}</h2>

        <p className="call-roadmap-section">Bu suallarla başlayın:</p>
        {content.questions.easy.slice(0, 3).map((q, i) => (
          <div key={i} className="question-card" style={{ marginBottom: 8, textAlign: 'left' }}>
            <span className="question-number">{i + 1}</span>
            <p>{q}</p>
          </div>
        ))}

        <p className="call-roadmap-section">Bu sözləri işlətməyə çalışın:</p>
        <div className="call-roadmap-chips">
          {content.vocabulary.slice(0, 4).map((v, i) => (
            <span key={i} className="call-roadmap-chip">{v.word}</span>
          ))}
        </div>

        <button className="call-roadmap-start" onClick={onStart}>Başla 🎙️</button>
        <button className="call-roadmap-more" onClick={onOpenDaily}>
          Daha çox sual və söz üçün 📅 panelini aç
        </button>
      </div>
    </div>
  );
}
