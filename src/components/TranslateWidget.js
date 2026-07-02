import React, { useState } from 'react';
import { translateText } from '../utils/translate';
import { saveWordToHistory } from '../utils/wordHistory';

export default function TranslateWidget({ userId, topic }) {
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleTranslate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setSaved(false);
    const translated = await translateText(input.trim(), 'az', 'en');
    setLoading(false);
    if (translated) {
      setResult(translated);
      saveWordToHistory(userId, input.trim(), translated, topic);
      setSaved(true);
    } else {
      setResult('Tərcümə alınmadı');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleTranslate();
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{
          position: 'fixed', bottom: 140, right: 16,
          width: 52, height: 52, borderRadius: '50%',
          background: 'linear-gradient(135deg, #7c6ff7, #5b4de8)',
          border: 'none', color: '#fff', fontSize: 22,
          cursor: 'pointer', zIndex: 10005,
          boxShadow: '0 4px 12px rgba(124,111,247,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >
        🌐
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 140, left: 16, right: 16,
      maxWidth: 400, margin: '0 auto',
      background: '#1e1e30', border: '1px solid #7c6ff7',
      borderRadius: 16, padding: 14, zIndex: 10005,
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={{ color: '#7c6ff7', fontSize: 13, fontWeight: 700, margin: 0 }}>
          🌐 Tərcümə (AZ → EN)
        </p>
        <button
          onClick={() => setExpanded(false)}
          style={{ background: 'transparent', border: 'none', color: '#aaa', fontSize: 18, cursor: 'pointer' }}
        >✕</button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Sözü yazın..."
          autoFocus
          style={{
            flex: 1, padding: '10px 12px', borderRadius: 10,
            border: '1px solid #2e2e50', background: '#141420',
            color: '#fff', fontSize: 14, outline: 'none'
          }}
        />
        <button
          onClick={handleTranslate}
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 16px', borderRadius: 10, border: 'none',
            background: loading ? '#2e2e50' : '#7c6ff7',
            color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '...' : '→'}
        </button>
      </div>

      {result && (
        <div style={{
          marginTop: 10, padding: '10px 12px',
          background: '#141420', borderRadius: 10,
          border: '1px solid #2e2e50'
        }}>
          <p style={{ color: '#fff', fontSize: 15, fontWeight: 600, margin: 0 }}>{result}</p>
          {saved && (
            <p style={{ color: '#16a34a', fontSize: 11, margin: '4px 0 0' }}>✓ Yadda saxlanıldı</p>
          )}
        </div>
      )}
    </div>
  );
}
