import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

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
          color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer'
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
        color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer'
      }}>Bağla</button>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg-primary)',
      overflowY: 'auto', zIndex: 9999,
      padding: '20px 16px 40px',
      height: '100dvh',
      WebkitOverflowScrolling: 'touch'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8 }}>
          Zəng Analizi 🎓
        </p>
        <div style={{
          width: 90, height: 90, borderRadius: '50%',
          background: scoreColor(analysis.overallScore),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px'
        }}>
          <span style={{ color: '#fff', fontSize: 28, fontWeight: 800 }}>
            {analysis.overallScore}
          </span>
        </div>
        <p style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, margin: 0 }}>
          {analysis.encouragement}
        </p>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { label: 'Fluency', value: `${analysis.fluencyScore}/100` },
          { label: 'Sürət', value: analysis.speakingPace?.wpm ? `${analysis.speakingPace.wpm} wpm` : '—' },
          { label: 'Vocab', value: `${analysis.vocabularyUsed?.length || 0} söz` },
        ].map((s, i) => (
          <div key={i} style={{
            flex: 1, background: 'var(--bg-card)', borderRadius: 12,
            padding: '12px 8px', textAlign: 'center',
            border: '1px solid var(--border)'
          }}>
            <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>
              {s.value}
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 11, margin: 0 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Grammar Fixes */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
          Qrammatika Düzəlişləri ✏️
        </p>
        {!analysis.grammarFixes?.length ? (
          <p style={{ color: 'var(--success)', fontSize: 14 }}>Xəta tapılmadı! Əla qrammatika ✅</p>
        ) : analysis.grammarFixes.map((fix, i) => (
          <div key={i} style={{
            background: 'var(--bg-card)', borderRadius: 12,
            padding: '10px 12px', marginBottom: 8,
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ background: 'var(--danger-bg)', color: 'var(--danger-fg)', borderRadius: 6, padding: '2px 8px', fontSize: 13, fontWeight: 600 }}>
                {fix.original}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>→</span>
              <span style={{ background: 'var(--success-bg)', color: 'var(--success-fg)', borderRadius: 6, padding: '2px 8px', fontSize: 13, fontWeight: 600 }}>
                {fix.corrected}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: 0 }}>{fix.why || fix.explanation}</p>
          </div>
        ))}
      </div>

      {/* Vocabulary */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
          Günün Sözləri 📘
          {analysis.idiomBonus && (
            <span style={{ marginLeft: 8, background: 'var(--success-bg)', color: 'var(--success-fg)', borderRadius: 20, padding: '2px 10px', fontSize: 12 }}>
              🎉 İdiom Bonusu!
            </span>
          )}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {analysis.vocabularyUsed?.length ? (
            analysis.vocabularyUsed.map((word, i) => (
              <span key={i} style={{ background: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 600 }}>
                {word}
              </span>
            ))
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Günün sözlərindən istifadə edilmədi</p>
          )}
        </div>

        {/* Recommended vocabulary */}
        {analysis.vocabularySuggestions?.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
              Tövsiyə olunan sözlər ✨
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {analysis.vocabularySuggestions.map((v, i) => (
                <div key={i} style={{
                  background: 'var(--bg-card)', borderRadius: 12,
                  padding: '10px 12px', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap'
                }}>
                  <span style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 700 }}>{v.word}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>— {v.meaning}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Suggestions — example sentences */}
      {analysis.exampleSentences?.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
            Nümunə Cümlələr 💡
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {analysis.exampleSentences.map((s, i) => (
              <div key={i} style={{
                background: 'var(--bg-card)', borderRadius: 12,
                padding: '10px 12px', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.5
              }}>
                “{s}”
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transcript */}
      {analysis.transcript && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
            Danışıq Xülasəsi 📝
          </p>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
              {analysis.transcript}
            </p>
          </div>
        </div>
      )}

      {/* Done button */}
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
