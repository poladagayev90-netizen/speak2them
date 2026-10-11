import { useCallback, useEffect, useState } from 'react';
import { getFeedbackLanguage } from '../../utils/feedbackLanguage';

// Which language a tapped word translates into — Azerbaijani or Turkish. The
// learner switches it once and every word card follows; it starts from the
// language of their analysis report. Kept per device (a convenience, nothing
// depends on it).
const KEY = 'sl.meaningLang';
const EVENT = 'sl-meaning-lang';

function read() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'az' || v === 'tr') return v;
  } catch (_) { /* private mode */ }
  return getFeedbackLanguage() === 'tr' ? 'tr' : 'az';
}

export default function useMeaningLang() {
  const [lang, setLangState] = useState(read);
  useEffect(() => {
    const on = () => setLangState(read());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const setLang = useCallback((v) => {
    try { localStorage.setItem(KEY, v); } catch (_) { /* private mode */ }
    setLangState(v);
    window.dispatchEvent(new Event(EVENT)); // every open word card switches at once
  }, []);
  return [lang, setLang];
}
