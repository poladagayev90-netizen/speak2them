import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Keep in sync with the TOPICS list in src/pages/Survey.js.
const TOPIC_OPTIONS = [
  { value: 'Technology', label: '💻 Technology' },
  { value: 'Movies', label: '🎬 Movies' },
  { value: 'Music', label: '🎵 Music' },
  { value: 'Travel', label: '✈️ Travel' },
  { value: 'Business', label: '💼 Business' },
  { value: 'Sport', label: '⚽ Sport' },
  { value: 'General', label: '💬 General talk' },
];

// One-time interest picker shown to survey-skippers before they join a
// session, so interest-based pairing has something to work with.
export default function TopicPickerModal({ open, uid, onSave, onClose }) {
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const toggle = (value) => {
    setSelected((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      if (prev.length >= 3) return prev;
      return [...prev, value];
    });
  };

  const handleSave = async () => {
    if (!selected.length || saving) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', uid), { topics: selected }, { merge: true });
      onSave(selected);
    } catch (e) {
      console.error('[TopicPicker] save failed:', e);
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500,
      background: 'rgba(10, 10, 20, 0.85)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 360, background: 'var(--bg-card, #17172b)',
        borderRadius: 20, border: '1px solid #7c6ff755', padding: '20px 18px',
      }}>
        <p style={{ color: 'var(--text-primary)', fontSize: 17, fontWeight: 800, margin: '0 0 6px' }}>
          Maraq dairələrini seç 🎯
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 14px' }}>
          Səni oxşar maraqlı tərəfdaşla eşləşdirəcəyik (max 3).
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          {TOPIC_OPTIONS.map((t) => (
            <button
              key={t.value}
              onClick={() => toggle(t.value)}
              style={{
                borderRadius: 20, padding: '8px 14px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
                border: selected.includes(t.value) ? '1px solid #7c6ff7' : '1px solid var(--border, #2e2e50)',
                background: selected.includes(t.value) ? 'linear-gradient(135deg, #7c6ff7, #6355e0)' : 'transparent',
                color: selected.includes(t.value) ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, height: 46, borderRadius: 12, border: '1px solid var(--border, #2e2e50)',
              background: 'transparent', color: 'var(--text-secondary)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            İmtina
          </button>
          <button
            onClick={handleSave}
            disabled={!selected.length || saving}
            style={{
              flex: 2, height: 46, borderRadius: 12, border: 'none',
              background: selected.length ? 'linear-gradient(135deg, #7c6ff7, #6355e0)' : '#3a3a5a',
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: selected.length ? 'pointer' : 'default',
            }}
          >
            {saving ? 'Yadda saxlanır…' : 'Davam et'}
          </button>
        </div>
      </div>
    </div>
  );
}
