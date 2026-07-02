import React, { useState, useEffect } from 'react';
import { subscribeToWordHistory, deleteWordFromHistory } from '../utils/wordHistory';

export default function WordHistoryPanel({ userId, onClose }) {
  const [words, setWords] = useState([]);
  const [flipped, setFlipped] = useState({});

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToWordHistory(userId, setWords);
    return unsub;
  }, [userId]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg-primary)',
      zIndex: 9999, overflowY: 'auto', padding: '20px 16px 40px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, margin: 0 }}>
          📚 Mənim Sözlərim
        </h3>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none',
          color: 'var(--text-secondary)', fontSize: 22, cursor: 'pointer'
        }}>✕</button>
      </div>

      {words.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📖</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Hələ heç bir söz yadda saxlanmayıb.<br/>
            Zəng zamanı tərcümə düyməsini istifadə et!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {words.map(w => (
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
                  <p style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 6 }}>
                    Toxun — tərcüməni gör
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ color: '#7c6ff7', fontSize: 17, fontWeight: 700, margin: 0 }}>
                    {w.translated}
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>
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
              >🗑️</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
