import { useCallback, useEffect, useState } from 'react';
import { resolveFirstRunLang, storeFirstRunLang } from '../utils/firstRunLang';
import { firstRunText } from '../data/firstRunCopy';

const EVENT = 'sl:firstRunLang';

// The first run's language + its words. Every screen of the first run uses
// this, so a pick on one screen changes the others too (same tab).
// `userLang` = users.guideLanguage (a sign-up on another device).
export default function useFirstRunCopy(userLang) {
  const [lang, setLangState] = useState(() => resolveFirstRunLang(userLang));

  useEffect(() => {
    const onChange = (e) => setLangState(e.detail);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const setLang = useCallback((next) => {
    storeFirstRunLang(next);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }, []);

  const t = useCallback((key, vars) => firstRunText(lang, key, vars), [lang]);
  return { lang, setLang, t };
}
