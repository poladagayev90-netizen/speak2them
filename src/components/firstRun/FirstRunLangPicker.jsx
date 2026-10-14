import React from 'react';
import { Languages } from 'lucide-react';
import { FIRST_RUN_LANGS, FIRST_RUN_LANG_NAMES } from '../../utils/firstRunLang';
import './FirstRunLangPicker.css';

// AZ · TR · RU · EN — the first tap of the first run. Each name is written in
// its own language, so the right one is findable without reading the others.
export default function FirstRunLangPicker({ lang, onChange, label }) {
  return (
    <div className="frl" role="radiogroup" aria-label={label}>
      <Languages size={16} aria-hidden="true" className="frl-icon" />
      {FIRST_RUN_LANGS.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          lang={l}
          aria-checked={lang === l}
          className={`frl-btn${lang === l ? ' is-on' : ''}`}
          onClick={() => onChange(l)}
        >
          {FIRST_RUN_LANG_NAMES[l]}
        </button>
      ))}
    </div>
  );
}
