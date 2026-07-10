import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { toAnalysisView, analysisErrorMessage } from '../utils/analysisView';

const shellStyle = {
  position: 'fixed', inset: 0,
  background: 'var(--bg-primary)',
  overflowY: 'auto', zIndex: 9999,
  padding: 'calc(20px + var(--safe-area-top, 0px)) 16px 40px',
  height: '100dvh',
  WebkitOverflowScrolling: 'touch',
};

const closeBtnStyle = {
  width: '100%', height: 52, borderRadius: 16, border: 'none',
  background: 'var(--accent)', color: 'var(--text-on-accent)',
  fontSize: 16, fontWeight: 700, cursor: 'pointer',
};

// The one post-call screen. Whatever state the analysis is in, the shell also
// carries the inline peer rating and the opt-in word-quiz button, so a user who
// closes a still-processing analysis has already had the chance to do both.
function InsightsShell({ children, centered, onClose, extras }) {
  return (
    <div style={{
      ...shellStyle,
      ...(centered ? { display: 'flex', flexDirection: 'column', justifyContent: 'center' } : {}),
    }}>
      {children}
      {extras}
      <button onClick={onClose} style={{ ...closeBtnStyle, marginTop: 12 }}>
        Bitti ✓
      </button>
    </div>
  );
}

// Inline star rating — replaces the old separate full-screen rating modal.
function RatingBlock({ peerName, onSubmitRating }) {
  const [selectedStar, setSelectedStar] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (selectedStar === 0 || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await onSubmitRating(selectedStar);
      setDone(true);
    } catch (e) {
      console.error('[CallInsights] Rating error:', e);
      setError('Qiymət göndərilmədi. İnternetini yoxla və yenidən cəhd et.');
    }
    setSubmitting(false);
  };

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '16px 14px', marginTop: 20, textAlign: 'center',
    }}>
      {done ? (
        <p style={{ color: 'var(--success)', fontSize: 15, fontWeight: 700, margin: 0 }}>
          Təşəkkürlər ✓
        </p>
      ) : (
        <>
          <p style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: '0 0 10px' }}>
            {peerName ? `${peerName} ilə zəng necə getdi?` : 'Zəng necə getdi?'}
          </p>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} disabled={submitting} onClick={() => setSelectedStar(star)} style={{
                fontSize: 32, background: 'none', border: 'none',
                cursor: submitting ? 'default' : 'pointer',
                opacity: star <= selectedStar ? 1 : 0.3, transition: 'opacity 0.2s',
              }}>⭐</button>
            ))}
          </div>
          {error && (
            <p style={{ color: 'var(--danger-fg, #ff4757)', fontSize: 13, margin: '0 0 10px' }}>{error}</p>
          )}
          <button
            disabled={selectedStar === 0 || submitting}
            onClick={submit}
            style={{
              width: '100%', padding: 12, border: 'none', borderRadius: 12,
              background: selectedStar > 0 ? 'var(--accent)' : 'var(--border)',
              color: 'var(--text-on-accent)', fontSize: 15, fontWeight: 700,
              cursor: selectedStar > 0 && !submitting ? 'pointer' : 'not-allowed',
              opacity: submitting ? 0.6 : 1,
            }}
          >{submitting ? 'Göndərilir…' : 'Göndər'}</button>
        </>
      )}
    </div>
  );
}

export default function CallInsights({
  userId, channelName, onClose, enqueueFailed = false,
  ratingEnabled = false, peerName = null, onSubmitRating = null,
  quizWordCount = 0, onStartQuiz = null,
}) {
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

  const extras = (
    <>
      {ratingEnabled && onSubmitRating && (
        <RatingBlock peerName={peerName} onSubmitRating={onSubmitRating} />
      )}
      {quizWordCount > 0 && onStartQuiz && (
        <button onClick={onStartQuiz} style={{
          width: '100%', marginTop: 12, padding: 14,
          background: 'rgba(124, 111, 247, 0.15)', color: 'var(--accent)',
          border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}>
          📝 Söz testi ({quizWordCount} söz)
        </button>
      )}
    </>
  );

  // The upload or the ticket write never landed, so nothing will ever produce a
  // result for this call — do not leave the user on the "queued" screen.
  if (enqueueFailed && status === 'uploading') return (
    <InsightsShell centered onClose={onClose} extras={extras}>
      <div style={{ fontSize: 48, marginBottom: 16, textAlign: 'center' }}>📡</div>
      <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, textAlign: 'center' }}>
        Səs yazısı göndərilə bilmədi
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
        İnternet bağlantını yoxla. Bu zəngin analizi hazırlanmayacaq.
      </p>
    </InsightsShell>
  );

  if (status !== 'done' && status !== 'failed') {
    const statusText = status === 'processing'
      ? 'AI danışığınızı yoxlayır…'
      : 'Səs analiziniz növbəyə alındı';
    return (
      <InsightsShell centered onClose={onClose} extras={extras}>
        <div style={{ fontSize: 48, marginBottom: 16, textAlign: 'center' }}>🎓</div>
        <p style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, textAlign: 'center' }}>
          {statusText}
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
          Hazır olduqda burada görünəcək. Gözləmək istəmirsənsə bağlaya bilərsən — nəticə itməyəcək.
        </p>
      </InsightsShell>
    );
  }

  if (status === 'failed') return (
    <InsightsShell centered onClose={onClose} extras={extras}>
      <div style={{ fontSize: 48, marginBottom: 16, textAlign: 'center' }}>⚠️</div>
      <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, textAlign: 'center' }}>
        Analiz alınmadı
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
        {analysisErrorMessage(analysis?.error)}
      </p>
    </InsightsShell>
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
    <InsightsShell onClose={onClose} extras={extras}>
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
    </InsightsShell>
  );
}
