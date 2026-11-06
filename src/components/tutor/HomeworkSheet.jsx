import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { FileDown, Printer, X } from 'lucide-react';
import { authedFetch } from '../../api';
import { FUNCTIONS_BASE } from '../../constants';
import { weeklyContent } from '../../data/weeklyContent';
import { plainTopic } from '../../utils/topicLabel';
import { buildLessonSheet } from '../../utils/lessonSheet';
import './homeworkSheet.css';

const day = (ms) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Baku', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms));

// One tap → a printable homework sheet from the learner's own analyses since
// the last lesson (the same brief "Before the lesson" reads) plus the coming
// lesson's topic. The browser's own print dialog saves it as a PDF — no PDF
// library, and Azerbaijani letters in names print as typed. Inside the Android
// app WebView there is no print dialog, so the sheet only shows there with a
// note to open SpeakLab in a browser.
//
// Two documents, both from the same data: the student's sheet (exercises +
// answer key on its own page) and the teacher's lesson plan. Nothing is stored.
export default function HomeworkSheet({ uid, name }) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('student'); // 'student' | 'plan'
  const autoPrinted = useRef(false);
  const native = Capacitor.isNativePlatform();

  const load = async () => {
    setOpen(true); setError(''); setSheet(null); setMode('student');
    autoPrinted.current = false;
    try {
      const res = await authedFetch(`${FUNCTIONS_BASE}/teacherStudentBrief`, {
        method: 'POST', body: JSON.stringify({ uid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'failed');
      const lesson = data.nextLesson || data.lastLesson || null;
      const topic = lesson && Number.isInteger(lesson.topicIndex) ? weeklyContent[lesson.topicIndex] || null : null;
      setSheet({
        ...buildLessonSheet(data, topic),
        topicTitle: topic ? plainTopic(topic.topic) : '',
        lessonN: data.nextLesson ? data.nextLesson.n : null,
        lessonAt: data.nextLesson ? data.nextLesson.atMs : null,
        calls: data.calls || 0,
      });
    } catch {
      setError('Could not build the sheet. Try again.');
    }
  };

  // The one tap: as soon as the sheet is on the page, open the print dialog.
  useEffect(() => {
    if (!sheet || native || autoPrinted.current) return undefined;
    autoPrinted.current = true;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [sheet, native]);

  const printMode = (m) => {
    setMode(m);
    if (!native) setTimeout(() => window.print(), 100);
  };

  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add('hs-printing');
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('hs-printing'); window.removeEventListener('keydown', onKey); };
  }, [open]);

  // Number only the sections that have something in them, so the printed
  // sheet reads 1, 2, 3 … whatever is left out for this learner.
  const num = {};
  let k = 0;
  ['fix', 'words', 'gaps', 'multipleChoice', 'wordOrder', 'speak'].forEach((key) => {
    const v = sheet && sheet[key];
    if (Array.isArray(v) ? v.length : v) { k += 1; num[key] = k; }
  });

  const who = name || 'Student';
  const today = day(Date.now());

  return (
    <>
      <button type="button" className="cb-open cb-open--soft" onClick={load}>
        <FileDown size={16} aria-hidden="true" />
        Homework PDF
      </button>
      {open && createPortal(
        <div className="hs-root" role="dialog" aria-modal="true" aria-label={`Homework sheet · ${who}`}>
          <div className="hs-bar">
            <div className="ui-seg hs-seg" role="tablist" aria-label="Document">
              <button type="button" role="tab" aria-selected={mode === 'student'} className={`ui-seg-btn ${mode === 'student' ? 'is-on' : ''}`} onClick={() => setMode('student')}>Homework</button>
              <button type="button" role="tab" aria-selected={mode === 'plan'} className={`ui-seg-btn ${mode === 'plan' ? 'is-on' : ''}`} onClick={() => setMode('plan')}>Lesson plan</button>
            </div>
            {!native && sheet && (
              <button type="button" className="cb-open" onClick={() => printMode(mode)}>
                <Printer size={16} aria-hidden="true" /> Save as PDF
              </button>
            )}
            <button type="button" className="hs-close" onClick={() => setOpen(false)} aria-label="Close">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          {native && <p className="hs-note">To save this as a PDF, open SpeakLab in a browser on your phone or computer.</p>}
          {error && <p className="cc-error" role="alert">{error}</p>}
          {!sheet && !error && <p className="hs-note">Reading their calls…</p>}

          {sheet && mode === 'student' && (
            <article className="hs-doc">
              <header className="hs-head">
                <p className="hs-brand">SpeakLab · Homework</p>
                <h1 className="hs-title">{who}{sheet.topicTitle ? ` · ${sheet.topicTitle}` : ''}</h1>
                <p className="hs-meta">{sheet.lessonN ? `Before lesson ${sheet.lessonN} · ` : ''}{today}</p>
              </header>

              {sheet.fix.length > 0 && (
                <section className="hs-sec">
                  <h2 className="hs-h">{num.fix}. Fix your own sentences</h2>
                  <p className="hs-hint">You said these in your calls. Write each one correctly.</p>
                  <ol className="hs-list">
                    {sheet.fix.map((f) => (
                      <li key={f.original}><span className="hs-q">{f.original}</span><span className="hs-line" /></li>
                    ))}
                  </ol>
                </section>
              )}

              {sheet.words.length > 0 && (
                <section className="hs-sec">
                  <h2 className="hs-h">{num.words}. Words</h2>
                  <p className="hs-hint">Write your own sentence with each word.</p>
                  <ol className="hs-list">
                    {sheet.words.map((w) => (
                      <li key={w.word}><span className="hs-q"><b>{w.word}</b>{w.meaning ? ` — ${w.meaning}` : ''}</span><span className="hs-line" /></li>
                    ))}
                  </ol>
                </section>
              )}

              {sheet.gaps.length > 0 && (
                <section className="hs-sec">
                  <h2 className="hs-h">{num.gaps}. Fill the gap</h2>
                  <p className="hs-hint">Use a word from the list above.</p>
                  <ol className="hs-list">
                    {sheet.gaps.map((g) => <li key={g.sentence}><span className="hs-q">{g.sentence}</span></li>)}
                  </ol>
                </section>
              )}

              {sheet.multipleChoice.length > 0 && (
                <section className="hs-sec">
                  <h2 className="hs-h">{num.multipleChoice}. Choose the right answer</h2>
                  <ol className="hs-list">
                    {sheet.multipleChoice.map((q) => (
                      <li key={q.question}>
                        <span className="hs-q">{q.question}</span>
                        <span className="hs-opts">{q.options.map((o, i) => <span key={o}>{String.fromCharCode(97 + i)}) {o}</span>)}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {sheet.wordOrder.length > 0 && (
                <section className="hs-sec">
                  <h2 className="hs-h">{num.wordOrder}. Put the words in order</h2>
                  <ol className="hs-list">
                    {sheet.wordOrder.map((w) => (
                      <li key={w.sentence}><span className="hs-q">{w.scrambled.join(' / ')}</span><span className="hs-line" /></li>
                    ))}
                  </ol>
                </section>
              )}

              {sheet.speak && (
                <section className="hs-sec">
                  <h2 className="hs-h">{num.speak}. Speak</h2>
                  <p className="hs-hint">Answer out loud for one minute, then write three sentences.</p>
                  <p className="hs-q">{sheet.speak}</p>
                  <span className="hs-line" /><span className="hs-line" /><span className="hs-line" />
                </section>
              )}

              <section className="hs-sec hs-answers">
                <h2 className="hs-h">Answers</h2>
                {sheet.fix.length > 0 && <>
                  <h3 className="hs-h3">Your sentences</h3>
                  <ol className="hs-list hs-list--tight">
                    {sheet.fix.map((f) => <li key={f.original}>{f.corrected}{f.rule ? <span className="hs-rule"> — {f.rule}</span> : null}</li>)}
                  </ol>
                </>}
                {sheet.gaps.length > 0 && <>
                  <h3 className="hs-h3">Fill the gap</h3>
                  <ol className="hs-list hs-list--tight">{sheet.gaps.map((g) => <li key={g.sentence}>{g.answer}</li>)}</ol>
                </>}
                {sheet.multipleChoice.length > 0 && <>
                  <h3 className="hs-h3">Choose the right answer</h3>
                  <ol className="hs-list hs-list--tight">{sheet.multipleChoice.map((q) => <li key={q.question}>{q.answer}{q.explanation ? <span className="hs-rule"> — {q.explanation}</span> : null}</li>)}</ol>
                </>}
                {sheet.wordOrder.length > 0 && <>
                  <h3 className="hs-h3">Put the words in order</h3>
                  <ol className="hs-list hs-list--tight">{sheet.wordOrder.map((w) => <li key={w.sentence}>{w.sentence}</li>)}</ol>
                </>}
              </section>
            </article>
          )}

          {sheet && mode === 'plan' && (
            <article className="hs-doc">
              <header className="hs-head">
                <p className="hs-brand">SpeakLab · Lesson plan</p>
                <h1 className="hs-title">{who}{sheet.topicTitle ? ` · ${sheet.topicTitle}` : ''}</h1>
                <p className="hs-meta">
                  {sheet.lessonN ? `Lesson ${sheet.lessonN} · ` : ''}{sheet.lessonAt ? day(sheet.lessonAt) : today} · from {sheet.calls} {sheet.calls === 1 ? 'analysed call' : 'analysed calls'}
                </p>
              </header>
              <ol className="hs-plan">
                {sheet.plan.map((s) => (
                  <li key={s.title}>
                    <span className="hs-min">{s.min} min</span>
                    <div><b>{s.title}</b><p>{s.detail}</p></div>
                  </li>
                ))}
              </ol>
            </article>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
