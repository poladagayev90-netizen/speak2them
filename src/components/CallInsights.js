import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { toAnalysisView } from '../utils/analysisView';

export default function CallInsights({ userId, channelName, onClose }) {
  const [analysis, setAnalysis] = useState(null);
  // 'uploading' → doc not written yet; then mirrors callAnalysis.status.
  const [status, setStatus] = useState('uploading');

  useEffect(() => {
    const docId = `${userId}_${channelName}`;
    const unsub = onSnapshot(doc(db, 'callAnalysis', docId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.status === 'failed') {
        setAnalysis(data);
        setStatus('failed');
      } else if (data.status && data.status !== 'done') {
        setStatus(data.status); // queued | processing
      } else {
        setAnalysis(data);
        setStatus('done');
      }
    });
    return () => unsub();
  }, [userId, channelName]);

  // Used as the score circle's FILL with white text on top, so the circle
  // supplies its own background and these stay fixed across themes. The old
  // amber (#f59e0b) gave white only 2.15:1 — effectively unreadable.
  const scoreColor = (s) => (s >= 80 ? '#15803d' : s >= 60 ? '#b45309' : '#b91c1c');

  if (status !== 'done' && status !== 'failed') {
    const statusText = status === 'processing'
      ? 'AI danışığınızı yoxlayır…'
      : 'Səs analiziniz növbəyə alındı';
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'var(--bg-primary)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: 20
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎓</div>
        <p style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, textAlign: 'center' }}>
          {statusText}
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8, textAlign: 'center', maxWidth: 320 }}>
          Hazır olduqda burada görünəcək. Gözləmək istəmirsənsə bağlaya bilərsən — nəticə itməyəcək.
        </p>
        <button onClick={onClose} style={{
          marginTop: 24, width: '100%', maxWidth: 320, height: 52,
          borderRadius: 16, border: 'none', background: 'var(--accent)',
          color: 'var(--text-on-accent)', fontSize: 16, fontWeight: 700, cursor: 'pointer'
        }}>Bağla</button>
      </div>
    );
  }

  if (status === 'failed') return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 20
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, textAlign: 'center' }}>
        Analiz alınmadı
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8, textAlign: 'center', maxWidth: 320 }}>
        {analysis?.error?.startsWith?.('no-speech')
          ? 'Danışıq eşidilmədi — zəng çox qısa ola bilər və ya mikrofon işləməyib.'
          : 'Texniki xəta baş verdi, komanda məlumatlandırıldı.'}
      </p>
      <button onClick={onClose} style={{
        marginTop: 24, width: '100%', maxWidth: 320, height: 52,
        borderRadius: 16, border: 'none', background: 'var(--accent)',
        color: 'var(--text-on-accent)', fontSize: 16, fontWeight: 700, cursor: 'pointer'
      }}>Bağla</button>
    </div>
  );

  // Old and new documents both come through the adapter, so this view never has
  // to know which shape it was handed.
  const view = toAnalysisView(analysis);

  // Older analyses only recorded a fluency score; hide the tiles they lack
  // rather than printing a misleading 0.
  const scoreTiles = [
    { label: 'Axıcılıq', value: view.scores.fluency },
    { label: 'Qrammatika', value: view.scores.grammar },
    { label: 'Lüğət', value: view.scores.vocabulary },
  ].filter((t) => Number.isFinite(t.value));

  const sectionTitle = {
    color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, marginBottom: 10,
  };
  const card = {
    background: 'var(--bg-card)', borderRadius: 12,
    padding: '10px 12px', marginBottom: 8, border: '1px solid var(--border)',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg-primary)',
      overflowY: 'auto', zIndex: 9999,
      padding: '20px 16px 40px',
      height: '100dvh',
      WebkitOverflowScrolling: 'touch'
    }}>
      {/* SCORE */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8 }}>Zəng Analizi 🎓</p>
        <div style={{
          width: 90, height: 90, borderRadius: '50%',
          background: scoreColor(view.overallScore),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px'
        }}>
          <span style={{ color: '#fff', fontSize: 28, fontWeight: 800 }}>{view.overallScore}</span>
        </div>
        {view.recap && (
          <p style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, margin: 0, lineHeight: 1.4 }}>
            {view.recap}
          </p>
        )}
      </div>

      {scoreTiles.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {scoreTiles.map((s) => (
            <div key={s.label} style={{
              flex: 1, background: 'var(--bg-card)', borderRadius: 12,
              padding: '12px 8px', textAlign: 'center', border: '1px solid var(--border)'
            }}>
              <p style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>{s.value}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 11, margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {view.speakingPace?.wpm > 0 && (
        <div style={{ ...card, textAlign: 'center', marginBottom: 24 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Danışıq sürəti: </span>
          <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}>
            {view.speakingPace.wpm} wpm ({view.speakingPace.label})
          </span>
        </div>
      )}

      {/* MISTAKES */}
      <div style={{ marginBottom: 24 }}>
        <p style={sectionTitle}>Səhvlər ✏️</p>
        {!view.feedback.length ? (
          <p style={{ color: 'var(--success)', fontSize: 14 }}>Real qrammatik səhv tapılmadı ✅</p>
        ) : view.feedback.map((fix, i) => (
          <div key={i} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ background: 'var(--danger-bg)', color: 'var(--danger-fg)', borderRadius: 6, padding: '2px 8px', fontSize: 13, fontWeight: 600 }}>
                {fix.original}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>→</span>
              <span style={{ background: 'var(--success-bg)', color: 'var(--success-fg)', borderRadius: 6, padding: '2px 8px', fontSize: 13, fontWeight: 600 }}>
                {fix.corrected}
              </span>
            </div>
            {fix.reason && <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: 0 }}>{fix.reason}</p>}
          </div>
        ))}
      </div>

      {/* STRENGTHS */}
      {view.strengths.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={sectionTitle}>Güclü tərəflərin 💪</p>
          {view.strengths.map((s, i) => (
            <div key={i} style={{
              background: 'var(--success-bg)', color: 'var(--success-fg)', borderRadius: 12,
              padding: '10px 12px', marginBottom: 8, fontSize: 13, lineHeight: 1.5
            }}>{s}</div>
          ))}
        </div>
      )}

      {/* TIPS */}
      {view.tips.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={sectionTitle}>Tövsiyələr 💡</p>
          {view.tips.map((t, i) => (
            <div key={i} style={{ ...card, display: 'flex', gap: 8, color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.5 }}>
              <span style={{ color: 'var(--accent)', fontWeight: 800 }}>{i + 1}.</span>
              <span>{t}</span>
            </div>
          ))}
        </div>
      )}

      {/* VOCABULARY */}
      {view.vocabulary.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={sectionTitle}>Lüğət 📘</p>
          {view.vocabulary.map((v, i) => (
            <div key={i} style={card}>
              <p style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>{v.word}</p>
              {v.example && (
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>{v.example}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Words the learner used — only older analyses recorded these. */}
      {view.legacyVocabularyUsed.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={sectionTitle}>İşlətdiyin sözlər</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {view.legacyVocabularyUsed.map((word, i) => (
              <span key={i} style={{ background: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 600 }}>
                {word}
              </span>
            ))}
          </div>
        </div>
      )}

      {view.transcript && (
        <div style={{ marginBottom: 24 }}>
          <p style={sectionTitle}>Danışıq Xülasəsi 📝</p>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{view.transcript}</p>
          </div>
        </div>
      )}

      <button onClick={onClose} style={{
        width: '100%', height: 52, borderRadius: 16, border: 'none',
        background: 'var(--accent)', color: 'var(--text-on-accent)',
        fontSize: 16, fontWeight: 700, cursor: 'pointer'
      }}>
        Bitti ✓
      </button>
    </div>
  );
}
