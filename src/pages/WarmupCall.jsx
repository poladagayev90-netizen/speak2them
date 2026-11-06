import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { ChevronLeft, Loader2, Mic, PhoneOff, Users, CalendarDays, Quote } from 'lucide-react';
import { db } from '../firebase';
import { isAdminUser } from '../constants';
import Button from '../components/ui/Button';
import useFirstRunCopy from '../hooks/useFirstRunCopy';
import { openLiveSession } from '../utils/geminiLive';
import { startWarmup, endWarmup, WARMUP_MAX_ATTEMPTS } from '../utils/warmupCall';
import './WarmupCall.css';

// The warm-up call: one short spoken chat with AInur (Gemini Live) before the
// learner's first REAL partner. Every screen says where it leads — the intro,
// the badge during the call, AInur's own goodbye, and a closing screen whose
// only ways on are Partners and the week. Rules: docs/domain/calls.md.
//
// Screens: intro → connecting → live → ending → done | short (ended early,
// a second try left) | direct (not available: straight to partners) | mic.

const HINT_AFTER_MS = 8000;
const COMPLETE_MIN_SECONDS = 60; // functions/warmupCall.js, for the offline fallback only

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

export default function WarmupCall({ user }) {
  const navigate = useNavigate();
  const { t } = useFirstRunCopy(user?.guideLanguage);
  const [phase, setPhase] = useState('intro');
  const [speaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0);
  const [aiCaption, setAiCaption] = useState('');
  const [meCaption, setMeCaption] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [maxSeconds, setMaxSeconds] = useState(240);
  const [hint, setHint] = useState(false);
  const [best, setBest] = useState(null);
  const [attempts, setAttempts] = useState(0);

  const sessionRef = useRef(null);
  const metaRef = useRef(null); // { sessionId, wrapAtSeconds, maxSeconds }
  const linesRef = useRef([]);
  const usageRef = useRef(null);
  const startedAtRef = useRef(0);
  const wrapSentRef = useRef(false);
  const wrapDoneRef = useRef(false);
  const finishingRef = useRef(false);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => onSnapshot(doc(db, 'warmupCalls', user.uid),
    (s) => setAttempts(Number(s.exists() && s.data().attempts) || 0), () => {}), [user.uid]);

  const finish = useCallback(async (reason) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) session.close();
    setSpeaking(false);
    setPhase('ending');
    const localSeconds = startedAtRef.current ? (Date.now() - startedAtRef.current) / 1000 : 0;
    try {
      const r = await endWarmup({
        sessionId: metaRef.current && metaRef.current.sessionId,
        lines: linesRef.current,
        usage: usageRef.current,
        reason,
      });
      setBest(r.best || null);
      setPhase(r.completed ? 'done' : 'short');
    } catch {
      setPhase(localSeconds >= COMPLETE_MIN_SECONDS ? 'done' : 'short');
    }
  }, []);

  // Leaving the page mid-call hangs up and records it.
  useEffect(() => () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
      if (metaRef.current && !finishingRef.current) {
        endWarmup({ sessionId: metaRef.current.sessionId, lines: linesRef.current, usage: usageRef.current, reason: 'hangup' }).catch(() => {});
      }
    }
  }, []);

  const onEvent = useCallback((type, payload) => {
    switch (type) {
      case 'speaking':
        setSpeaking(payload);
        lastActivityRef.current = Date.now();
        if (payload) setHint(false);
        break;
      case 'level':
        setLevel(payload);
        break;
      case 'aiText':
        setAiCaption(payload);
        break;
      case 'meText':
        setMeCaption(payload);
        lastActivityRef.current = Date.now();
        setHint(false);
        break;
      case 'line':
        linesRef.current.push(payload);
        if (payload.who === 'ai') setMeCaption('');
        break;
      case 'turnComplete':
        if (wrapSentRef.current) wrapDoneRef.current = true;
        break;
      case 'usage':
        usageRef.current = payload;
        break;
      case 'closed':
        if (!finishingRef.current) finish(wrapDoneRef.current ? 'done' : 'error');
        break;
      default:
    }
  }, [finish]);

  // The clock: hint when the learner has been quiet a while, AInur's wrap-up
  // cue, the hang-up after her goodbye, and the hard stop.
  useEffect(() => {
    if (phase !== 'live') return undefined;
    const id = setInterval(() => {
      const meta = metaRef.current;
      const secs = (Date.now() - startedAtRef.current) / 1000;
      setElapsed(secs);
      const session = sessionRef.current;
      if (!session || !meta) return;
      if (!session.speaking && Date.now() - lastActivityRef.current > HINT_AFTER_MS) setHint(true);
      if (!wrapSentRef.current && secs >= meta.wrapAtSeconds) {
        wrapSentRef.current = true;
        session.cue('[wrap-up]');
      }
      if (wrapDoneRef.current && !session.speaking) finish('done');
      else if (secs >= meta.maxSeconds) finish('timeout');
    }, 250);
    return () => clearInterval(id);
  }, [phase, finish]);

  const begin = async () => {
    // Microphone first: a refusal must not spend the one-use token.
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((tr) => tr.stop());
    } catch {
      setPhase('mic');
      return;
    }
    setPhase('connecting');
    finishingRef.current = false;
    wrapSentRef.current = false;
    wrapDoneRef.current = false;
    linesRef.current = [];
    usageRef.current = null;
    setAiCaption(''); setMeCaption(''); setHint(false); setBest(null); setElapsed(0);

    let meta;
    try {
      meta = await startWarmup();
    } catch {
      setPhase('direct');
      return;
    }
    metaRef.current = meta;
    setMaxSeconds(meta.maxSeconds || 240);
    try {
      const session = await openLiveSession({ token: meta.token, model: meta.model, on: onEvent });
      sessionRef.current = session;
      startedAtRef.current = Date.now();
      lastActivityRef.current = Date.now();
      setPhase('live');
      // She speaks first: the greeting and the first easy question.
      session.cue('[start]');
    } catch (e) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) setPhase('mic');
      else {
        finishingRef.current = true; // nothing to hang up
        endWarmup({ sessionId: meta.sessionId, lines: [], reason: 'error' }).catch(() => {});
        setPhase('short');
      }
    }
  };

  const toPartners = () => navigate('/chats', { replace: true });
  const toWeek = () => navigate('/plan', { replace: true });
  const canRetry = isAdminUser(user) || attempts < WARMUP_MAX_ATTEMPTS;
  const left = Math.max(0, maxSeconds - elapsed);
  const progress = Math.min(1, elapsed / maxSeconds);

  if (phase === 'live' || phase === 'connecting' || phase === 'ending') {
    const status = phase === 'connecting' ? t('warm.connecting')
      : phase === 'ending' ? t('warm.ending')
      : speaking ? t('warm.aiTalking') : t('warm.yourTurn');
    return (
      <div className="wu-page wu-call">
        <div className="wu-badge">{t('warm.badge')}</div>
        <div className="wu-progress" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></div>

        <div className="wu-stage">
          <div
            className={`wu-avatar ${speaking ? 'is-speaking' : ''} ${!speaking && phase === 'live' ? 'is-listening' : ''}`}
            style={{ '--wu-level': speaking ? 0 : level }}
          >
            <img src="/ainur_avatar.png" alt="AInur" />
          </div>
          <p className="wu-status" aria-live="polite">
            {phase !== 'live' && <Loader2 size={16} className="wu-spin" aria-hidden="true" />} {status}
          </p>
          {aiCaption && <p className="wu-caption" lang="en">{aiCaption}</p>}
          {meCaption && <p className="wu-caption wu-caption--me" lang="en">{meCaption}</p>}
          {hint && phase === 'live' && <p className="wu-hint">{t('warm.hint')}</p>}
        </div>

        <div className="wu-foot">
          {phase === 'live' && (
            <span className="wu-time" aria-label="Time left">
              {Math.floor(left / 60)}:{String(Math.floor(left % 60)).padStart(2, '0')}
            </span>
          )}
          <Button variant="secondary" icon={<PhoneOff size={18} aria-hidden="true" />} onClick={() => finish('hangup')} disabled={phase !== 'live'}>
            {t('warm.end')}
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="wu-page wu-end">
        <img src="/ainur_avatar.png" alt="" className="wu-end-avatar" />
        <h1 className="wu-title">{t('warm.done.title', { name: firstName(user.name) })}</h1>
        {best && best.quote && (
          <div className="wu-best">
            <p className="wu-best-label"><Quote size={14} aria-hidden="true" /> {t('warm.done.said')}</p>
            <p className="wu-best-quote" lang="en">“{best.quote}”</p>
            {best.note && <p className="wu-best-note">{best.note}</p>}
          </div>
        )}
        <div className="wu-next">
          <h2 className="wu-next-title">{t('warm.done.next')}</h2>
          <p className="wu-next-sub">{t('warm.done.nextSub')}</p>
        </div>
        <div className="wu-actions">
          <Button full icon={<Users size={18} aria-hidden="true" />} onClick={toPartners}>{t('warm.done.partners')}</Button>
          <Button full variant="ghost" icon={<CalendarDays size={18} aria-hidden="true" />} onClick={toWeek}>{t('warm.done.week')}</Button>
        </div>
      </div>
    );
  }

  if (phase === 'short' || phase === 'direct' || phase === 'mic') {
    const retry = phase === 'mic' || (phase === 'short' && canRetry);
    const key = phase === 'mic' ? 'warm.mic' : phase === 'short' && canRetry ? 'warm.short' : 'warm.direct';
    return (
      <div className="wu-page wu-end">
        <img src="/ainur_avatar.png" alt="" className="wu-end-avatar" />
        <h1 className="wu-title">{t(`${key}.title`)}</h1>
        <p className="wu-sub">{t(`${key}.sub`)}</p>
        <div className="wu-actions">
          {retry && (
            <Button full variant="ai" icon={<Mic size={18} aria-hidden="true" />} onClick={begin}>
              {phase === 'mic' ? t('warm.intro.start') : t('warm.again')}
            </Button>
          )}
          <Button full variant={retry ? 'ghost' : 'primary'} icon={<Users size={18} aria-hidden="true" />} onClick={toPartners}>
            {t('warm.done.partners')}
          </Button>
        </div>
      </div>
    );
  }

  // intro
  return (
    <div className="wu-page wu-intro">
      <button type="button" className="wu-back" onClick={() => navigate('/')} aria-label="Back">
        <ChevronLeft size={22} aria-hidden="true" />
      </button>
      <img src="/ainur_avatar.png" alt="" className="wu-end-avatar" />
      <h1 className="wu-title">{t('warm.intro.title')}</h1>
      <ol className="wu-steps">
        <li>{t('warm.intro.p1')}</li>
        <li>{t('warm.intro.p2')}</li>
        <li>{t('warm.intro.p3')}</li>
      </ol>
      <p className="wu-sub wu-sub--small">{t('warm.intro.mic')}</p>
      <div className="wu-actions">
        <Button full variant="ai" icon={<Mic size={18} aria-hidden="true" />} onClick={begin}>{t('warm.intro.start')}</Button>
        <Button full variant="ghost" onClick={toPartners}>{t('warm.intro.skip')}</Button>
      </div>
    </div>
  );
}
