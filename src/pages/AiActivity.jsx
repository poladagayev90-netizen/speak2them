import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { auth } from '../firebase';
import { FUNCTIONS_BASE } from '../constants';
import { getTodayContent } from '../data/weeklyContent';
import { fetchTopicImages } from '../utils/fetchTopicImages';
import { plainTopic } from '../utils/topicLabel';
import useAinurSession from '../hooks/useAinurSession';
import { speakLine } from '../utils/ainurVoice';
import AiDescribeStage from '../components/ai/AiDescribeStage';
import MicButton from '../components/ai/MicButton';
import Button from '../components/ui/Button';
import '../components/ai/ai.css';

// A describing session with AInur: five pictures, two exchanges each, about
// eight minutes. Ends with the same analysis a human call produces, which is
// what reaches the teacher.
//
// HANDS-FREE. You tap once at the start and then just talk: she listens,
// notices you have finished, answers, and listens again. Tapping again ends the
// session. Requiring a tap per turn made a learner mid-thought hunt for a
// button, and it hid a much worse failure — see useAinurSession.
const PICTURES_PER_SESSION = 5;
const TURNS_PER_PICTURE = 2;

// The opening question for each picture. Plain and concrete on purpose: a
// learner staring at a photo with nothing asked of them freezes, and "describe
// this" is not a question you can answer without first deciding what to say.
// Fixed strings, so the audio is synthesised once and reused.
const OPENERS = [
  'What can you see in this picture?',
  'How would you describe this picture?',
  'Tell me what is happening here.',
  'What do you notice first in this picture?',
  'Describe this picture for me. What is going on?',
];

const FREE_TURNS = 40;   // effectively unlimited; the learner ends the session
const freeOpener = (topic) => `Hello. Today the topic is ${topic}. What do you think about it?`;

export default function AiActivity({ user }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isFree = params.get('mode') === 'free';

  const [images, setImages] = useState([]);
  const [picIndex, setPicIndex] = useState(0);
  const [turnIndex, setTurnIndex] = useState(0);
  const [hits, setHits] = useState([]);       // keywords said, this picture
  const [heard, setHeard] = useState('');
  const [reply, setReply] = useState('');
  const [log, setLog] = useState([]);          // free talk only: the running exchange
  const [finishing, setFinishing] = useState(false);
  const [done, setDone] = useState(null);     // null | 'analyzing' | 'ready' | 'short'

  const content = useMemo(() => getTodayContent(), []);
  const sessionIdRef = useRef(`${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
  const spokeRef = useRef(false);
  // The exchange on the CURRENT picture only, cleared on every picture change —
  // that reset is what stops one picture leaking into the next.
  const historyRef = useRef([]);
  const pendingAdvanceRef = useRef(false);
  // Live copy for the segment handler, which is created once and must not close
  // over stale state.
  const stateRef = useRef({});

  const image = images[picIndex];
  const isLastPicture = picIndex >= images.length - 1;
  const isLastTurn = isFree ? false : turnIndex >= TURNS_PER_PICTURE - 1;
  stateRef.current = { image, picIndex, turnIndex, isLastTurn, isLastPicture, isFree };

  // One segment of speech: send it, show what came back, and note whether the
  // picture should advance. Returning the payload lets the session play her
  // voice and resume listening on its own.
  const handleSegment = useCallback(async (blob) => {
    const st = stateRef.current;
    if (!st.isFree && !st.image) return null;

    const base64Audio = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(String(r.result).split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });

    let data;
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch(`${FUNCTIONS_BASE}/aiActivityTurn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          activity: st.isFree ? 'freechat' : 'describe',
          topicIndex: content.day,
          itemId: st.isFree ? 'free' : st.image.id,
          itemIndex: st.isFree ? 0 : st.picIndex,
          keywords: st.isFree ? [] : (st.image.keywords || []).map((k) => (k && k.word ? k.word : k)),
          turnIndex: st.turnIndex,
          plannedTurns: st.isFree ? FREE_TURNS : TURNS_PER_PICTURE,
          isLast: st.isLastTurn,
          level: user?.level || 'B1',
          history: historyRef.current,
          base64Audio,
          mimeType: blob.type || 'audio/webm',
        }),
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok || data.silent) return null;
    } catch {
      return null;
    }

    spokeRef.current = true;
    historyRef.current = [
      ...historyRef.current,
      { role: 'user', content: data.transcript || '' },
      { role: 'assistant', content: data.reply || '' },
    ].slice(-8);

    setHeard(data.transcript || '');
    setReply(data.reply || '');
    if (Array.isArray(data.matchedKeywords) && data.matchedKeywords.length) {
      setHits((prev) => Array.from(new Set([...prev, ...data.matchedKeywords])));
    }

    if (st.isFree) {
      setLog((prev) => [...prev, { you: data.transcript || '', ainur: data.reply || '' }]);
      setTurnIndex((t) => t + 1);
    } else if (st.isLastTurn) {
      // Queued behind her voice: the session plays the reply first and only then
      // goes back to listening, so the picture cannot change while she is still
      // talking about the previous one.
      if (!st.isLastPicture) pendingAdvanceRef.current = true;
    } else {
      setTurnIndex((t) => t + 1);
    }
    return data;
  }, [content.day, user]);

  const { status, active, level, elapsedMs, error, start, stop, interrupt } =
    useAinurSession({ onSegment: handleSegment });

  // The picture changes at the moment she stops speaking, never before.
  useEffect(() => {
    if (status !== 'listening' || !pendingAdvanceRef.current) return;
    pendingAdvanceRef.current = false;
    historyRef.current = [];
    setPicIndex((i) => i + 1);
    setTurnIndex(0);
    setHits([]);
    setHeard('');
    setReply('');
  }, [status]);

  useEffect(() => {
    if (isFree) return undefined;
    let cancelled = false;
    fetchTopicImages(content.day, content.imageKeywords, content.manualImageUrls).then((list) => {
      if (!cancelled) setImages((list || []).slice(0, PICTURES_PER_SESSION));
    });
    return () => { cancelled = true; };
  }, [content, isFree]);

  const opener = isFree ? freeOpener(plainTopic(content.topic)) : OPENERS[picIndex % OPENERS.length];

  // Ask the question out loud when a new picture appears.
  useEffect(() => {
    if (!active || heard || reply) return;
    if (!isFree && !image) return;
    speakLine(opener);
  }, [active, opener, image, isFree, heard, reply]);

  const ready = isFree || !!image;

  const onTap = useCallback(() => {
    if (!active) { start(); return; }
    if (status === 'speaking') { interrupt(); return; }
    stop();
  }, [active, status, start, stop, interrupt]);

  const finish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    stop();
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
  }, [finishing, navigate, stop]);

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
                  Your mistakes, corrected, and something to practise.
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
          onClick={() => { stop(); navigate('/'); }}
          icon={<ChevronLeft size={22} strokeWidth={1.75} />}
        />
        <h1 className="ai-activity-title">{isFree ? 'Free talk' : 'Describe pictures'}</h1>
        {isFree ? (
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {turnIndex} {turnIndex === 1 ? 'turn' : 'turns'}
          </span>
        ) : (
          <div className="ai-dots" aria-label={`Picture ${picIndex + 1} of ${images.length || PICTURES_PER_SESSION}`}>
            {Array.from({ length: images.length || PICTURES_PER_SESSION }).map((_, i) => (
              <span
                key={i}
                className={`ai-dot${i < picIndex ? ' ai-dot--done' : i === picIndex ? ' ai-dot--now' : ''}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="ai-activity-body">
        {isFree ? (
          <>
            <div className="ai-bubble">
              <img src="/ainur_avatar.png" alt="" className="ai-avatar" />
              <div className="ai-bubble-body">
                <p className="ai-bubble-name">AInur</p>
                <p className="ai-bubble-text">{opener}</p>
              </div>
            </div>
            {log.map((x, i) => (
              <React.Fragment key={i}>
                <p className="ai-heard">“{x.you}”</p>
                <div className="ai-bubble">
                  <img src="/ainur_avatar.png" alt="" className="ai-avatar" />
                  <div className="ai-bubble-body">
                    <p className="ai-bubble-name">AInur</p>
                    <p className="ai-bubble-text">{x.ainur}</p>
                  </div>
                </div>
              </React.Fragment>
            ))}
            {status === 'sending' && (
              <div className="ai-bubble">
                <img src="/ainur_avatar.png" alt="" className="ai-avatar ai-avatar--pulse" />
                <div className="ai-bubble-body">
                  <p className="ai-bubble-name">AInur</p>
                  <p className="ai-bubble-text">One moment…</p>
                </div>
              </div>
            )}
          </>
        ) : !image ? (
          <p className="ai-bubble-text" style={{ color: 'var(--text-secondary)' }}>Loading pictures…</p>
        ) : (
          <>
            {/* The question stays on screen while they answer it. It used to
                vanish the moment they spoke, so a learner who lost the thread
                mid-sentence had nothing to look back at. */}
            <div className="ai-bubble">
              <img
                src="/ainur_avatar.png"
                alt=""
                className={`ai-avatar${status === 'sending' ? ' ai-avatar--pulse' : ''}`}
              />
              <div className="ai-bubble-body">
                <p className="ai-bubble-name">AInur</p>
                <p className="ai-bubble-text">{reply || opener}</p>
              </div>
            </div>
            <AiDescribeStage image={image} hits={hits} heard={heard} />
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
          active={active}
          level={level}
          elapsedMs={elapsedMs}
          onTap={onTap}
          disabled={!ready}
        />
        <div style={{ marginTop: 'var(--s-3)' }}>
          <Button variant="ghost" size="sm" full onClick={finish} disabled={finishing}>
            {isFree || (isLastPicture && isLastTurn) ? 'Finish and get my report' : 'Finish early'}
          </Button>
        </div>
      </div>
    </div>
  );
}
