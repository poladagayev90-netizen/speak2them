import React, { useState } from 'react';
import { Languages, X, ArrowRight, ArrowLeftRight, Check } from 'lucide-react';
import { translateText } from '../utils/translate';
import { saveWordToHistory } from '../utils/wordHistory';

const LANG_LABEL = { az: 'AZ', tr: 'TR' };
const LANG_NAME = { az: 'Azərbaycan', tr: 'Türkçe' };

export default function TranslateWidget({ userId, topic, onTranslate, nativeLanguage = 'az' }) {
  // The UI is English, but one side of the translation is the learner's own
  // language -- that is the whole point of the widget. It starts from the same
  // preferredLanguage setting that decides the report language, and can be
  // changed HERE: that setting lives on the Profile page, most people never
  // open it, and a Turkish learner in the middle of a call should not have to
  // leave the call to be understood.
  const [lang, setLang] = useState(nativeLanguage === 'tr' ? 'tr' : 'az');
  // Which way round. A call needs BOTH directions and only ever had one: you
  // look up a word you want to say (AZ→EN), but you also hear a word from your
  // partner that you do not know (EN→AZ) — and that second case, which is the
  // more common one while listening, was impossible.
  const [toEnglish, setToEnglish] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const from = toEnglish ? lang : 'en';
  const to = toEnglish ? 'en' : lang;
  const fromLabel = toEnglish ? LANG_LABEL[lang] : 'EN';
  const toLabel = toEnglish ? 'EN' : LANG_LABEL[lang];

  const clear = () => { setResult(''); setSaved(false); };
  const swap = () => { setToEnglish((v) => !v); clear(); };
  const switchLang = () => { setLang((l) => (l === 'az' ? 'tr' : 'az')); clear(); };

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
    const translated = await translateText(input.trim(), from, to);
    setLoading(false);
    if (translated) {
      localStorage.setItem('translate_used', (usedTranslations + 1).toString());
      setResult(translated);
      // My words is a list of ENGLISH vocabulary, so the pair is always stored
      // the same way round regardless of which direction it was looked up in.
      const mine = toEnglish ? input.trim() : translated;
      const english = toEnglish ? translated : input.trim();
      saveWordToHistory(userId, mine, english, topic);
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
        aria-label="Translate a word"
        // Anchored to the TOP right, not the bottom. This widget only ever
        // renders during a call, and bottom:140 is measured from the viewport
        // while the in-call controls are laid out from the top: on a short
        // screen (320x568) the two met and the globe sat directly on the
        // Debate button, so tapping Debate opened the translator. Nothing else
        // occupies the call screen's top right -- the settings button is top
        // left -- so this cannot collide at any viewport height.
        // z-index is --z-sheet, not the 10005 it used to be. At 10005 this
        // 52px circle floated above the call roadmap (z-index 1002) and landed
        // exactly on its Skip button, so a learner dismissing the roadmap on
        // their first call opened the translator instead — over the whole call
        // screen, and with no way out until the close button was fixed. It has
        // to sit above the call screen and below every overlay that owns it.
        style={{
          position: 'fixed', top: 'max(16px, var(--safe-area-top, 16px))', right: 16,
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--accent)',
          border: 'none', color: 'var(--text-on-accent)',
          cursor: 'pointer', zIndex: 'var(--z-sheet)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >
        <Languages size={22} strokeWidth={1.75} aria-hidden="true" />
      </button>
    );
  }

  const chip = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '5px 10px', borderRadius: 'var(--r-pill)',
    border: '1px solid var(--accent-ring)', background: 'var(--accent-soft)',
    color: 'var(--accent)', fontSize: 12, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  };

  return (
    <div style={{
      position: 'fixed', bottom: 140, left: 16, right: 16,
      maxWidth: 400, margin: '0 auto',
      background: 'var(--bg-card)', border: '1px solid var(--accent)',
      borderRadius: 16, padding: 14, zIndex: 'var(--z-sheet)',
      boxShadow: 'var(--glass-lift)'
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 10, gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
          {/* Tap to reverse. The pair itself says which way it currently runs,
              so there is no separate label that can fall out of step with it. */}
          <button type="button" onClick={swap} style={chip} aria-label={`Translating ${fromLabel} to ${toLabel}. Tap to reverse.`}>
            {fromLabel}
            <ArrowRight size={12} strokeWidth={2.5} aria-hidden="true" />
            {toLabel}
            <ArrowLeftRight size={12} strokeWidth={2.5} aria-hidden="true" style={{ opacity: 0.65, marginLeft: 2 }} />
          </button>
          <button
            type="button"
            onClick={switchLang}
            style={{ ...chip, background: 'transparent', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
            aria-label={`My language is ${LANG_NAME[lang]}. Tap to switch.`}
          >
            {LANG_NAME[lang]}
          </button>
        </div>
        {/* This close button used to be an EMPTY <button></button>: an emoji was
            stripped out of it and never replaced, so the only way out of the
            widget was a zero-width invisible element. Once opened, it covered
            the call screen with no way back. */}
        <button
          onClick={() => setExpanded(false)}
          aria-label="Close translator"
          style={{
            background: 'transparent', border: 'none', color: 'var(--text-secondary)',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            padding: 4, flexShrink: 0,
          }}
        >
          <X size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={toEnglish ? `Type a word in ${LANG_LABEL[lang]}…` : 'Type an English word…'}
          autoFocus
          style={{
            flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 10,
            border: '1px solid var(--border)', background: 'var(--bg-input)',
            color: 'var(--text-primary)', fontSize: 14, outline: 'none'
          }}
        />
        <button
          onClick={handleTranslate}
          disabled={loading || !input.trim()}
          aria-label="Translate"
          style={{
            padding: '10px 16px', borderRadius: 10, border: 'none',
            background: loading ? 'var(--border)' : 'var(--accent)',
            color: 'var(--text-on-accent)', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {loading ? '…' : <ArrowRight size={18} strokeWidth={2.25} aria-hidden="true" />}
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
            <p style={{
              color: 'var(--success)', fontSize: 11, fontWeight: 600, margin: '4px 0 0',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Check size={12} strokeWidth={2.5} aria-hidden="true" /> Saved
            </p>
          )}
        </div>
      )}
    </div>
  );
}
