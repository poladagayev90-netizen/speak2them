import { useCallback, useEffect, useState } from 'react';
import { getFeedbackLanguage, LANG_STORAGE_KEY } from '../../utils/feedbackLanguage';
import { FIRST_RUN_LANG_KEY } from '../../utils/firstRunLang';

// Which language a tapped word translates into — Azerbaijani or Turkish. The
// learner switches it once and every word card follows; it starts from the
// language of their analysis report. Kept per device (a convenience, nothing
// depends on it).
const KEY = 'sl.meaningLang';
const EVENT = 'sl-meaning-lang';

// 'en' = English only: the card shows the English meaning and no L1 line
// (QA 2026-11-12 O1: a learner who picked English at sign-up saw Azerbaijani
// meanings, because meanings exist in az/tr only). It is the default for
// exactly that learner — first run in English and no report language chosen.
function read() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'az' || v === 'tr' || v === 'en') return v;
    if (localStorage.getItem(FIRST_RUN_LANG_KEY) === 'en' && !localStorage.getItem(LANG_STORAGE_KEY)) return 'en';
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
