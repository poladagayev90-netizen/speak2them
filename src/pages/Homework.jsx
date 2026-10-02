import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { arrayUnion, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Check, Volume2, Snail } from 'lucide-react';
import { db } from '../firebase';
import { weeklyContent } from '../data/weeklyContent';
import { localMeaning } from '../utils/feedbackLanguage';
import { markDictation, markOriginal } from '../utils/dictation';
import { homeworkStepKeys } from '../utils/tutorLessons';
import AnalysisHomework from '../components/AnalysisHomework';
import Button from '../components/ui/Button';
import '../components/homework/homework.css';

// Homework for one held lesson (homework/{lessonId}, built by the server when
// the teacher marked the lesson held). Words, dictation and speaking come from
// the lesson's topic; "Your mistakes" comes from this learner's own reports
// since the previous lesson and is left out when there is nothing in it. The
// story was read before the lesson, on /class/:lessonId. Progress is the
// learner's own (doneSteps) and unlocks nothing.

const DICTATION_COUNT = 5;

function say(text, slow) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = slow ? 0.65 : 0.9;
    window.speechSynthesis.speak(u);
  } catch { /* no voice on this device */ }
}
const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

let clip = null;
function play(url, slow) {
  try {
    if (clip) clip.pause();
    clip = new Audio(url);
    clip.playbackRate = slow ? 0.75 : 1;
    clip.play().catch(() => {});
  } catch { /* no audio */ }
}

function SpeakButton({ text, audioUrl = null, slow = false, label }) {
  if (!audioUrl && !canSpeak) return null;
  return (
    <button type="button" className="hw-speak" aria-label={label || (slow ? 'Play slowly' : 'Play')}
      onClick={() => (audioUrl ? play(audioUrl, slow) : say(text, slow))}>
      {slow ? <Snail size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
    </button>
  );
}

function WordsStep({ items }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="hw-words">
      {items.map((v, i) => (
        <div key={`${v.word}-${i}`} className={`hw-word${open === i ? ' is-open' : ''}`}>
          <div className="hw-word-row">
            <button type="button" className="hw-word-main" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              <span className="hw-word-text">{v.word}</span>
              {v.kind === 'idiom' && <span className="hw-tag">idiom</span>}
            </button>
            <SpeakButton text={v.word} label={`Say ${v.word}`} />
          </div>
          {open === i && (
            <div className="hw-word-more">
              {v.meaning && <p className="hw-meaning">{v.meaning}</p>}
              {v.example && <p className="hw-example">“{v.example}”</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DictationLine({ index, sentence, audioUrl, onMarked }) {
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState(null);
  const check = () => {
    const r = markDictation(sentence, typed);
    setResult(r);
    onMarked(index, r.score);
  };
  return (
    <div className="hw-dict">
      <div className="hw-dict-head">
        <span className="hw-dict-n">{index + 1}</span>
        <SpeakButton text={sentence} audioUrl={audioUrl} label={`Play sentence ${index + 1}`} />
        <SpeakButton text={sentence} audioUrl={audioUrl} slow label={`Play sentence ${index + 1} slowly`} />
      </div>
      <textarea
        className="hw-dict-input" rows={2} value={typed} disabled={!!result}
        placeholder="Type what you hear" aria-label={`Sentence ${index + 1}`}
        autoCapitalize="sentences" spellCheck={false}
        onChange={(e) => setTyped(e.target.value)}
      />
      {result ? (
        <p className="hw-dict-result">
          {markOriginal(sentence, result).map((w, i) => (
            <span key={i} className={w.ok ? 'hw-ok' : 'hw-miss'}>{w.text} </span>
          ))}
          <b className="hw-dict-score">{result.score}%</b>
        </p>
      ) : (
        <Button size="sm" variant="secondary" disabled={!typed.trim()} onClick={check}>Check</Button>
      )}
    </div>
  );
}

function MineStep({ personal }) {
  const homework = {
    multipleChoice: personal.multipleChoice.map((q) => ({ question: q.question, options: q.options, correct_answer: q.answer, explanation: q.explanation })),
    wordOrder: personal.wordOrder.map((w) => ({ scrambled: w.scrambled, correct_sentence: w.sentence, explanation: w.explanation })),
  };
  return (
    <div className="hw-mine">
      <p className="hw-lead">From your own calls since the last lesson.</p>
      {personal.themes.map((t) => (
        <div key={t.concept} className="hw-theme">
          <p className="hw-theme-title">{t.title}</p>
          {t.rule && <p className="hw-theme-rule">{t.rule}</p>}
          {t.examples.map((e, i) => (
            <p key={i} className="hw-fix"><s>{e.original}</s> <span aria-hidden="true">→</span> <b>{e.corrected}</b></p>
          ))}
        </div>
      ))}
      {personal.words.length > 0 && (
        <>
          <p className="hw-sub">Words you reached for</p>
          <WordsStep items={personal.words} />
        </>
      )}
      <AnalysisHomework homework={homework} showCorrections={false} showBanner={false} />
    </div>
  );
}

export default function Homework({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [hw, setHw] = useState(undefined);
  const [step, setStep] = useState(0);
  const [dictScores, setDictScores] = useState({});

  useEffect(() => onSnapshot(
    doc(db, 'homework', id),
    (snap) => setHw(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    () => setHw(null)
  ), [id]);

  const topic = hw && Number.isInteger(hw.topicIndex) ? weeklyContent[hw.topicIndex] : null;

  const words = useMemo(() => (topic ? [
    ...(topic.vocabulary || []).map((v) => ({ word: v.word, meaning: localMeaning(v), example: v.example, kind: 'word' })),
    ...(topic.idioms || []).map((v) => ({ word: v.phrase, meaning: localMeaning(v), example: v.example, kind: 'idiom' })),
  ] : []), [topic]);
  // Dictation: the topic's example sentences (device voice).
  const sentences = useMemo(() => (topic
    ? (topic.vocabulary || []).map((v) => v.example).filter(Boolean).slice(0, DICTATION_COUNT).map((text) => ({ text }))
    : []), [topic]);

  const personal = hw?.personal;
  const LABELS = { words: 'Words', dictation: 'Dictation', mine: 'Your mistakes', speak: 'Speak' };
  const steps = homeworkStepKeys(personal).map((key) => ({ key, label: LABELS[key] }));

  if (hw === undefined) return <div className="hw-page"><p className="hw-lead">Loading…</p></div>;
  if (!hw || hw.hidden || hw.uid !== user?.uid || !topic) {
    return (
      <div className="hw-page">
        <button type="button" className="hw-back" onClick={() => navigate('/')} aria-label="Back"><ArrowLeft size={20} /></button>
        <p className="hw-lead">This homework is not open.</p>
      </div>
    );
  }

  const done = new Set(hw.doneSteps || []);
  const cur = steps[Math.min(step, steps.length - 1)];

  const markDone = async (extra = {}) => {
    try {
      await updateDoc(doc(db, 'homework', id), { doneSteps: arrayUnion(cur.key), updatedAt: serverTimestamp(), ...extra });
    } catch (e) { console.error('[Homework] save', e); }
    if (step < steps.length - 1) { setStep(step + 1); window.scrollTo(0, 0); }
  };

  const dictAvg = Object.keys(dictScores).length === sentences.length && sentences.length > 0
    ? Math.round(Object.values(dictScores).reduce((a, b) => a + b, 0) / sentences.length) : null;

  return (
    <div className="hw-page">
      <header className="hw-head">
        <button type="button" className="hw-back" onClick={() => navigate('/')} aria-label="Back"><ArrowLeft size={20} /></button>
        <div className="hw-titles">
          <h1 className="hw-title">Lesson {hw.n} homework</h1>
          <p className="hw-topic">{topic.topic}</p>
        </div>
      </header>

      <nav className="hw-steps" aria-label="Steps">
        {steps.map((s, i) => (
          <button key={s.key} type="button" aria-current={i === step ? 'step' : undefined}
            className={`hw-step${i === step ? ' is-cur' : ''}${done.has(s.key) ? ' is-done' : ''}`} onClick={() => setStep(i)}>
            {done.has(s.key) && <Check size={13} strokeWidth={3} aria-hidden="true" />}
            {s.label}
          </button>
        ))}
      </nav>

      <section className="hw-body">
        {cur.key === 'words' && (
          <>
            <p className="hw-lead">Tap a word for its meaning and an example. Say each one out loud.</p>
            <WordsStep items={words} />
          </>
        )}
        {cur.key === 'dictation' && (
          <>
            <p className="hw-lead">Listen and type each sentence. Play it slowly if you need to.</p>
            {sentences.map((s, i) => (
              <DictationLine key={`${i}-${s.text}`} index={i} sentence={s.text} audioUrl={s.audioUrl}
                onMarked={(n, score) => setDictScores((m) => ({ ...m, [n]: score }))} />
            ))}
            {dictAvg !== null && <p className="hw-total">Dictation: <b>{dictAvg}%</b></p>}
          </>
        )}
        {cur.key === 'mine' && <MineStep personal={personal} />}
        {cur.key === 'speak' && (
          <>
            <p className="hw-lead">Answer these out loud — with AInur, or with a partner on a call.</p>
            <ol className="hw-questions">
              {(topic.questions?.easy || []).slice(0, 3).concat((topic.questions?.hard || []).slice(0, 2)).map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
            <div className="hw-actions">
              <Button variant="ai" full onClick={() => navigate('/practice')}>Practise with AInur</Button>
              <Button variant="secondary" full onClick={() => navigate('/chats')}>Call a partner</Button>
            </div>
          </>
        )}
      </section>

      <div className="hw-foot">
        <Button full
          disabled={cur.key === 'dictation' && dictAvg === null}
          onClick={() => markDone(cur.key === 'dictation' && dictAvg !== null ? { 'scores.dictation': dictAvg } : {})}>
          {done.has(cur.key) ? (step < steps.length - 1 ? 'Next' : 'Done') : 'Mark this step done'}
        </Button>
      </div>
    </div>
  );
}
