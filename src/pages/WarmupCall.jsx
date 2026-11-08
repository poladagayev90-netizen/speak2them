import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { ChevronLeft, Clock, Loader2, Mic, MicOff, PhoneOff, Users, CalendarDays, Quote } from 'lucide-react';
import { db } from '../firebase';
import { isAdminUser } from '../constants';
import Button from '../components/ui/Button';
import useFirstRunCopy from '../hooks/useFirstRunCopy';
import { openLiveSession } from '../utils/geminiLive';
import { dismissWarmup } from '../hooks/useWarmupOffer';
import { startWarmup, endWarmup, WARMUP_MAX_ATTEMPTS, WARMUP_AVATAR as AVATAR } from '../utils/warmupCall';
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

// 0:07, 2:41 — the real call screen's clock.
function clock(secs) {
  const s = Math.max(0, Math.floor(secs));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

export default function WarmupCall({ user }) {
  const navigate = useNavigate();
  const { lang, t } = useFirstRunCopy(user?.guideLanguage);
  const [phase, setPhase] = useState('intro');
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [level, setLevel] = useState(0);
  const [aiCaption, setAiCaption] = useState('');
  const [meCaption, setMeCaption] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [maxSeconds, setMaxSeconds] = useState(240);
  const [hint, setHint] = useState(false);
  const [best, setBest] = useState(null);
  const [attempts, setAttempts] = useState(0);
  // Why the last try failed, in plain technical words. Shown to admins only
  // (Polad tests on his phone and must see the real cause) and sent to
  // warmupCallEnd, which logs it.
  const [why, setWhy] = useState('');
  const admin = isAdminUser(user);

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

  const finish = useCallback(async (reason, detail = '') => {
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
        detail,
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
        if (!finishingRef.current) {
          if (!wrapDoneRef.current) setWhy(`live closed ${payload?.code ?? ''} ${payload?.reason || ''}`.trim());
          finish(wrapDoneRef.current ? 'done' : 'error', payload ? `closed ${payload.code} ${payload.reason || ''}` : '');
        }
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
    setAiCaption(''); setMeCaption(''); setHint(false); setBest(null); setElapsed(0); setMuted(false);

    setWhy('');
    let meta;
    try {
      meta = await startWarmup({ lang });
    } catch (e) {
      setWhy(`start ${e?.status || ''} ${e?.reason || e?.message || ''}`.trim());
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
        const detail = String((e && (e.message || e.name)) || 'connect failed').slice(0, 200);
        setWhy(detail);
        finishingRef.current = true; // nothing to hang up
        endWarmup({ sessionId: meta.sessionId, lines: [], reason: 'error', detail }).catch(() => {});
        setPhase('short');
      }
    }
  };

  const toPartners = () => navigate('/chats', { replace: true });
  const toWeek = () => navigate('/plan', { replace: true });
  // Skipping from the intro is a «not now»: the Today card steps aside and the
  // warm-up waits as a row in Get ready (useWarmupOffer).
  const skipToPartners = () => { dismissWarmup(user?.uid); toPartners(); };
  const canRetry = isAdminUser(user) || attempts < WARMUP_MAX_ATTEMPTS;
  const left = Math.max(0, maxSeconds - elapsed);
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (sessionRef.current) sessionRef.current.setMuted(next);
  };

  // The call room. It is built from the REAL call screen's parts (App.css:
  // .fullscreen-call, .call-avatar-big, .call-peer-name, .call-status-text,
  // .call-btn-big) and keeps its rhythm — «Calling…», then a live dot with a
  // running clock, the time left, the topic, Mute and End — so the warm-up
  // feels like the call the learner is about to make, not a chat page
  // (Polad 2026-11-07). The badge still says what it is.
  if (phase === 'live' || phase === 'connecting' || phase === 'ending') {
    const live = phase === 'live';
    return (
      <div className="fullscreen-call wu-room">
        <div className="wu-badge">{t('warm.badge')}</div>
        <div
          className={`call-avatar-big wu-avatar ${speaking ? 'is-speaking' : ''} ${!speaking && live ? 'is-listening' : ''}`}
          style={{ '--wu-level': speaking || muted ? 0 : level }}
        >
          <img src={AVATAR} alt="" />
        </div>
        <h2 className="call-peer-name">AInur</h2>
        <p className="call-status-text wu-status" aria-live="polite">
          {live ? (
            <>
              <span className="call-live-dot" aria-hidden="true" />
              <span className="wu-clock">{clock(elapsed)}</span>
            </>
          ) : (
            <>
              <Loader2 size={16} className="wu-spin" aria-hidden="true" />
              {phase === 'connecting' ? t('warm.calling') : t('warm.ending')}
            </>
          )}
        </p>
        {live && (
          <>
            <div className="wu-left">
              <Clock size={13} strokeWidth={2} aria-hidden="true" />
              {t('warm.left', { time: clock(left) })}
            </div>
            <div className="wu-topic">
              <span className="wu-topic-k">{t('warm.topicK')}</span>
              <span className="wu-topic-t">{t('warm.topic')}</span>
            </div>
          </>
        )}

        <div className="wu-talk">
          {live && (
            <p className={`wu-turn ${speaking ? 'is-ai' : 'is-me'}`}>
              {speaking ? t('warm.aiTalking') : t('warm.yourTurn')}
            </p>
          )}
          {aiCaption && <p className="wu-caption" lang="en">{aiCaption}</p>}
          {meCaption && <p className="wu-caption wu-caption--me" lang="en">{meCaption}</p>}
          {hint && live && <p className="wu-hint">{t('warm.hint')}</p>}
        </div>

        <div className="fullscreen-call-buttons wu-controls">
          {live && (
            <button type="button" className={`call-btn-big ${muted ? 'active-mute' : ''}`} onClick={toggleMute} aria-pressed={muted}>
              {muted ? <MicOff size={26} strokeWidth={2.25} aria-hidden="true" /> : <Mic size={26} strokeWidth={2.25} aria-hidden="true" />}
              <span>{muted ? t('warm.unmute') : t('warm.mute')}</span>
            </button>
          )}
          <button type="button" className="call-btn-big end" onClick={() => finish('hangup')} disabled={!live}>
            <PhoneOff size={26} strokeWidth={2.25} aria-hidden="true" /><span>{t('warm.end')}</span>
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="wu-page wu-end">
        <img src={AVATAR} alt="" className="wu-end-avatar" />
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
        <img src={AVATAR} alt="" className="wu-end-avatar" />
        <h1 className="wu-title">{t(`${key}.title`)}</h1>
        <p className="wu-sub">{t(`${key}.sub`)}</p>
        {admin && why && <p className="wu-why">Admin · {why}</p>}
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
      <img src={AVATAR} alt="" className="wu-end-avatar" />
      <h1 className="wu-title">{t('warm.intro.title')}</h1>
      <ol className="wu-steps">
        <li>{t('warm.intro.p1')}</li>
        <li>{t('warm.intro.p2')}</li>
        <li>{t('warm.intro.p3')}</li>
      </ol>
      <p className="wu-sub wu-sub--small">{t('warm.intro.mic')}</p>
      <div className="wu-actions">
        <Button full variant="ai" icon={<Mic size={18} aria-hidden="true" />} onClick={begin}>{t('warm.intro.start')}</Button>
        <Button full variant="ghost" onClick={skipToPartners}>{t('warm.intro.skip')}</Button>
      </div>
    </div>
  );
}
