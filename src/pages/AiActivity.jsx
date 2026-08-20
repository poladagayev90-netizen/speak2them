import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { auth } from '../firebase';
import { FUNCTIONS_BASE } from '../constants';
import { getTodayContent } from '../data/weeklyContent';
import { fetchTopicImages } from '../utils/fetchTopicImages';
import useAinurTurn from '../hooks/useAinurTurn';
import AiDescribeStage from '../components/ai/AiDescribeStage';
import MicButton from '../components/ai/MicButton';
import Button from '../components/ui/Button';
import '../components/ai/ai.css';

// A describing session with AInur: five pictures, two exchanges each, about
// eight minutes. Ends with the same analysis a human call produces, which is
// what reaches the teacher.
//
// Why this activity first: the content already exists. topicImages.js holds 360
// reviewed photographs, each with keywords taken from the photograph itself and
// two questions written for it. Nothing new had to be authored.
const PICTURES_PER_SESSION = 5;
const TURNS_PER_PICTURE = 2;

// AInur asks the same opening question on every picture, so it is written here
// rather than generated. That is not a shortcut: a fixed opener costs no tokens
// and no speech synthesis, and it keeps her voice for the part that has to be
// live — reacting to what the learner actually said.
const OPENERS = [
  'Look at this picture. What is happening in it?',
  'Tell me what you can see here.',
  'Describe this picture for me. What is going on?',
];

export default function AiActivity({ user }) {
  const navigate = useNavigate();
  const { status, level, error, elapsedMs, startRecording, stopRecording, send, setError } = useAinurTurn();

  const [images, setImages] = useState([]);
  const [picIndex, setPicIndex] = useState(0);
  const [turnIndex, setTurnIndex] = useState(0);
  const [hits, setHits] = useState([]);       // keywords said, this picture
  const [heard, setHeard] = useState('');
  const [reply, setReply] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [done, setDone] = useState(null);     // null | 'analyzing' | 'ready' | 'short'

  const content = useMemo(() => getTodayContent(), []);
  // One id for the whole session. The server keys aiSessions on it, so it must
  // stay stable across every turn but never repeat between sessions.
  const sessionIdRef = useRef(`${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
  const spokeRef = useRef(false);             // did the learner ever speak?

  useEffect(() => {
    let cancelled = false;
    fetchTopicImages(content.day, content.imageKeywords, content.manualImageUrls).then((list) => {
      if (!cancelled) setImages((list || []).slice(0, PICTURES_PER_SESSION));
    });
    return () => { cancelled = true; };
  }, [content]);

  const image = images[picIndex];
  const isLastPicture = picIndex >= images.length - 1;
  const isLastTurn = turnIndex >= TURNS_PER_PICTURE - 1;

  const onStart = useCallback(async () => {
    setError('');
    await startRecording();
  }, [startRecording, setError]);

  const onStop = useCallback(async () => {
    const blob = await stopRecording();
    if (!blob || !image) return;

    const data = await send(blob, {
      sessionId: sessionIdRef.current,
      activity: 'describe',
      topicIndex: content.day,
      itemId: image.id,
      itemIndex: picIndex,
      keywords: (image.keywords || []).map((k) => (k && k.word ? k.word : k)),
      turnIndex,
      plannedTurns: TURNS_PER_PICTURE,
      isLast: isLastTurn,
      level: user?.level || 'B1',
    });
    if (!data || data.silent) return;

    spokeRef.current = true;
    setHeard(data.transcript || '');
    setReply(data.reply || '');
    if (Array.isArray(data.matchedKeywords) && data.matchedKeywords.length) {
      setHits((prev) => Array.from(new Set([...prev, ...data.matchedKeywords])));
    }

    if (isLastTurn) {
      // Give the learner a beat to read the reply before the picture changes.
      setTimeout(() => {
        if (isLastPicture) return;
        setPicIndex((i) => i + 1);
        setTurnIndex(0);
        setHits([]);
        setHeard('');
        setReply('');
      }, 1400);
    } else {
      setTurnIndex((t) => t + 1);
    }
  }, [stopRecording, send, image, picIndex, turnIndex, isLastTurn, isLastPicture, content.day, user]);

  // Finish: ask the server to grade the session. Under about a minute of speech
  // there is nothing worth reporting, and the server says so rather than
  // producing a thin report.
  const finish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    if (!spokeRef.current) { navigate('/'); return; }
    setDone('analyzing');
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch(`${FUNCTIONS_BASE}/analyzeAiSession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      });
      const data = await res.json().catch(() => ({}));
      setDone(data.ok ? 'ready' : 'short');
    } catch {
      setDone('short');
    }
  }, [finishing, navigate]);

  if (done) {
    return (
      <div className="ai-activity">
        <div className="ai-activity-body">
          <div className="ai-done">
            <div className="ai-done-ring">
              {done === 'analyzing'
                ? <Loader2 size={34} strokeWidth={1.75} className="ai-spin" />
                : <CheckCircle2 size={34} strokeWidth={1.75} />}
            </div>
            {done === 'analyzing' && (
              <>
                <h2 className="ai-activity-title" style={{ textAlign: 'center' }}>Marking your session</h2>
                <p className="ai-bubble-text" style={{ color: 'var(--text-secondary)' }}>
                  AInur is going through what you said. This takes about a minute.
                </p>
              </>
            )}
            {done === 'ready' && (
              <>
                <h2 className="ai-activity-title" style={{ textAlign: 'center' }}>Your report is ready</h2>
                <p className="ai-bubble-text" style={{ color: 'var(--text-secondary)' }}>
                  Grammar, word choice and a score, from what you said today.
                </p>
                <Button variant="ai" size="lg" full onClick={() => navigate('/history')}>
                  See my report
                </Button>
              </>
            )}
            {done === 'short' && (
              <>
                <h2 className="ai-activity-title" style={{ textAlign: 'center' }}>Session saved</h2>
                <p className="ai-bubble-text" style={{ color: 'var(--text-secondary)' }}>
                  Speak for a little longer next time and AInur can write you a full report.
                </p>
              </>
            )}
            <Button variant="secondary" size="md" full onClick={() => navigate('/')}>
              Back to Today
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-activity">
      <div className="ai-activity-head">
        <Button
          variant="ghost" size="sm" iconOnly aria-label="Back"
          onClick={() => navigate('/')}
          icon={<ChevronLeft size={22} strokeWidth={1.75} />}
        />
        <h1 className="ai-activity-title">Describe pictures</h1>
        <div className="ai-dots" aria-label={`Picture ${picIndex + 1} of ${images.length || PICTURES_PER_SESSION}`}>
          {Array.from({ length: images.length || PICTURES_PER_SESSION }).map((_, i) => (
            <span
              key={i}
              className={`ai-dot${i < picIndex ? ' ai-dot--done' : i === picIndex ? ' ai-dot--now' : ''}`}
            />
          ))}
        </div>
      </div>

      <div className="ai-activity-body">
        {!image ? (
          <p className="ai-bubble-text" style={{ color: 'var(--text-secondary)' }}>Loading pictures…</p>
        ) : (
          <>
            {!heard && !reply && (
              <div className="ai-bubble">
                <img src="/ainur_avatar.png" alt="" className="ai-avatar" />
                <div className="ai-bubble-body">
                  <p className="ai-bubble-name">AInur</p>
                  <p className="ai-bubble-text">{OPENERS[picIndex % OPENERS.length]}</p>
                </div>
              </div>
            )}
            <AiDescribeStage
              image={image}
              hits={hits}
              heard={heard}
              reply={reply}
              thinking={status === 'sending'}
            />
          </>
        )}
      </div>

      <div className="ai-activity-foot">
        {error && (
          <p style={{
            margin: '0 0 var(--s-3)', textAlign: 'center',
            fontSize: 'var(--fs-sm)', color: 'var(--danger)',
          }}>
            {error}
          </p>
        )}
        <MicButton
          status={status}
          level={level}
          elapsedMs={elapsedMs}
          onStart={onStart}
          onStop={onStop}
          disabled={!image}
        />
        <div style={{ marginTop: 'var(--s-3)' }}>
          <Button variant="ghost" size="sm" full onClick={finish} disabled={finishing}>
            {isLastPicture && isLastTurn ? 'Finish and get my report' : 'Finish early'}
          </Button>
        </div>
      </div>
    </div>
  );
}
