import React, { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';

const LEVELS = [
  'A1 – Beginner', 'A2 – Elementary', 'B1 – Intermediate',
  'B2 – Upper-Intermediate', 'C1 – Advanced', 'C2 – Proficient'
];

const GOALS = [
  { value: 'Speaking', label: '🗣️ Speaking practice' },
  { value: 'Business', label: '💼 Business English' },
  { value: 'Exam', label: '📚 Exam preparation' },
  { value: 'Travel', label: '✈️ Travel English' },
  { value: 'Fun', label: '🎮 Just for fun' },
];

// Sorğu QƏSDƏN qısadır: əsas siqnal dil səviyyəsidir. Vaxt/sessiya-uzunluğu/
// partnyor-seçimi bölmələri çıxarılıb — cavabları onsuz da default-larla
// əvəzlənirdi və matching onlara 'Any'/'Evening' fallback-ları ilə baxır.
const TOPICS = [
  { value: 'Technology', label: '💻 Technology' },
  { value: 'Movies', label: '🎬 Movies' },
  { value: 'Music', label: '🎵 Music' },
  { value: 'Travel', label: '✈️ Travel' },
  { value: 'Business', label: '💼 Business' },
  { value: 'Sport', label: '⚽ Sport' },
  { value: 'General', label: '💬 General talk' },
];

export default function Survey({ user }) {
  const navigate = useNavigate();

  const [level, setLevel] = useState('');
  const [goal, setGoal] = useState('');
  const [topics, setTopics] = useState([]);
  const [saving, setSaving] = useState(false);

  const currentUser = auth.currentUser || user;

  const toggleItem = (value, list, setList, max = 99) => {
    if (list.includes(value)) {
      setList(list.filter(item => item !== value));
      return;
    }

    if (list.length >= max) {
      alert(`Maksimum ${max} seçim edə bilərsən.`);
      return;
    }

    setList([...list, value]);
  };

  const saveSurvey = async (skipAll = false) => {
    if (!currentUser?.uid) {
      navigate('/login');
      return;
    }

    setSaving(true);

    try {
      const surveyData = skipAll
        ? {
            level: 'B1 – Intermediate',
            goal: 'Speaking',
            availableTimes: ['Evening'],
            topics: ['General'],
            sessionLength: '15-30',
            partnerPreference: 'Any',
            surveySkipped: true,
            surveyDone: true,
            surveyUpdatedAt: serverTimestamp(),
          }
        : {
            level: level || 'B1 – Intermediate',
            goal: goal || 'Speaking',
            // Çıxarılmış bölmələrin default-ları — matching bu sahələri oxuyur.
            availableTimes: ['Evening'],
            topics: topics.length > 0 ? topics : ['General'],
            sessionLength: '15-30',
            partnerPreference: 'Any',
            surveySkipped: false,
            surveyDone: true,
            surveyUpdatedAt: serverTimestamp(),
          };

      await setDoc(doc(db, 'users', currentUser.uid), surveyData, { merge: true });

      window.location.href = '/';
    } catch (err) {
      alert('Survey yadda saxlanmadı. Zəhmət olmasa yenidən yoxla.');
      setSaving(false);
    }
  };

  const optionButtonStyle = (active) => ({
    width: '100%',
    border: active ? '1px solid #7c6ff7' : '1px solid #2e2e50',
    background: active ? 'linear-gradient(135deg, #7c6ff733, #5b4de833)' : '#151520',
    color: active ? '#ffffff' : '#d1d5db',
    padding: '12px 14px',
    borderRadius: '14px',
    fontSize: '14px',
    fontWeight: active ? 700 : 500,
    textAlign: 'left',
    cursor: 'pointer',
    marginBottom: '8px',
    boxShadow: active ? '0 0 12px #7c6ff733' : 'none',
  });

  const sectionStyle = {
    marginTop: '22px',
  };

  const sectionTitleStyle = {
    fontSize: '15px',
    fontWeight: 800,
    marginBottom: '10px',
    color: '#ffffff',
  };

  const hintStyle = {
    fontSize: '12px',
    color: '#888',
    marginTop: '-4px',
    marginBottom: '10px',
  };

  return (
    <div className="auth-page" style={{ alignItems: 'flex-start', padding: '40px 16px', overflowY: 'auto' }}>
      <div className="auth-card" style={{ margin: '0 auto', maxWidth: '400px', width: '100%' }}>
        <div className="auth-logo" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <Logo width={160} />
        </div>

        <h2>Quick Setup</h2>
        <p className="auth-sub">
          Daha uyğun danışıq partnyoru tapmaq üçün 20 saniyəlik seçim et.
        </p>

        {/* Qeydiyyatdan sonrakı ilk ekran budur — kurs kodu olan istifadəçi
            kodu elə buradaca aktivləşdirə bilsin (Profile-da da həmişə var). */}
        <button
          type="button"
          onClick={() => navigate('/redeem')}
          style={{
            width: '100%',
            border: '1px solid #7c6ff755',
            background: 'linear-gradient(135deg, #7c6ff722, #5b4de822)',
            color: '#ffffff',
            padding: '12px',
            borderRadius: '14px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            marginTop: '12px',
          }}
        >
          🎟️ Kurs kodunuz var? Aktivləşdirin
        </button>

        <button
          type="button"
          onClick={() => saveSurvey(true)}
          disabled={saving}
          style={{
            width: '100%',
            border: '1px solid #2e2e50',
            background: '#151520',
            color: '#aaa',
            padding: '12px',
            borderRadius: '14px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            marginTop: '12px',
            marginBottom: '8px',
          }}
        >
          {saving ? 'Saving...' : 'Skip All — later'}
        </button>

        <div style={sectionStyle}>
          <p style={sectionTitleStyle}>📈 What is your English level?</p>
          
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate('/placement')}
            style={{ width: '100%', marginBottom: '16px', background: 'linear-gradient(135deg, #7c6ff7, #5b4de8)' }}
          >
            🎯 Take a Quick Placement Test (Recommended)
          </button>
          
          <p style={hintStyle}>Or select your level manually if you already know it:</p>

          {LEVELS.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setLevel(item)}
              style={optionButtonStyle(level === item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div style={sectionStyle}>
          <p style={sectionTitleStyle}>🎯 What is your main goal?</p>
          {GOALS.map(item => (
            <button
              key={item.value}
              type="button"
              onClick={() => setGoal(item.value)}
              style={optionButtonStyle(goal === item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div style={sectionStyle}>
          <p style={sectionTitleStyle}>💬 Favorite conversation topics</p>
          <p style={hintStyle}>Maksimum 3 mövzu seç.</p>
          {TOPICS.map(item => (
            <button
              key={item.value}
              type="button"
              onClick={() => toggleItem(item.value, topics, setTopics, 3)}
              style={optionButtonStyle(topics.includes(item.value))}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={() => saveSurvey(false)}
          disabled={saving}
          style={{
            marginTop: '24px',
          }}
        >
          {saving ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}