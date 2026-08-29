import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { auth } from '../firebase';
import { FUNCTIONS_BASE } from '../constants';
import { getTodayContent } from '../data/weeklyContent';
import { fetchTopicImages } from '../utils/fetchTopicImages';
import { plainTopic } from '../utils/topicLabel';
import useAinurSession from '../hooks/useAinurSession';
import { speakLine, stopSpeaking, primeLine, hasLine } from '../utils/ainurVoice';
import { cue, cueStep, wordWon } from '../utils/cue';
import AiDescribeStage from '../components/ai/AiDescribeStage';
import MicButton from '../components/ai/MicButton';
import Button from '../components/ui/Button';
import '../components/ai/ai.css';

// A describing session with AInur: five pictures, one spoken question each.
// Ends with the same analysis a human call produces, which is what reaches the
// teacher.
//
// THE SHAPE OF A PICTURE, and it is the same every time:
//   she ASKS OUT LOUD → you describe it, freely and for as long as you like →
//   she answers what you said → the next picture arrives, asked out loud.
//
// THE WORDS ARE A HELP, NOT A GATE. They briefly required every word to be used
// before a picture would end, and it turned the activity into a word hunt: a
// learner who had described the photograph perfectly well was held on it and
// told again and again to say the two words they had not happened to reach.
// Free speech is the point of a speaking app, so the list went back to what it
// is good at — giving somebody who does not know what to say five concrete
// things to say — and a word still lights up, buzzes and pops when it is used.
//
// One description per picture, and it is not a short one: a segment runs to
// forty-five seconds, silence only ends it after four, and the button sends it
// the moment the learner decides they have finished.
//
// This replaces a two-turn picture where only the very first sentence of the
// whole session was spoken and every question after it appeared silently as
// text. That mismatch is what broke the activity for learners: the opening
// line taught them AInur talks, so when the second question arrived without a
// sound they did not notice it had been asked and sat waiting. Reported, in
// those words, as "the first question is read out, then everything goes quiet
// and I do not know what to do".
//
// Her voice costs nothing to keep. The five questions below are FIXED strings,
// so each one is synthesised once and then played from the device for ever —
// five TTS calls per device, total. What stays silent is her closing sentence
// about the answer, which is different every time and would be paid for every
// time; it is read, not heard, and the microphone reopens immediately instead
// of after five to eight seconds of listening to her.
const PICTURES_PER_SESSION = 5;
// One description, then she answers it and the picture moves on.
const ANSWERS_PER_PICTURE = 1;

// What she says out loud when each picture opens. One per picture, and they are
// fixed strings for the caching reason above — never build one of these from
// data.
// ⚠️ The server keeps an allowlist of speakable lines (SPEAKABLE_LINES in
// functions/index.js). Adding or changing a line here without adding it there
// makes speakLine return 400 and AInur goes silent, with nothing on screen to
// explain it. That is exactly how this activity broke once.
const DESCRIBE_QUESTIONS = [
  'How can you describe this photo?',
  'What can you see in this picture?',
  'Tell me what is happening here.',
  'What do you notice first in this picture?',
  'Describe this picture for me. What is going on?',
];
// Wraps, so priming the NEXT picture's line never has to special-case the last
// one.
const questionFor = (i) => DESCRIBE_QUESTIONS[((i % DESCRIBE_QUESTIONS.length) + DESCRIBE_QUESTIONS.length) % DESCRIBE_QUESTIONS.length];

// A turn can fail in six different ways and every one of them used to look
// identical to the learner: nothing happened at all. No reply, no message, no
// hint that anything had gone wrong. Each one now says what happened and what
// to do next.
function turnErrorFor(status, data) {
  if (status === 429) return 'You have practised a lot this hour. Take a short break and come back.';
  if (status === 401 || status === 403) return 'Your sign-in expired. Open the app again to carry on.';
  if (status === 502) return 'AInur could not make that out. Try once more, a little louder.';
  if (status === 413) return 'That answer was very long. Try a shorter one.';
  return (data && data.error) || 'Something went wrong on our side. Try that again.';
}

// How long her closing sentence stays on screen before the next picture
// arrives. Long enough to read one short sentence without being long enough to
// feel like the app has stalled -- the failure this whole path is fixing.
const CLOSING_READ_MS = 2800;

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
  const [intro, setIntro] = useState(false);   // the opening line is playing
  const [turnError, setTurnError] = useState('');
  const [done, setDone] = useState(null);     // null | 'analyzing' | 'ready' | 'short'
  // Her QUESTION is spoken; everything else the activity does is silent, so
  // every other step has to be visible or the learner is left staring at a
  // photo wondering whether anything happened. `advancing` is the hold before
  // the next picture; `fresh` marks a question that has just been asked.
  const [advancing, setAdvancing] = useState(false);
  const [fresh, setFresh] = useState(false);
  // The words that lit up on the LAST answer, so the pills can announce those
  // and only those. Without it every used word would re-animate on every turn
  // and the signal would mean nothing.
  const [justHit, setJustHit] = useState([]);

  const content = useMemo(() => getTodayContent(), []);
  const sessionIdRef = useRef(`${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
  const spokeRef = useRef(false);
  const introRef = useRef(false);
  // The exchange on the CURRENT picture only, cleared on every picture change —
  // that reset is what stops one picture leaking into the next.
  const historyRef = useRef([]);
  const pendingAdvanceRef = useRef(false);
  // The closing answer on the LAST picture ends the session. Without this the
  // activity had no end at all -- see the effect that consumes it.
  const pendingFinishRef = useRef(false);
  const advanceTimerRef = useRef(null);
  const freshTimerRef = useRef(null);
  // The picture whose question has already been asked. Without it the effect
  // that asks would fire again on any unrelated re-render and talk over itself.
  // Starts at 0 because the opening tap asks for the first picture.
  const askedForRef = useRef(0);
  const hitTimerRef = useRef(null);
  const finishTimerRef = useRef(null);
  const finishScheduledRef = useRef(false);
  // Live copy for the segment handler, which is created once and must not close
  // over stale state.
  const stateRef = useRef({});

  const image = images[picIndex];
  const isLastPicture = picIndex >= images.length - 1;
  const isLastTurn = isFree ? false : turnIndex >= ANSWERS_PER_PICTURE - 1;
  stateRef.current = { image, picIndex, turnIndex, isLastTurn, isLastPicture, isFree, hits };

  // One segment of speech: send it, show what came back, and note whether the
  // picture should advance. Returning the payload lets the session play her
  // voice and resume listening on its own.
  const handleSegment = useCallback(async (blob) => {
    const st = stateRef.current;
    // The session is already closing — a segment that was in flight when the
    // last picture ended must not be sent, or it lands as another dead turn.
    if (pendingFinishRef.current) return null;
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
          // What is already ticked off on this picture. The server intersects it
          // with the real word list before trusting a word of it.
          hitsSoFar: st.isFree ? [] : st.hits,
          turnIndex: st.turnIndex,
          plannedTurns: st.isFree ? FREE_TURNS : ANSWERS_PER_PICTURE,
          isLast: st.isLastTurn,
          level: user?.level || 'B1',
          history: historyRef.current,
          base64Audio,
          mimeType: blob.type || 'audio/webm',
        }),
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTurnError(turnErrorFor(res.status, data));
        return null;
      }
      if (data.silent) {
        // Not an error the learner caused, but they still need to know why
        // nothing came back.
        setTurnError('I did not catch anything. Speak a little louder, then pause when you finish.');
        return null;
      }
    } catch {
      setTurnError('Connection problem — your answer did not reach AInur. Try that again.');
      return null;
    }
    setTurnError('');

    spokeRef.current = true;
    historyRef.current = [
      ...historyRef.current,
      { role: 'user', content: data.transcript || '' },
      { role: 'assistant', content: data.reply || '' },
    ].slice(-8);

    setHeard(data.transcript || '');
    // The closing answer carries no reply. Leave her question on screen rather
    // than blanking the bubble back to the generic prompt for the half second
    // before the picture changes.
    if (data.reply) setReply(data.reply);
    // The pills come from the SERVER's running total, not from a list this file
    // keeps adding to: the two could drift, and where they would drift is
    // exactly where the learner is looking. `justHit` is only what changed, so
    // the animation and the sound mark this answer and not the whole picture.
    if (Array.isArray(data.allHits)) {
      const won = (data.matchedKeywords || []).filter((k) => !(st.hits || []).includes(k));
      setHits(data.allHits);
      if (won.length) {
        setJustHit(won);
        wordWon(won.length);
        clearTimeout(hitTimerRef.current);
        hitTimerRef.current = setTimeout(() => setJustHit([]), 1600);
      }
    } else if (Array.isArray(data.matchedKeywords) && data.matchedKeywords.length) {
      setHits((prev) => Array.from(new Set([...prev, ...data.matchedKeywords])));
    }

    if (st.isFree) {
      setLog((prev) => [...prev, { you: data.transcript || '', ainur: data.reply || '' }]);
      setTurnIndex((t) => t + 1);
      return data;
    }

    // THE SERVER DECIDES. `closing` is true when every word has been used, or
    // when the safety cap has been reached — either way the picture is over.
    if (data.closing) {
      // Queued behind her voice: the session plays the reply first and only then
      // goes back to listening, so the picture cannot change while she is still
      // talking about the previous one.
      //
      // On the LAST picture this closes the session instead of advancing. It
      // used to do NOTHING, and nothing was a dead end: turnIndex was never
      // incremented, so isLastTurn stayed true and isLastPicture stayed true
      // for ever. The microphone kept listening, every further answer was sent
      // as another closing turn, and the server dutifully returned an empty
      // reply -- so the bubble stayed frozen on a question already answered,
      // the picture never changed, and the learner went on talking into
      // nothing. Each of those dead turns still billed a Whisper transcription
      // and wrote a turn to Firestore.
      if (!st.isLastPicture) pendingAdvanceRef.current = true;
      else pendingFinishRef.current = true;
    } else {
      setTurnIndex((t) => t + 1);
    }
    // HOLD THE LOOP, either way. Left to itself it reopens the microphone the
    // instant this returns, and the very next thing that happens is AInur
    // speaking — through the speaker, into that open microphone, and back out
    // to Whisper as the learner's own next sentence. Whoever holds owns the
    // resume: the nudge effect and the ask effect below.
    return { ...data, hold: true };
  }, [content.day, user]);

  const { status, active, level, elapsedMs, error, start, stop, submit, resume, interrupt } =
    useAinurSession({ onSegment: handleSegment });

  // The picture changes once her closing line has been on screen long enough to
  // read. It used to change the instant the turn settled, which -- back when the
  // closing turn produced no line at all -- meant the learner's answer was met
  // by the photo silently swapping. She replies to it now, so the reply needs a
  // beat: swapping the picture under her sentence hides the very thing that was
  // missing.
  //
  // 'held' is where the loop parks itself after a closing answer. Waiting for
  // 'listening' instead, as this did, would now never fire at all -- the
  // microphone deliberately does not reopen until she has finished asking.
  useEffect(() => {
    if (status !== 'held' || !pendingAdvanceRef.current) return;
    pendingAdvanceRef.current = false;
    // The hold is ANNOUNCED now. It used to be 2.8 seconds of nothing: the
    // learner had answered, the screen did not move, and the only reasonable
    // conclusion was that the app had missed them — "I answered, why is the
    // picture not changing". Saying "next picture" out loud on screen turns
    // the same pause into visible progress.
    setAdvancing(true);
    // Held in a ref and deliberately NOT cleared when status changes: this
    // effect re-runs on every status transition, so cleaning up here would let
    // the learner cancel their own picture change simply by starting to speak
    // during the hold -- and the picture would then never advance at all.
    advanceTimerRef.current = setTimeout(() => {
      historyRef.current = [];
      setPicIndex((i) => i + 1);
      setTurnIndex(0);
      setHits([]);
      setJustHit([]);
      setHeard('');
      setReply('');
      setAdvancing(false);
      cueStep();
    }, CLOSING_READ_MS);
  }, [status]);

  // Her closing sentence lands silently, so it buzzes. Without it the only
  // evidence that an answer had been taken was one line of text changing on a
  // screen the learner was not looking at -- they were looking at the photo.
  useEffect(() => {
    if (reply) cue();
  }, [reply]);

  // A question announces itself: a buzz and a "New question" flag that fades on
  // its own. It is raised when she starts ASKING, which is also when her voice
  // starts, so the two signals agree.
  const markFresh = useCallback(() => {
    setFresh(true);
    cue();
    clearTimeout(freshTimerRef.current);
    freshTimerRef.current = setTimeout(() => setFresh(false), 4000);
  }, []);

  // Only leaving the screen cancels a pending picture change.
  useEffect(() => () => {
    clearTimeout(advanceTimerRef.current);
    clearTimeout(freshTimerRef.current);
    clearTimeout(hitTimerRef.current);
  }, []);

  useEffect(() => {
    if (isFree) return undefined;
    let cancelled = false;
    fetchTopicImages(content.day, content.imageKeywords, content.manualImageUrls).then((list) => {
      if (!cancelled) setImages((list || []).slice(0, PICTURES_PER_SESSION));
    });
    return () => { cancelled = true; };
  }, [content, isFree]);

  // The question for the picture ON SCREEN. It is both what she says out loud
  // and what stays written under her name while they answer it, because a
  // spoken question is gone the moment it ends and a learner who loses the
  // thread mid-sentence has to be able to look back at it.
  const opener = isFree ? freeOpener(plainTopic(content.topic)) : questionFor(picIndex);

  const ready = isFree || !!image;

  // Fetch this picture's line while they are still looking at it, and the NEXT
  // picture's line too, so no question ever waits on a network round trip. Each
  // costs one call the first time this device ever hears it and nothing after
  // that.
  // Keyed on the uid, not just mount: auth restores asynchronously and a prime
  // fired before it lands has no token to send, so it would quietly do nothing
  // and never retry.
  // SEQUENTIAL, not both at once. Fired together they race each other through
  // the same cold function and the line actually on screen can lose -- which is
  // exactly what happened: the first question of a session arrived a moment
  // after the learner had already tapped, so the one question they most needed
  // to hear was the one question that went unspoken.
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    primeLine(opener)
      .then(() => {
        if (cancelled || isFree) return null;
        return primeLine(questionFor(picIndex + 1));
      })
      ;
    return () => { cancelled = true; };
  }, [opener, picIndex, isFree, user?.uid]);

  // She speaks BEFORE the microphone opens, never over it. Run together, the
  // recorder hears her through the speaker and Whisper hands back AInur's own
  // question as the learner's first sentence.
  //
  // But the voice never delays the lesson. If the line is not already on the
  // device — offline, a cold start, or the server refused it — the microphone
  // opens immediately and the question stays on screen unspoken. `open` is what
  // hands the floor back: start() for the first picture, resume() for every
  // one after it, because by then the session is already running and starting
  // it again would open a second recorder.
  const ask = useCallback(async (line, open) => {
    markFresh();
    // The asking state goes up BEFORE the wait, not after it. It used to cover
    // only the playback, so a line that was not cached yet left the button
    // reading "Tap to start" for a second or more after a tap that had already
    // been taken -- a dead screen at the one moment the learner is looking for
    // a response.
    introRef.current = true;
    setIntro(true);
    if (!hasLine(line)) {
      // A prime is probably already in flight from the effect above. Give it a
      // moment to land so even the very first session on a device hears her.
      // Capped, because a slow network must never hold the microphone shut:
      // past this the question stays on screen unspoken and the lesson goes on.
      await Promise.race([primeLine(line), new Promise((r) => { setTimeout(r, 2500); })]);
      if (!introRef.current) return; // tapped through while we waited
    }
    if (hasLine(line)) {
      await speakLine(line);        // resolves when she has finished, not when she starts
      if (!introRef.current) return; // skipped, finished early, or the screen was left
    }
    introRef.current = false;
    setIntro(false);
    open();
  }, [markFresh]);

  const beginSession = useCallback(() => ask(opener, start), [ask, opener, start]);

  // Every picture after the first is announced the same way the first one was:
  // she asks it out loud, and only then does the microphone reopen. The loop is
  // sitting held at this point -- see the closing branch of handleSegment --
  // so nothing is recording while she talks.
  useEffect(() => {
    if (isFree || !active || !image) return;
    if (askedForRef.current === picIndex) return;
    askedForRef.current = picIndex;
    ask(questionFor(picIndex), resume);
  }, [picIndex, active, image, isFree, ask, resume]);

  // The microphone button NEVER ends the session. It used to: any tap that was
  // not an interrupt fell through to stop(), which discards the segment being
  // recorded. So a learner who answered and then tapped the stop-square — the
  // universal "send" gesture, and what the running timer beside it invites —
  // had their answer deleted, got no reply, no next picture, and no error. It
  // was reported, exactly, as "I answer, I send, and nothing happens".
  //
  // Tapping while listening now SENDS. Ending the session is the Finish button
  // below, which says so in words.
  const onTap = useCallback(() => {
    // Tapping through a spoken question skips it rather than restarting it.
    // The written question stays on screen, so nothing is lost by cutting her
    // off -- and on the second picture onward the session is already running,
    // which is why this resumes rather than starts.
    if (intro) {
      introRef.current = false;
      setIntro(false);
      stopSpeaking();
      if (active) resume(); else start();
      return;
    }
    if (!active) { beginSession(); return; }
    if (status === 'speaking') { interrupt(); return; }
    // Already sending: a second tap must not queue anything or tear the
    // session down. Doing nothing is the honest response to "one moment".
    if (status === 'sending') return;
    submit();
  }, [intro, active, status, beginSession, start, submit, resume, interrupt]);

  // Leaving the screen must not leave her talking, and must not let a queued
  // opening line start a session nobody is looking at.
  useEffect(() => () => { introRef.current = false; stopSpeaking(); }, []);

  const finish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    introRef.current = false;
    stopSpeaking();
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

  // Five pictures answered IS the end of the activity, so it ends itself and
  // goes straight to the report the learner did the work for. Queued on the
  // loop parking at 'held' so it cannot cut across a reply still arriving, then
  // waits for the same beat as a picture change: without the hold, her sentence
  // about the FIFTH answer was generated, paid for, and replaced by the
  // "Marking your session" screen before anyone could read it -- the last
  // answer of the session being the one answer that still got nothing back.
  // Guarded by its own flag because this effect re-runs on every status change,
  // and the timer must not be rescheduled or cancelled once it is set.
  useEffect(() => {
    if (!pendingFinishRef.current || status !== 'held' || finishScheduledRef.current) return;
    finishScheduledRef.current = true;
    finishTimerRef.current = setTimeout(finish, CLOSING_READ_MS);
  }, [status, finish]);

  useEffect(() => () => clearTimeout(finishTimerRef.current), []);

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
          onClick={() => { introRef.current = false; stopSpeaking(); stop(); navigate('/'); }}
          icon={<ChevronLeft size={22} strokeWidth={1.75} />}
        />
        {/* Her face in the header too, so the person you are speaking to is on
            screen for the whole session and not only inside the bubbles. */}
        <img src="/ainur_avatar.png" alt="" className="ai-avatar" />
        <h1 className="ai-activity-title">{isFree ? 'Free talk' : 'Describe pictures'}</h1>
        {isFree ? (
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
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
            <div className={`ai-bubble${fresh ? ' ai-bubble--new' : ''}`}>
              <img
                src="/ainur_avatar.png"
                alt=""
                className={`ai-avatar${status === 'sending' ? ' ai-avatar--pulse' : ''}`}
              />
              <div className="ai-bubble-body">
                <div className="ai-bubble-head">
                  <p className="ai-bubble-name">AInur</p>
                  {/* What is expected of them, in words, at every moment. The
                      rule -- one answer and the picture moves on -- used to be
                      known only to the code, so the learner could not tell
                      whether they had finished with this photo or not. */}
                  <span className="ai-step">
                    {intro ? 'Asking you…'
                      : status === 'sending' ? 'Listening to your answer…'
                        : 'Describe it, then tap to finish'}
                  </span>
                  {fresh && status !== 'sending' && (
                    <span className="ai-new-flag">New question</span>
                  )}
                </div>
                <p className="ai-bubble-text">{reply || opener}</p>
              </div>
            </div>

            {/* The hold before the next picture, said out loud. Without it the
                screen sat still for nearly three seconds after the learner's
                last answer and looked broken. */}
            {advancing && (
              <div className="ai-advancing" role="status">
                <span className="ai-advancing-text">
                  Got it — next picture…
                </span>
                <span className="ai-advancing-bar" aria-hidden="true" />
              </div>
            )}

            <AiDescribeStage
              image={image}
              hits={hits}
              justHit={justHit}
              heard={heard}
            />
          </>
        )}
      </div>

      <div className="ai-activity-foot">
        {(error || turnError) && (
          <p style={{
            margin: '0 0 var(--s-3)', textAlign: 'center',
            fontSize: 'var(--fs-sm)', color: 'var(--danger)',
          }}>
            {error || turnError}
          </p>
        )}
        <MicButton
          status={status}
          active={active}
          intro={intro}
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
