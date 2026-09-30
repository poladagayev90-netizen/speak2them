import React, { useState } from 'react';
import { Clock, Gauge, GraduationCap, MessageSquareText, SpellCheck, BookOpen, Volume2, ChevronDown } from 'lucide-react';
import { AnalysisDetail } from '../../pages/History';
import { toAnalysisView } from '../../utils/analysisView';
import { sessionTrend, cefrIndex } from '../../utils/labCharts';
import { Tile, Bars, Line, Ladder, ScoreRing } from './LabBits';

// One analysed session in the Lab — Progress / Feedback / Vocabulary, the way
// a tutor's lesson insights split a lesson. Polad (2026-10-01): the Lab
// always opens on the newest session, and older ones are one tap away in the
// picker above this.
//
// Everything here is the session's own report (callAnalysis). The small
// charts run over the sessions up to this one, so the last point is always
// the one on screen.

const TABS = [
  { id: 'progress', label: 'Progress' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'vocabulary', label: 'Vocabulary' },
];

export function whenLine(a) {
  const s = a?.timestamp?.seconds;
  if (!s) return '';
  const d = new Date(s * 1000);
  const same = (x, y) => x.toDateString() === y.toDateString();
  const now = new Date();
  const day = same(d, now) ? 'Today'
    : same(d, new Date(now.getTime() - 86400000)) ? 'Yesterday'
      : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${day}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

export default function LabSession({ analysis, analyses, level }) {
  const [tab, setTab] = useState('progress');
  const view = analysis.error ? null : toAnalysisView(analysis);
  const fixCount = view
    ? (view.errorThemes || []).reduce((n, t) => n + (t.items || []).filter((i) => i.original && i.corrected).length, 0)
    : 0;

  return (
    <>
      <div className="lab-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`lab-tab ${tab === t.id ? 'is-on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'feedback' && fixCount > 0 && <span className="lab-tab-count">{fixCount}</span>}
          </button>
        ))}
      </div>

      {tab === 'progress' && (view
        ? <SessionProgress analysis={analysis} view={view} analyses={analyses} level={level} />
        : <AnalysisDetail analysis={analysis} embedded />)}
      {tab === 'feedback' && <AnalysisDetail analysis={analysis} embedded />}
      {tab === 'vocabulary' && <SessionWords words={view ? view.vocabulary : []} />}
    </>
  );
}

function SessionProgress({ analysis, view, analyses, level }) {
  const trend = (pick) => sessionTrend(analyses, analysis.id, pick);
  const mins = Math.round((Number(analysis.durationSeconds) || 0) / 60);
  const wpm = Number(view.speakingPace?.wpm) || 0;
  const levelShort = typeof level === 'string' && level ? level.split(/[\s–-]/)[0] : null;
  const score = Number(view.overallScore) || null;

  return (
    <>
      <div className="progress-hero">
        <ScoreRing value={score ?? undefined} />
        <div className="progress-hero-body">
          <p className="progress-hero-label">This session</p>
          {analysis.recap && <p className="progress-hero-sub lab-recap">{analysis.recap}</p>}
        </div>
      </div>

      <div className="progress-tiles">
        <Tile icon={Clock} label="Speaking time" value={mins || '<1'} unit="min"
          chart={<Bars values={trend((a) => Math.max(1, Math.round((Number(a.durationSeconds) || 0) / 60)))} label="Minutes per session" />} />
        <Tile icon={MessageSquareText} label="Fluency" value={view.scores.fluency ?? '—'}
          chart={<Line values={trend((a) => a.scores?.fluency)} label="Fluency per session" />} />
        <Tile icon={SpellCheck} label="Grammar" value={view.scores.grammar ?? '—'}
          chart={<Line values={trend((a) => a.scores?.grammar)} label="Grammar per session" />} />
        <Tile icon={BookOpen} label="Vocabulary" value={view.scores.vocabulary ?? '—'}
          chart={<Line values={trend((a) => a.scores?.vocabulary)} label="Vocabulary per session" />} />
        <Tile icon={Gauge} label="Speaking speed" value={wpm || '—'} unit={wpm ? 'wpm' : ''}
          chart={<Line values={trend((a) => a.speakingPace?.wpm)} label="Speaking speed per session" />} />
        <Tile icon={GraduationCap} label="Level" value={levelShort || '—'}
          chart={levelShort ? <Ladder index={cefrIndex(level)} /> : null} />
      </div>
    </>
  );
}

// The words the report picked for this learner to reuse. Tap the speaker to
// hear it (the browser's own voice — free and offline), open the row for the
// meaning and the example. The level chip and the meaning exist only on
// reports written from 2026-10-01; older words show without them.
function SessionWords({ words }) {
  const [open, setOpen] = useState(null);
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  if (!words.length) {
    return <p className="lab-empty">This report has no words picked out. Longer sessions give it more to choose from.</p>;
  }

  const say = (w) => {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(w);
      u.lang = 'en-US';
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    } catch { /* no voice on this device */ }
  };

  return (
    <div className="lab-words">
      <p className="lab-words-title">Key vocabulary</p>
      <div className="lab-words-list">
        {words.map((v, i) => {
          const isOpen = open === i;
          return (
            <div key={`${v.word}-${i}`} className={`lab-word ${isOpen ? 'is-open' : ''}`}>
              <div className="lab-word-row">
                {canSpeak && (
                  <button type="button" className="lab-word-say" onClick={() => say(v.word)} aria-label={`Hear “${v.word}”`}>
                    <Volume2 size={18} />
                  </button>
                )}
                <button type="button" className="lab-word-main" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}>
                  <span className="lab-word-w">{v.word}</span>
                  {v.cefr && <span className="lab-word-cefr">{v.cefr}</span>}
                  <ChevronDown size={18} className="lab-word-chev" aria-hidden="true" />
                </button>
              </div>
              {isOpen && (
                <div className="lab-word-more">
                  {v.meaning && <p className="lab-word-meaning">{v.meaning}</p>}
                  {v.example && <p className="lab-word-example">“{v.example}”</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
