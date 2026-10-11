import React, { useMemo, useState } from 'react';
import { READING_LEVELS, buildTerms } from '../../utils/topicMaterials';
import { TermText, LangSwitch, WordCard } from './TermText';
import MaterialQuestions from './MaterialQuestions';

// One story in three levels. The level buttons swap the whole text (and its
// questions); the topic's key words and the text's own phrases are marked and
// translate on a tap, into AZ or TR.
export default function ReadingView({ reading, topic, initialLevel = 'B1' }) {
  const [level, setLevel] = useState(READING_LEVELS.includes(initialLevel) ? initialLevel : 'B1');
  const [picked, setPicked] = useState(null);
  const r = reading[level];
  const terms = useMemo(() => buildTerms(topic, r?.words || []), [topic, r]);
  const wordCount = useMemo(() => (r?.text || '').split(/\s+/).filter(Boolean).length, [r]);

  if (!r) return null;
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- a tap outside closes the word card
    <div className="mt-reading" onClick={() => picked && setPicked(null)}>
      <div className="mt-reading-bar">
        <div className="mt-levels" role="tablist" aria-label="Level">
          {READING_LEVELS.filter((l) => reading[l]).map((l) => (
            <button key={l} type="button" role="tab" aria-selected={l === level}
              className={`mt-level${l === level ? ' is-on' : ''}`}
              onClick={() => { setLevel(l); setPicked(null); }}>{l}</button>
          ))}
        </div>
        <LangSwitch />
      </div>

      <article className="mt-article">
        <p className="mt-chip">Reading · {level} · {wordCount} words</p>
        <h3 className="mt-article-title">{reading.title}</h3>
        {r.text.split(/\n\s*\n/).map((para, i) => (
          <p key={i}><TermText text={para} terms={terms} picked={picked} onPick={setPicked} /></p>
        ))}
      </article>

      <MaterialQuestions key={level} questions={r.questions} />
      <WordCard term={picked} onClose={() => setPicked(null)} />
    </div>
  );
}
