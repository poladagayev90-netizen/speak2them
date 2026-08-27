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
import { cue, cueStep } from '../utils/cue';
import AiDescribeStage from '../components/ai/AiDescribeStage';
import MicButton from '../components/ai/MicButton';
import Button from '../components/ui/Button';
import '../components/ai/ai.css';

// A describing session with AInur: five pictures, one question each.
// Ends with the same analysis a human call produces, which is what reaches the
// teacher.
//
// ONE TAP AND ONE SPOKEN LINE, for the whole session. She says a single
// sentence as it opens; after that the activity is silent. You describe a
// picture, she asks one follow-up IN WRITING, you answer, she says one line back
// about that answer, and the next picture appears with the microphone already
// live. There is no record button per picture and no waiting for her to stop
// talking before you may speak.
//
// Why the voice went: hearing every reply cost five to eight seconds after each
// answer, twice per picture, in which the learner could do nothing at all — and
// it was most of what the activity cost to run. A written question is read in a
// second and, unlike a spoken one, is still there while they think.
const PICTURES_PER_SESSION = 5;
// Describe the picture, then answer the one follow-up. She answers that answer
// too, with a single sentence and no question, and the picture moves on once it
// has been on screen long enough to read.
const TURNS_PER_PICTURE = 2;

// The one line she says out loud, at the start of the session only. It is a
// fixed string, so its audio is synthesised once and then served from the
// device forever. It also stays on screen for every picture as the standing
// instruction, because a learner looking at a photo with nothing asked of them
// freezes.
// ⚠️ The server keeps an allowlist of speakable lines (SPEAKABLE_LINES in
// functions/index.js). Changing this string without adding it there makes
// speakLine return 400 and AInur goes silent for every learner, with nothing on
// screen to explain it. That is exactly how this activity broke once.
const DESCRIBE_PROMPT = 'How can you describe this photo?';

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
  // The activity is SILENT — no voice after the opening line — so every step it
  // takes has to be visible or the learner is left staring at a photo
  // wondering whether anything happened. `advancing` is the hold before the
  // next picture; `fresh` marks a question that has just arrived.
  const [advancing, setAdvancing] = useState(false);
  const [fresh, setFresh] = useState(false);

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
  const finishTimerRef = useRef(null);
  const finishScheduledRef = useRef(false);
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
    return data;
  }, [content.day, user]);

  const { status, active, level, elapsedMs, error, start, stop, submit, interrupt } =
    useAinurSession({ onSegment: handleSegment });

  // The picture changes once her closing line has been on screen long enough to
  // read. It used to change the instant the turn settled, which -- back when the
  // closing turn produced no line at all -- meant the learner's answer was met
  // by the photo silently swapping. She replies to it now, so the reply needs a
  // beat: swapping the picture under her sentence hides the very thing that was
  // missing.
  useEffect(() => {
    if (status !== 'listening' || !pendingAdvanceRef.current) return;
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
      setHeard('');
      setReply('');
      setAdvancing(false);
      cueStep();
    }, CLOSING_READ_MS);
  }, [status]);

  // A new question has to announce itself. Silent activity, same avatar, same
  // bubble in the same place — the text simply changed, and nobody looking at
  // the photo noticed. It now arrives with a buzz and a "New question" flag
  // that fades on its own.
  useEffect(() => {
    if (!reply) return undefined;
    setFresh(true);
    cue();
    const t = setTimeout(() => setFresh(false), 4000);
    return () => clearTimeout(t);
  }, [reply]);

  // Only leaving the screen cancels a pending picture change.
  useEffect(() => () => clearTimeout(advanceTimerRef.current), []);

  useEffect(() => {
    if (isFree) return undefined;
    let cancelled = false;
    fetchTopicImages(content.day, content.imageKeywords, content.manualImageUrls).then((list) => {
      if (!cancelled) setImages((list || []).slice(0, PICTURES_PER_SESSION));
    });
    return () => { cancelled = true; };
  }, [content, isFree]);

  // One line for the whole session, not one per picture. It stays on screen
  // under her name until she has asked her follow-up.
  const opener = isFree ? freeOpener(plainTopic(content.topic)) : DESCRIBE_PROMPT;

  const ready = isFree || !!image;

  // Fetch the opening line while they are still looking at the first picture,
  // so the tap does not wait on a network round trip. Costs nothing after the
  // first time on this device: the audio is cached.
  // Keyed on the uid, not just mount: auth restores asynchronously and a prime
  // fired before it lands has no token to send, so it would quietly do nothing
  // and never retry.
  useEffect(() => { if (user?.uid) primeLine(opener); }, [opener, user?.uid]);

  // She speaks BEFORE the microphone opens, never over it. Run together, the
  // recorder hears her through the speaker and Whisper hands back AInur's own
  // question as the learner's first sentence.
  //
  // But the voice never delays the lesson. If the line is not already on the
  // device — offline, a cold start, or the server refused it — the microphone
  // opens immediately and the sentence stays on screen unspoken.
  const beginSession = useCallback(async () => {
    if (!hasLine(opener)) {
      // A prime is probably already in flight from the effect above. Give it a
      // moment to land so even the very first session hears her — but cap the
      // wait hard: a slow network must never hold the microphone shut.
      await Promise.race([primeLine(opener), new Promise((r) => { setTimeout(r, 1200); })]);
    }
    if (!hasLine(opener)) { start(); return; }
    introRef.current = true;
    setIntro(true);
    await speakLine(opener);        // resolves when she has finished, not when she starts
    if (!introRef.current) return;  // skipped, finished early, or the screen was left
    introRef.current = false;
    setIntro(false);
    start();
  }, [opener, start]);

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
    // Tapping through the opening line skips it rather than restarting it.
    if (intro) {
      introRef.current = false;
      setIntro(false);
      stopSpeaking();
      start();
      return;
    }
    if (!active) { beginSession(); return; }
    if (status === 'speaking') { interrupt(); return; }
    // Already sending: a second tap must not queue anything or tear the
    // session down. Doing nothing is the honest response to "one moment".
    if (status === 'sending') return;
    submit();
  }, [intro, active, status, beginSession, start, submit, interrupt]);

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
  // return to 'listening' so it cannot cut across a reply still arriving, then
  // held for the same beat as a picture change: without the hold, her sentence
  // about the FIFTH answer was generated, paid for, and replaced by the
  // "Marking your session" screen before anyone could read it -- the last
  // answer of the session being the one answer that still got nothing back.
  // Guarded by its own flag because this effect re-runs on every status change,
  // and the timer must not be rescheduled or cancelled once it is set.
  useEffect(() => {
    if (!pendingFinishRef.current || status !== 'listening' || finishScheduledRef.current) return;
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
                  {/* Which answer this is. Two answers per picture was a rule
                      only the code knew: the learner could not tell whether
                      they had finished with this photo or not. */}
                  <span className="ai-step">
                    {status === 'sending'
                      ? 'Listening to your answer…'
                      : `Answer ${Math.min(turnIndex + 1, TURNS_PER_PICTURE)} of ${TURNS_PER_PICTURE}`}
                  </span>
                  {fresh && status !== 'sending' && (
                    <span className="ai-new-flag">New question</span>
                  )}
                </div>
                <p className="ai-bubble-text">
                  {status === 'sending' ? (reply || opener) : (reply || opener)}
                </p>
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

            <AiDescribeStage image={image} hits={hits} heard={heard} />
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
