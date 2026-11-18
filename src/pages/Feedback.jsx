import React, { useRef, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bug, Lightbulb, MessageCircle, ImagePlus, X, Check } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { db } from '../firebase';
import { Button, Card } from '../components/ui';
import { APP_VERSION } from '../version';
import {
  FEEDBACK_TYPES, FEEDBACK_TEXT_MAX, buildFeedbackDoc, canSendFeedback, shrinkScreenshot,
} from '../utils/feedback';
import './Feedback.css';

const TYPE_ICONS = { problem: Bug, idea: Lightbulb, other: MessageCircle };
const PLACEHOLDER = {
  problem: 'What happened, and on which screen?',
  idea: 'What would make SpeakLab better for you?',
  other: 'Write your message',
};

// Profile → Help & feedback. Reached only from Profile — never a popup.
// Rules: docs/domain/app-screens.md «Help & feedback».
export default function Feedback({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const fileRef = useRef(null);
  const [type, setType] = useState('problem');
  const [text, setText] = useState('');
  const [shot, setShot] = useState(null);
  const [shotNote, setShotNote] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error

  const back = () => navigate('/profile');

  const pickShot = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setShotNote('');
    const data = await shrinkScreenshot(file);
    if (data) setShot(data);
    else setShotNote('That picture could not be added. Try another one.');
  };

  const send = async () => {
    if (!canSendFeedback(text) || state === 'sending') return;
    setState('sending');
    try {
      const data = buildFeedbackDoc({
        uid: user.uid,
        type,
        text,
        appVersion: APP_VERSION,
        platform: Capacitor.getPlatform(),
        // The screen the learner came from (Profile passes its own path).
        route: location.state?.from || '/profile',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        screenshot: shot,
      });
      await addDoc(collection(db, 'feedback'), { ...data, createdAt: serverTimestamp() });
      setState('sent');
    } catch (err) {
      console.error('[feedback] send failed', err);
      setState('error');
    }
  };

  return (
    <div className="fb-page">
      <header className="fb-head">
        <Button variant="ghost" size="sm" iconOnly aria-label="Back to Profile" onClick={back} icon={<ArrowLeft size={20} />} />
        <h1 className="fb-title">Help &amp; feedback</h1>
      </header>

      {state === 'sent' ? (
        <Card padding="lg" className="fb-done">
          <span className="fb-done-mark" aria-hidden="true"><Check size={22} strokeWidth={2.25} /></span>
          <h2 className="fb-done-title">Thank you — it is sent</h2>
          <p className="fb-sub">Every message is read by the SpeakLab team.</p>
          <Button variant="primary" full onClick={back}>Back to Profile</Button>
        </Card>
      ) : (
        <>
          <p className="fb-sub">Tell us about a problem, an idea or anything else. Every message is read.</p>

          <div className="fb-types" role="radiogroup" aria-label="Type of message">
            {FEEDBACK_TYPES.map((t) => {
              const Icon = TYPE_ICONS[t.id];
              const on = type === t.id;
              return (
                <button key={t.id} type="button" role="radio" aria-checked={on}
                  className={`fb-type ${on ? 'is-on' : ''}`} onClick={() => setType(t.id)}>
                  <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <label className="fb-label" htmlFor="fb-text">Your message</label>
          <textarea
            id="fb-text"
            className="fb-text"
            rows={6}
            maxLength={FEEDBACK_TEXT_MAX}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER[type]}
          />

          <div className="fb-shot">
            {shot ? (
              <div className="fb-shot-preview">
                <img src={shot} alt="Attached screenshot" />
                <button type="button" className="fb-shot-remove" aria-label="Remove screenshot" onClick={() => setShot(null)}>
                  <X size={16} />
                </button>
              </div>
            ) : (
              <Button variant="secondary" size="sm" icon={<ImagePlus size={16} />} onClick={() => fileRef.current?.click()}>
                Add a screenshot
              </Button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickShot} />
            {!shot && <span className="fb-hint">Optional</span>}
          </div>
          {shotNote && <p className="fb-error" role="status">{shotNote}</p>}

          {state === 'error' && <p className="fb-error" role="alert">It did not send. Check your connection and try again.</p>}

          <Button variant="primary" full disabled={!canSendFeedback(text) || state === 'sending'} onClick={send}>
            {state === 'sending' ? 'Sending…' : 'Send'}
          </Button>
        </>
      )}
    </div>
  );
}
