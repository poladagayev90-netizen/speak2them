import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';import { Clock, ChevronLeft, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import GuidedTour from '../components/GuidedTour';
import AnalysisHomework from '../components/AnalysisHomework';
import { getFeedbackLanguage } from '../utils/feedbackLanguage';
import { toAnalysisView, analysisErrorMessage } from '../utils/analysisView';
import '../styles/analysisReport.css';

const PROFILE_TOUR_STEPS = [
  {
    target: '#tour-analyze',
    title: 'Analyze Data',
    content: 'After a call you can review your grammar, word choice and overall score here.',
    disableBeacon: true,
  }
];

export default function History({ user }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const navigate = useNavigate();
  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      const base = [collection(db, 'callAnalysis'), where('userId', '==', user.uid)];
      const run = async (ordered) => getDocs(
        ordered
          ? query(...base, orderBy('timestamp', 'desc'), limit(50))
          : query(...base, limit(50))
      );
      try {
        let snap;
        try {
          snap = await run(true);
        } catch (e) {
          // The composite index (userId, timestamp desc) may not exist yet —
          // fall back to an unordered read; the local sort below covers it.
          if (e.code !== 'failed-precondition') throw e;
          console.warn('[History] composite index missing, falling back');
          snap = await run(false);
        }
        const results = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          // Tickets still in the queue carry no analysis yet. Failed ones stay:
          // hiding them left the user waiting for a result that never arrives.
          .filter(d => d.status !== 'queued' && d.status !== 'processing');
        results.sort((a, b) => {
          const tA = a.timestamp?.seconds || 0;
          const tB = b.timestamp?.seconds || 0;
          return tB - tA;
        });
        setHistory(results);

        // Home-dakı "analiziniz hazırdır" kartı bu açara baxır — səhifəyə
        // girmək ən yenisini "görülmüş" sayır, kart özbaşına qayıtmır.
        const newestDone = results.find(d => d.status === 'done');
        if (newestDone?.timestamp?.seconds) {
          localStorage.setItem(`analysisSeen_v1_${user.uid}`, String(newestDone.timestamp.seconds * 1000));
        }
      } catch (e) {
        console.error('Error fetching history:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [user]);

  // A CSS variable cannot take an "22" alpha suffix the way a hex literal can,
  // so the score badge uses the paired bg/fg tokens instead of tinting one colour.
  const scoreTone = (s) => (s >= 80 ? 'success' : s >= 60 ? 'warning' : 'danger');

  if (selectedAnalysis) {
    return <AnalysisDetail analysis={selectedAnalysis} onClose={() => setSelectedAnalysis(null)} lang={getFeedbackLanguage()} />;
  }

  return (
    <div className="history-page" style={{ padding: '20px 16px', paddingBottom: '100px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={() => navigate('/profile')} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 0 }}>
          <ChevronLeft size={24} />
        </button>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0 16px' }}>{'Analysis history'}</h2>
      </div>

      <GuidedTour user={user} steps={PROFILE_TOUR_STEPS} tourKey="tourDone_profile" />

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>{'Loading...'}</div>
      ) : history.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '60px' }}>
          <div style={{ marginBottom: '16px', color: 'var(--text-muted)' }}><FileText size={40} strokeWidth={1.5} /></div>
          <p style={{ color: 'var(--text-secondary)' }}>{'No analyses yet.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {history.map((call, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedAnalysis(call)}
              style={{
                background: 'var(--bg-secondary)',
                borderRadius: '16px',
                padding: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>
                  {call.peerName || 'Anonim'}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} />
                  {call.durationSeconds ? `${Math.floor(call.durationSeconds / 60)}m ${call.durationSeconds % 60}s` : 'Unknown'}
                  {call.timestamp && ` • ${new Date(call.timestamp.seconds * 1000).toLocaleDateString()}`}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                {call.overallScore ? (
                  <div style={{
                    background: `var(--${scoreTone(call.overallScore)}-bg)`,
                    color: `var(--${scoreTone(call.overallScore)}-fg)`,
                    padding: '8px 12px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '18px'
                  }}>
                    {call.overallScore}
                  </div>
                ) : call.error ? (
                  <div style={{ color: 'var(--danger)', fontSize: '12px', fontWeight: 700 }}>{'Error'}</div>
                ) : null}
                <button
                  id={idx === 0 ? "tour-analyze" : undefined}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedAnalysis(call);
                  }}
                  style={{
                    border: '1px solid var(--accent)',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    borderRadius: '10px',
                    padding: '7px 10px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {'View analysis'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ANALİZ HESABATI — çap olunmuş sənəd görünüşü
// ═══════════════════════════════════════════════════════════════════
// Bu ekran qəsdən tətbiqin qalanına bənzəmir: ağ kağız, serif başlıqlar,
// nömrələnmiş bölmələr, cədvəllər. Səbəb — müəllim bunu valideynə göstərir
// və çap edir; "tətbiq ekranı" deyil, RƏSMİ HESABAT təsiri dəyəri satır.
// Şagird və müəllim EYNİ komponenti görür (TeacherStudent bunu import edir).
// One threshold table for the whole report rather than a colour picked inline
// at each call site.
const scoreHue = (s) => (s >= 80 ? 'var(--success)' : s >= 60 ? 'var(--warning)' : 'var(--danger)');

// Used only by the folded 'full notes' block.
const mdComponents = {
  h1: ({ children }) => <h2 className="doc-h">{children}</h2>,
  h2: ({ children }) => <h3 className="doc-h">{children}</h3>,
  h3: ({ children }) => <h4 className="doc-h">{children}</h4>,
  p: ({ children }) => <p className="doc-p">{children}</p>,
  ul: ({ children }) => <ul className="doc-list">{children}</ul>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong>{children}</strong>,
};

export function AnalysisDetail({ analysis, onClose, lang }) {
  // The generated content (corrections, reasons, tips) arrives already written
  // in the learner language; the frame around it is English like the rest of
  // the app, so nothing here needs to branch on the language.
  const [showTranscript, setShowTranscript] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  if (analysis.error) return (
    <div className="analysis-doc">
      <div className="analysis-doc-header">
        <button className="analysis-doc-back" onClick={onClose} aria-label="Back">
          <ChevronLeft size={22} />
        </button>
        <div className="analysis-doc-title">Analysis</div>
      </div>
      <div className="analysis-doc-card" style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 10, color: 'var(--danger)' }}><FileText size={38} strokeWidth={1.5} /></div>
        <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Analysis failed</p>
        <p className="doc-note">{analysisErrorMessage(analysis.error)}</p>
      </div>
    </div>
  );

  const view = toAnalysisView(analysis);
  const dateLabel = (() => {
    if (!analysis.timestamp?.seconds) return '';
    const d = new Date(analysis.timestamp.seconds * 1000);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  })();
  const mins = Math.round((analysis.durationSeconds || 0) / 60);
  const durLabel = mins >= 1 ? `${mins} min` : `${analysis.durationSeconds || 0}s`;

  // Every correction, flattened. The learner does not think in "themes" — they
  // think "what did I get wrong". The theme title becomes a small tag on the
  // row instead of a heading with its own paragraph.
  const fixes = [];
  (view.errorThemes || []).forEach((theme) => {
    (theme.items || []).forEach((item) => {
      if (item.original && item.corrected) {
        fixes.push({ ...item, tag: theme.title, rule: theme.rule });
      }
    });
  });

  return (
    <div className="analysis-doc rep">
      <div className="analysis-doc-header">
        <button className="analysis-doc-back" onClick={onClose} aria-label="Back">
          <ChevronLeft size={22} />
        </button>
        <div className="analysis-doc-title">Analysis</div>
      </div>

      {/* One line of context, then straight into the corrections. The report
          used to open with up to 4000 characters of generated prose, which is
          the part a learner scrolls past to reach what they actually got
          wrong. It is still available, at the bottom, folded away. */}
      <div className="rep-head">
        <div className="rep-score" style={{ color: scoreHue(view.overallScore) }}>
          {view.overallScore ?? '—'}
        </div>
        <div className="rep-head-meta">
          <p className="rep-head-line">
            {durLabel} of speaking{dateLabel ? ` · ${dateLabel}` : ''}
          </p>
          <p className="rep-head-sub">
            Fluency {view.scores.fluency ?? '—'} · Grammar {view.scores.grammar ?? '—'} · Vocabulary {view.scores.vocabulary ?? '—'}
            {view.speakingPace?.wpm > 0 ? ` · ${view.speakingPace.wpm} wpm` : ''}
          </p>
        </div>
      </div>

      {fixes.length > 0 ? (
        <>
          <p className="rep-label">Fix these · {fixes.length}</p>
          {fixes.map((f, i) => (
            <div className="rep-fix" key={i}>
              {f.tag && <span className="rep-tag">{f.tag}</span>}
              <p className="rep-wrong"><span className="rep-mark">✗</span>{f.original}</p>
              <p className="rep-right"><span className="rep-mark">✓</span>{f.corrected}</p>
              {(f.reason || f.rule) && <p className="rep-why">{f.reason || f.rule}</p>}
            </div>
          ))}
        </>
      ) : (
        <div className="rep-clean">
          <p className="rep-clean-title">No grammar mistakes found</p>
          <p className="rep-why">Nothing to correct in what you said this time.</p>
        </div>
      )}

      {/* Practice outranks reading. This is the part that changes anything. */}
      {view.homework && (
        <>
          <p className="rep-label">Practice</p>
          <div className="homework-scope">
            <AnalysisHomework homework={view.homework} showCorrections={false} showBanner={false} />
          </div>
        </>
      )}

      {(view.strengths.length > 0 || view.tips.length > 0) && (
        <>
          <p className="rep-label">Also worth knowing</p>
          <div className="rep-notes">
            {view.strengths.slice(0, 2).map((s, i) => (
              <p key={`s${i}`} className="rep-note"><span className="rep-note-mark good">+</span>{s}</p>
            ))}
            {view.tips.slice(0, 2).map((t, i) => (
              <p key={`t${i}`} className="rep-note"><span className="rep-note-mark">→</span>{t}</p>
            ))}
          </div>
        </>
      )}

      {view.vocabulary.length > 0 && (
        <>
          <p className="rep-label">Words to reuse</p>
          <div className="rep-words">
            {view.vocabulary.map((v, i) => (
              <div className="rep-word" key={i}>
                <p className="rep-word-w">{v.word}</p>
                <p className="rep-word-e">{v.example}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* What you actually said. Nothing in the report can be checked without
          it, and a learner who disagrees with a correction deserves to see the
          sentence it came from. */}
      {analysis.transcript && (
        <>
          <button className="rep-toggle" type="button" onClick={() => setShowTranscript((v) => !v)}>
            {showTranscript ? 'Hide what you said' : 'Show what you said'}
          </button>
          {showTranscript && <p className="rep-transcript">{analysis.transcript}</p>}
        </>
      )}

      {view.reportMarkdown && (
        <>
          <button className="rep-toggle" type="button" onClick={() => setShowNotes((v) => !v)}>
            {showNotes ? 'Hide full notes' : 'Show full notes'}
          </button>
          {showNotes && (
            <div className="analysis-doc-card rep-notes-full">
              <ReactMarkdown components={mdComponents}>{view.reportMarkdown}</ReactMarkdown>
            </div>
          )}
        </>
      )}
    </div>
  );
}
