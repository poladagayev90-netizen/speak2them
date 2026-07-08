import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { Clock, ChevronLeft } from 'lucide-react';
import GuidedTour from '../components/GuidedTour';
import { toAnalysisView, analysisErrorMessage } from '../utils/analysisView';

const PROFILE_TOUR_STEPS = [
  {
    target: '#tour-analyze',
    title: 'Analyze Data',
    content: 'Zəngdən sonra qrammatika, söz seçimi və ümumi nəticənizə buradan baxa bilərsiniz.',
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
    return <AnalysisDetail analysis={selectedAnalysis} onClose={() => setSelectedAnalysis(null)} />;
  }

  return (
    <div className="history-page" style={{ padding: '20px 16px', paddingBottom: '100px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={() => navigate('/profile')} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 0 }}>
          <ChevronLeft size={24} />
        </button>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0 16px' }}>Analiz Tarixçəsi</h2>
      </div>

      <GuidedTour user={user} steps={PROFILE_TOUR_STEPS} tourKey="tourDone_profile" />

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>Yüklənir...</div>
      ) : history.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '60px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📊</div>
          <p style={{ color: 'var(--text-secondary)' }}>Hələ heç bir analiz tarixçəniz yoxdur.</p>
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
                  {call.durationSeconds ? `${Math.floor(call.durationSeconds/60)}m ${call.durationSeconds%60}s` : 'Naməlum'} 
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
                   <div style={{ color: 'var(--danger)', fontSize: '12px', fontWeight: 700 }}>Xəta</div>
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
                  Analyze Data
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalysisDetail({ analysis, onClose }) {
  // Rendered as large text on a theme surface, so these follow the theme.
  const scoreColor = (s) => (s >= 80 ? 'var(--success)' : s >= 60 ? 'var(--warning)' : 'var(--danger)');

  if (analysis.error) return (
    <div style={{ padding: 20, background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', marginBottom: 20, display: 'flex', alignItems: 'center', cursor: 'pointer' }}><ChevronLeft size={24}/> Geri</button>
      <div style={{ fontSize: 48, marginBottom: 16, textAlign: 'center' }}>❌</div>
      <p style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, textAlign: 'center' }}>Analiz alınmadı</p>
      <p style={{ color: 'var(--danger-fg)', fontSize: 13, marginTop: 12, textAlign: 'center', background: 'var(--danger-bg)', padding: 12, borderRadius: 8 }}>
        {analysisErrorMessage(analysis.error)}
      </p>
    </div>
  );

  // Old and new analysis documents share one view model.
  const view = toAnalysisView(analysis);
  const tiles = [
    { label: 'Ümumi Bal', value: view.overallScore },
    { label: 'Axıcılıq', value: view.scores.fluency },
    { label: 'Qrammatika', value: view.scores.grammar },
    { label: 'Lüğət', value: view.scores.vocabulary },
  ].filter((t) => Number.isFinite(t.value));

  const h3 = { color: 'var(--text-primary)', fontSize: 18, fontWeight: 800, marginBottom: 16 };
  const panel = { background: 'var(--bg-secondary)', padding: 16, borderRadius: 16 };

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', padding: '20px 16px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 0 }}>
          <ChevronLeft size={24} />
        </button>
        <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0 16px' }}>Analiz Nəticəsi</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        {tiles.map((t) => (
          <div key={t.label} style={{ ...panel, textAlign: 'center' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 4 }}>{t.label}</div>
            <div style={{ color: scoreColor(t.value), fontSize: 32, fontWeight: 800 }}>{t.value}</div>
          </div>
        ))}
      </div>

      {view.recap && (
        <div style={{ ...panel, marginBottom: 24 }}>
          <p style={{ color: 'var(--text-primary)', fontSize: 14, margin: 0, display: 'flex', gap: 8, lineHeight: 1.5 }}>
            <span>📝</span> {view.recap}
          </p>
        </div>
      )}

      {view.speakingPace?.wpm > 0 && (
        <div style={{ ...panel, marginBottom: 24, textAlign: 'center' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Danışıq sürəti: </span>
          <span style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700 }}>
            {view.speakingPace.wpm} wpm ({view.speakingPace.label})
          </span>
        </div>
      )}

      <h3 style={h3}>Səhvlər</h3>
      {view.feedback.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {view.feedback.map((item, idx) => (
            <div key={idx} style={panel}>
              <div style={{ color: 'var(--danger)', fontSize: 14, textDecoration: 'line-through', marginBottom: 4 }}>{item.original}</div>
              <div style={{ color: 'var(--success)', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{item.corrected}</div>
              {item.reason && (
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, background: 'var(--bg-card)', padding: 8, borderRadius: 8 }}>{item.reason}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...panel, textAlign: 'center', color: 'var(--success)', fontWeight: 700, marginBottom: 32 }}>
          Real qrammatik səhv tapılmadı! 🎉
        </div>
      )}

      {view.strengths.length > 0 && (
        <>
          <h3 style={h3}>Güclü tərəflərin</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
            {view.strengths.map((s, idx) => (
              <div key={idx} style={{ background: 'var(--success-bg)', color: 'var(--success-fg)', padding: 12, borderRadius: 12, fontSize: 13, lineHeight: 1.5 }}>{s}</div>
            ))}
          </div>
        </>
      )}

      {view.tips.length > 0 && (
        <>
          <h3 style={h3}>Tövsiyələr</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
            {view.tips.map((t, idx) => (
              <div key={idx} style={{ ...panel, display: 'flex', gap: 8, color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.5 }}>
                <span style={{ color: 'var(--accent)', fontWeight: 800 }}>{idx + 1}.</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {view.vocabulary.length > 0 && (
        <>
          <h3 style={h3}>Lüğət</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
            {view.vocabulary.map((v, idx) => (
              <div key={idx} style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 12 }}>
                <div style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{v.word}</div>
                {v.example && <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>{v.example}</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {view.legacyVocabularyUsed.length > 0 && (
        <>
          <h3 style={h3}>İstifadə edilən Sözlər</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
            {view.legacyVocabularyUsed.map((word, idx) => (
              <span key={idx} style={{ background: 'var(--accent)', color: 'var(--text-on-accent)', padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                {word}
              </span>
            ))}
          </div>
        </>
      )}

      {view.legacyExamples.length > 0 && (
        <>
          <h3 style={h3}>Nümunə Cümlələr</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
            {view.legacyExamples.map((s, idx) => (
              <div key={idx} style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 12, color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.5 }}>
                “{s}”
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
