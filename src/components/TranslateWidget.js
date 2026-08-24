import React, { useState } from 'react';
import { translateText } from '../utils/translate';
import { saveWordToHistory } from '../utils/wordHistory';

export default function TranslateWidget({ userId, topic, onTranslate, nativeLanguage = 'az' }) {
  // The UI is English, but the translation TARGET is the learner's own
  // language -- that is the whole point of the widget. It follows the same
  // preferredLanguage setting that decides the report language.
  const nativeLang = nativeLanguage === 'tr' ? 'tr' : 'az';
  const nativeLabel = nativeLang.toUpperCase();
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleTranslate = async () => {
    if (!input.trim()) return;
    
    // MVP Limit: 10 translations per day
    const todayStr = new Date().toISOString().split('T')[0];
    let usedTranslations = parseInt(localStorage.getItem('translate_used') || '0', 10);
    const lastTranslateDate = localStorage.getItem('translate_date');
    if (lastTranslateDate !== todayStr) {
      usedTranslations = 0;
      localStorage.setItem('translate_date', todayStr);
    }
    
    if (usedTranslations >= 10) {
      alert("You have used today’s 10 translations. More tomorrow.");
      return;
    }

    setLoading(true);
    setSaved(false);
    const translated = await translateText(input.trim(), nativeLang, 'en');
    setLoading(false);
    if (translated) {
      localStorage.setItem('translate_used', (usedTranslations + 1).toString());
      setResult(translated);
      saveWordToHistory(userId, input.trim(), translated, topic);
      if (onTranslate) onTranslate({ original: input.trim(), translated });
      setSaved(true);
    } else {
      setResult('Translation failed');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleTranslate();
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        // Anchored to the TOP right, not the bottom. This widget only ever
        // renders during a call, and bottom:140 is measured from the viewport
        // while the in-call controls are laid out from the top: on a short
        // screen (320x568) the two met and the globe sat directly on the
        // Debate button, so tapping Debate opened the translator. Nothing else
        // occupies the call screen's top right -- the settings button is top
        // left -- so this cannot collide at any viewport height.
        style={{
          position: 'fixed', top: 'max(16px, var(--safe-area-top, 16px))', right: 16,
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--accent)',
          border: 'none', color: 'var(--text-on-accent)', fontSize: 22,
          cursor: 'pointer', zIndex: 10005,
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
      background: 'var(--bg-card)', border: '1px solid var(--accent)',
      borderRadius: 16, padding: 14, zIndex: 10005,
      boxShadow: 'var(--glass-lift)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 700, margin: 0 }}>
          🌐 Translate ({nativeLabel} → EN)
        </p>
        <button
          onClick={() => setExpanded(false)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer' }}
        ></button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a word..."
          autoFocus
          style={{
            flex: 1, padding: '10px 12px', borderRadius: 10,
            border: '1px solid var(--border)', background: 'var(--bg-input)',
            color: 'var(--text-primary)', fontSize: 14, outline: 'none'
          }}
        />
        <button
          onClick={handleTranslate}
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 16px', borderRadius: 10, border: 'none',
            background: loading ? 'var(--border)' : 'var(--accent)',
            color: 'var(--text-on-accent)', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '...' : '→'}
        </button>
      </div>

      {result && (
        <div style={{
          marginTop: 10, padding: '10px 12px',
          background: 'var(--bg-input)', borderRadius: 10,
          border: '1px solid var(--border)'
        }}>
          <p style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, margin: 0 }}>{result}</p>
          {saved && (
            <p style={{ color: 'var(--success)', fontSize: 11, margin: '4px 0 0' }}>
              ✓ Saved
            </p>
          )}
        </div>
      )}
    </div>
  );
}
