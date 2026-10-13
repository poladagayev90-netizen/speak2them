import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { splitByTerms } from '../../utils/topicMaterials';
import { localMeaning } from '../../utils/feedbackLanguage';
import useMeaningLang from './useMeaningLang';
import SayButton from '../ui/SayButton';

// A text with the topic's key words marked; a tap opens the word card.
export function TermText({ text, terms, picked, onPick }) {
  const parts = useMemo(() => splitByTerms(text, terms), [text, terms]);
  return parts.map((p, i) => (p.term ? (
    <button
      key={i}
      type="button"
      className={`mt-term${picked?.key === p.term.key ? ' is-on' : ''}`}
      onClick={(e) => { e.stopPropagation(); onPick(picked?.key === p.term.key ? null : p.term); }}
    >{p.text}</button>
  ) : <React.Fragment key={i}>{p.text}</React.Fragment>));
}

export function LangSwitch({ compact = false }) {
  const [lang, setLang] = useMeaningLang();
  return (
    <div className={`mt-lang${compact ? ' mt-lang--compact' : ''}`} role="group" aria-label="Translate into">
      {[['az', 'AZ'], ['tr', 'TR']].map(([v, label]) => (
        <button key={v} type="button" aria-pressed={lang === v} className={lang === v ? 'is-on' : ''} onClick={() => setLang(v)}>{label}</button>
      ))}
    </div>
  );
}

// The translation, instantly: the word, its meaning in AZ or TR (switchable
// right here), the English meaning and an example.
export function WordCard({ term, onClose }) {
  const [lang] = useMeaningLang();
  if (!term) return null;
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- only stops the outside-tap close
    <div className="mt-card" role="dialog" aria-label={term.phrase} onClick={(e) => e.stopPropagation()}>
      <div className="mt-card-top">
        <SayButton text={term.phrase} />
        <span className="mt-card-phrase">{term.phrase}</span>
        <LangSwitch compact />
        <button type="button" className="mt-card-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <p className="mt-card-meaning">{localMeaning(term, lang) || term.meaning}</p>
      {term.meaning && localMeaning(term, lang) && <p className="mt-card-en">{term.meaning}</p>}
      {term.example && <p className="mt-card-ex">“{term.example}”</p>}
    </div>
  );
}
