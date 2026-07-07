import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { Clock, ChevronLeft } from 'lucide-react';
import GuidedTour from '../components/GuidedTour';

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
      try {
        const q = query(
          collection(db, 'callAnalysis'),
          where('userId', '==', user.uid),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
        const snap = await getDocs(q);
        const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort descending locally because Firestore requires a composite index if we mix where and orderBy
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

  const scoreColor = (s) => s >= 80 ? '#16a34a' : s >= 60 ? '#f59e0b' : '#dc2626';

  if (selectedAnalysis) {
    return <AnalysisDetail analysis={selectedAnalysis} onClose={() => setSelectedAnalysis(null)} />;
  }

  return (
    <div className="history-page" style={{ padding: '20px 16px', paddingBottom: '100px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={() => navigate('/profile')} style={{ background: 'none', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 0 }}>
          <ChevronLeft size={24} />
        </button>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: '0 0 0 16px' }}>Analiz Tarixçəsi</h2>
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
                <div style={{ color: '#fff', fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>
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
                    background: `${scoreColor(call.overallScore)}22`,
                    color: scoreColor(call.overallScore),
                    padding: '8px 12px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '18px'
                  }}>
                    {call.overallScore}
                  </div>
                ) : call.error ? (
                   <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 700 }}>Xəta</div>
                ) : null}
                <button
                  id={idx === 0 ? "tour-analyze" : undefined}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedAnalysis(call);
                  }}
                  style={{
                    border: '1px solid rgba(124, 111, 247, 0.35)',
                    background: 'rgba(124, 111, 247, 0.12)',
                    color: '#a5b4fc',
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
  const scoreColor = (s) => s >= 80 ? '#16a34a' : s >= 60 ? '#f59e0b' : '#dc2626';

  if (analysis.error) return (
    <div style={{ padding: 20, background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', marginBottom: 20, display: 'flex', alignItems: 'center', cursor: 'pointer' }}><ChevronLeft size={24}/> Geri</button>
      <div style={{ fontSize: 48, marginBottom: 16, textAlign: 'center' }}>❌</div>
      <p style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, textAlign: 'center' }}>Sistem Xətası</p>
      <p style={{ color: '#ef4444', fontSize: 13, marginTop: 12, textAlign: 'center', background: '#fee2e2', padding: 12, borderRadius: 8 }}>{analysis.error}</p>
    </div>
  );

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', padding: '20px 16px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 0 }}>
          <ChevronLeft size={24} />
        </button>
        <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', margin: '0 0 0 16px' }}>Analiz Nəticəsi</h2>
      </div>

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 16, textAlign: 'center' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 4 }}>Ümumi Bal</div>
          <div style={{ color: scoreColor(analysis.overallScore), fontSize: 32, fontWeight: 800 }}>{analysis.overallScore || 0}</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 16, textAlign: 'center' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 4 }}>Axıcılıq</div>
          <div style={{ color: scoreColor(analysis.fluencyScore), fontSize: 32, fontWeight: 800 }}>{analysis.fluencyScore || 0}</div>
        </div>
      </div>

      {analysis.encouragement && (
        <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 16, marginBottom: 24 }}>
          <p style={{ color: 'var(--text-primary)', fontSize: 14, margin: 0, fontStyle: 'italic', display: 'flex', gap: 8 }}>
            <span>💡</span> {analysis.encouragement}
          </p>
        </div>
      )}

      {analysis.speakingPace?.wpm > 0 && (
        <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 16, marginBottom: 24, textAlign: 'center' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Danışıq sürəti: </span>
          <span style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700 }}>
            {analysis.speakingPace.wpm} wpm ({analysis.speakingPace.label})
          </span>
        </div>
      )}

      {/* Grammar Fixes */}
      <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Qrammatika Səhvləri</h3>
      {analysis.grammarFixes && analysis.grammarFixes.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {analysis.grammarFixes.map((item, idx) => (
            <div key={idx} style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 16 }}>
              <div style={{ color: '#ef4444', fontSize: 14, textDecoration: 'line-through', marginBottom: 4 }}>{item.original}</div>
              <div style={{ color: '#10b981', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{item.corrected}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, background: 'rgba(255,255,255,0.05)', padding: 8, borderRadius: 8 }}>{item.why}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 16, textAlign: 'center', color: '#10b981', fontWeight: 700, marginBottom: 32 }}>
          Xəta tapılmadı! 🎉
        </div>
      )}

      {/* Vocabulary */}
      <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 16 }}>İstifadə edilən Sözlər</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
        {analysis.vocabularyUsed && analysis.vocabularyUsed.length > 0 ? (
          analysis.vocabularyUsed.map((word, idx) => (
            <span key={idx} style={{ background: 'var(--accent)', color: '#fff', padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
              {word}
            </span>
          ))
        ) : (
          <span style={{ color: 'var(--text-secondary)' }}>Lüğət tapılmadı.</span>
        )}
      </div>

      {analysis.vocabularySuggestions && analysis.vocabularySuggestions.length > 0 && (
        <>
          <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Tövsiyə olunan Sözlər</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
            {analysis.vocabularySuggestions.map((v, idx) => (
              <div key={idx} style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <span style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 700 }}>{v.word}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>— {v.meaning}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {analysis.exampleSentences && analysis.exampleSentences.length > 0 && (
        <>
          <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Nümunə Cümlələr</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
            {analysis.exampleSentences.map((s, idx) => (
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
