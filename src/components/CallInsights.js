import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export default function CallInsights({ userId, channelName, onClose }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docId = `${userId}_${channelName}`;
    const unsub = onSnapshot(doc(db, 'callAnalysis', docId), (snap) => {
      if (snap.exists()) {
        setAnalysis(snap.data());
        setLoading(false);
      }
    });
    // Timeout after 60s if Gemini doesn't respond
    const timeout = setTimeout(() => setLoading(false), 60000);
    return () => { unsub(); clearTimeout(timeout); };
  }, [userId, channelName]);

  const scoreColor = (s) => s >= 80 ? '#16a34a' : s >= 60 ? '#f59e0b' : '#dc2626';

  if (loading) return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🎓</div>
      <p style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700 }}>
        Analiz edilir...
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>
        Gemini AI danışığınızı yoxlayır
      </p>
    </div>
  );

  if (!analysis) return (
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
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
        Zəng çox qısa ola bilər və ya mikrofon işləməyib.
      </p>
      <button onClick={onClose} style={{
        marginTop: 24, width: '100%', maxWidth: 320, height: 52,
        borderRadius: 16, border: 'none', background: 'var(--accent)',
        color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer'
      }}>Bağla</button>
    </div>
  );

  if (analysis.error) return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 20
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
      <p style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, textAlign: 'center' }}>
        Sistem Xətası
      </p>
      <p style={{ color: '#ef4444', fontSize: 13, marginTop: 12, textAlign: 'center', background: '#fee2e2', padding: 12, borderRadius: 8, wordBreak: 'break-word', maxWidth: 300 }}>
        {analysis.error}
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
      padding: '20px 16px 40px'
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
          { label: 'Danışıq', value: `${analysis.talkRatio}%` },
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
          <p style={{ color: '#16a34a', fontSize: 14 }}>Xəta tapılmadı! Əla qrammatika ✅</p>
        ) : analysis.grammarFixes.map((fix, i) => (
          <div key={i} style={{
            background: 'var(--bg-card)', borderRadius: 12,
            padding: '10px 12px', marginBottom: 8,
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 6, padding: '2px 8px', fontSize: 13, fontWeight: 600 }}>
                {fix.original}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>→</span>
              <span style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 6, padding: '2px 8px', fontSize: 13, fontWeight: 600 }}>
                {fix.corrected}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: 0 }}>{fix.explanation}</p>
          </div>
        ))}
      </div>

      {/* Vocabulary */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
          Günün Sözləri 📘
          {analysis.idiomBonus && (
            <span style={{ marginLeft: 8, background: '#dcfce7', color: '#16a34a', borderRadius: 20, padding: '2px 10px', fontSize: 12 }}>
              🎉 İdiom Bonusu!
            </span>
          )}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {analysis.vocabularyUsed?.length ? (
            analysis.vocabularyUsed.map((word, i) => (
              <span key={i} style={{ background: 'var(--accent)', color: '#fff', borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 600 }}>
                {word}
              </span>
            ))
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Günün sözlərindən istifadə edilmədi</p>
          )}
        </div>
      </div>

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
        background: 'var(--accent)', color: '#fff',
        fontSize: 16, fontWeight: 700, cursor: 'pointer'
      }}>
        Bitti ✓
      </button>
    </div>
  );
}
