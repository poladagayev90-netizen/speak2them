import React, { useState, useEffect } from 'react';
import { X, BookMarked } from 'lucide-react';
import { subscribeToWordHistory, deleteWordFromHistory } from '../utils/wordHistory';

export default function WordHistoryPanel({ userId, onClose }) {
  const [words, setWords] = useState([]);
  const [flipped, setFlipped] = useState({});

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToWordHistory(userId, setWords);
    return unsub;
  }, [userId]);

  const groupedWords = words.reduce((acc, w) => {
    const t = w.topic || 'General';
    if (!acc[t]) acc[t] = [];
    acc[t].push(w);
    return acc;
  }, {});

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg-primary)',
      zIndex: 9999, overflowY: 'auto', padding: '20px 16px 40px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{
          color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, margin: 0,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <BookMarked size={18} strokeWidth={1.75} aria-hidden="true" /> My words
        </h3>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none',
          color: 'var(--text-secondary)', fontSize: 22, cursor: 'pointer'
        }}><X size={20} strokeWidth={1.75} /></button>
      </div>

      {words.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 60 }}>
          <div style={{ marginBottom: 12, color: 'var(--text-muted)' }}><BookMarked size={40} strokeWidth={1.5} /></div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            No words saved yet.<br/>
            Use the translate button during a call.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {Object.entries(groupedWords).map(([topicName, topicWords]) => (
            <div key={topicName}>
              <h4 style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px 4px' }}>
                📌 {topicName}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topicWords.map(w => (
                  <div
                    key={w.id}
                    onClick={() => setFlipped(p => ({ ...p, [w.id]: !p[w.id] }))}
                    style={{
                      background: 'var(--bg-card)', borderRadius: 14,
                      padding: '16px 18px', border: '1px solid var(--border)',
                      cursor: 'pointer', position: 'relative'
                    }}
                  >
                    {!flipped[w.id] ? (
                      <div>
                        <p style={{ color: 'var(--text-primary)', fontSize: 17, fontWeight: 700, margin: 0 }}>
                          {w.original}
                        </p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, marginTop: 6 }}>
                          Tap to see the translation
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p style={{ color: 'var(--accent)', fontSize: 17, fontWeight: 700, margin: 0 }}>
                          {w.translated}
                        </p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                          {w.original}
                        </p>
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteWordFromHistory(userId, w.id); }}
                      style={{
                        position: 'absolute', top: 12, right: 12,
                        background: 'transparent', border: 'none',
                        color: 'var(--text-secondary)', fontSize: 16, cursor: 'pointer'
                      }}
                    ></button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
