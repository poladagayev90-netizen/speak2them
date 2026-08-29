import { useCallback, useEffect, useRef, useState } from 'react';

// A hands-free speaking session with AInur.
//
// You tap once to begin. After that it listens, notices when you have stopped
// talking, sends what you said, plays her answer, and starts listening again.
// Tapping while it listens means "I have finished this answer" and sends it
// immediately (submit); tapping while she is talking interrupts her, the same
// way you would interrupt a person. Ending the session is the Finish button,
// NOT the microphone — see the note on submit() for what it cost to learn
// that the two must not share a control.
//
// THE BUG THIS REPLACES, because it must never come back:
// the old hook auto-stopped the recorder from a timer, handed the blob to
// whoever happened to be awaiting a promise, and if nobody was awaiting it the
// recording was silently DROPPED. Worse, its onstop closed the AudioContext,
// which killed the animation frame driving the timer. So the button froze at
// 0:02, still looking like it was recording, and a learner could talk for a full
// minute into a recorder that had already stopped and thrown the audio away.
//
// Three rules come out of that:
//   1. The loop owns the recording. A finished segment is always delivered to
//      onSegment — there is no path where audio is captured and discarded.
//   2. Silence may only END a segment we have actually heard speech in. An
//      AudioContext starts suspended in Chrome, so "no voice detected" is the
//      normal state before resume() lands; treating it as silence is what cut
//      people off at three seconds.
//   3. State is set in one place per transition, so the button can never show
//      one thing while the recorder is doing another.

// How long the room has to stay quiet before a segment is treated as finished.
//
// 2.2 seconds was too short and it was breaking the activity: a learner who
// stopped to think mid-answer -- searching for the word they had been asked to
// use, which this activity asks for constantly -- had their half-sentence sent
// while they were still composing it. Reported as "I pause to think and the
// system decides I have stopped". Four seconds is longer than a thinking pause
// inside a sentence and still shorter than the gap after a finished one, and
// anyone who wants to send sooner taps the button, which says so.
const SILENCE_STOP_MS = 4000;
const MIN_SEGMENT_MS = 1200;    // ignore a stray tap
// Hard ceiling. Two minutes was too generous: someone who talks without a clear
// pause got no response at all for that whole time, which is indistinguishable
// from the app being broken. Forty-five seconds is longer than any single answer
// this activity asks for, and the loop simply picks up where it left off.
const MAX_SEGMENT_MS = 45000;
const VOICE_THRESHOLD = 0.045;  // peak amplitude that counts as speech
// Nothing heard at ALL, as opposed to a pause inside an answer. Raised with the
// silence delay above: a learner looking at a new photograph and thinking about
// how to start needs longer than a learner mid-sentence, not less.
const NO_VOICE_GRACE_MS = 16000;

export default function useAinurSession({ onSegment }) {
  const [status, setStatus] = useState('idle'); // idle | listening | sending | speaking | held
  const [active, setActive] = useState(false);  // is the session running?
  const [level, setLevel] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState('');

  const activeRef = useRef(false);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const lastVoiceAtRef = useRef(0);
  const heardVoiceRef = useRef(false);
  const autoStopRef = useRef(null);
  // Set by submit(): this segment is ending because the learner said it was
  // finished, not because the room went quiet.
  const submitRef = useRef(false);
  // The session is running but something else owns the audio right now — AInur
  // saying a line out loud through the same speaker the microphone can hear. A
  // held loop keeps the stream and the session alive and simply does not open a
  // recorder, so her question cannot be recorded and sent back as the learner's
  // own words. Set by a segment handler returning `hold: true`, cleared by
  // resume().
  const pausedRef = useRef(false);
  const audioElRef = useRef(null);
  const onSegmentRef = useRef(onSegment);
  onSegmentRef.current = onSegment;

  const stopMeter = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setLevel(0);
  }, []);

  const releaseMic = useCallback(() => {
    stopMeter();
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }, [stopMeter]);

  const stopPlayback = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.onended = null;
      audioElRef.current.pause();
      audioElRef.current = null;
    }
  }, []);

  // ── one listening segment ────────────────────────────────────────────────
  const listen = useCallback(async () => {
    if (!activeRef.current) return;

    let stream = streamRef.current;
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        setError('SpeakLab needs your microphone. Allow access and tap again.');
        activeRef.current = false;
        setActive(false);
        setStatus('idle');
        return;
      }
      streamRef.current = stream;
    }
    if (!activeRef.current) return;

    // Level meter + speech detection. The context is explicitly resumed: Chrome
    // creates it suspended, and a suspended analyser reports pure silence, which
    // is precisely what used to end a segment before the learner had said a word.
    if (!audioCtxRef.current) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);

        const tick = () => {
          analyser.getByteTimeDomainData(buf);
          let peak = 0;
          for (let i = 0; i < buf.length; i += 1) {
            const v = Math.abs(buf[i] - 128) / 128;
            if (v > peak) peak = v;
          }
          setLevel(peak);
          const now = Date.now();
          if (peak > VOICE_THRESHOLD) {
            lastVoiceAtRef.current = now;
            heardVoiceRef.current = true;
          }
          if (recorderRef.current && recorderRef.current.state === 'recording') {
            setElapsedMs(now - startedAtRef.current);
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        // No meter. Recording still works; the segment then ends on the hard
        // ceiling or on a manual tap, never on a silence we cannot measure.
        audioCtxRef.current = null;
      }
    }

    let mr = null;
    for (const type of ['audio/webm', 'audio/mp4', '']) {
      try { mr = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream); break; } catch { /* next */ }
    }
    if (!mr) {
      setError('This browser cannot record audio.');
      activeRef.current = false; setActive(false); setStatus('idle');
      return;
    }

    chunksRef.current = [];
    mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };

    // The ONLY exit from a segment. Whatever caused the stop — silence, the
    // ceiling, a tap, the session ending — the audio goes to onSegment.
    mr.onstop = async () => {
      if (autoStopRef.current) { clearInterval(autoStopRef.current); autoStopRef.current = null; }
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
      chunksRef.current = [];
      recorderRef.current = null;
      setElapsedMs(0);
      // Read and clear here: a deliberate "I have finished" tap must survive
      // into the checks below, and must not leak into the next segment.
      const submitted = submitRef.current;
      submitRef.current = false;

      if (!activeRef.current) return;               // session ended mid-segment
      // A tap on the button means "send this", so it overrides the voice
      // detector. Without the override a segment recorded while the meter
      // failed to start (no AudioContext) could never be sent at all, and the
      // learner would tap, watch nothing happen, and tap again.
      if (blob.size < 1200 || (!heardVoiceRef.current && !submitted)) {
        // Nothing worth sending. Listen again rather than bothering the learner.
        listen();
        return;
      }

      setStatus('sending');
      let result = null;
      try {
        result = await onSegmentRef.current(blob);
      } catch {
        result = null;
      }
      if (!activeRef.current) return;

      // The handler has taken the floor: stop the loop here instead of opening
      // the next recorder. Whoever asked for the hold owns resume().
      if (result && result.hold) {
        pausedRef.current = true;
        setStatus('held');
        return;
      }

      if (result && result.audioBase64) {
        const el = new Audio(`data:audio/mp3;base64,${result.audioBase64}`);
        audioElRef.current = el;
        setStatus('speaking');
        const done = () => {
          if (audioElRef.current !== el) return;    // superseded by a barge-in
          audioElRef.current = null;
          if (activeRef.current) listen();
        };
        el.onended = done;
        el.onerror = done;
        el.play().catch(done);
      } else {
        // No voice came back (TTS failed, or the turn was rejected). The session
        // continues either way — a missing voice is a degraded lesson, not a
        // dead one.
        listen();
      }
    };

    recorderRef.current = mr;
    startedAtRef.current = Date.now();
    lastVoiceAtRef.current = Date.now();
    heardVoiceRef.current = false;
    setElapsedMs(0);
    setError('');
    mr.start(250);
    setStatus('listening');

    autoStopRef.current = setInterval(() => {
      const rec = recorderRef.current;
      if (!rec || rec.state !== 'recording') return;
      const now = Date.now();
      const openMs = now - startedAtRef.current;
      const quietMs = now - lastVoiceAtRef.current;

      // Silence only ends a segment we have actually heard speech in. Before the
      // first word, silence means "they are still thinking", not "they are done".
      const endedTalking = heardVoiceRef.current && openMs > MIN_SEGMENT_MS && quietMs > SILENCE_STOP_MS;
      const neverSpoke = !heardVoiceRef.current && openMs > NO_VOICE_GRACE_MS;
      if (endedTalking || neverSpoke || openMs > MAX_SEGMENT_MS) {
        rec.stop();
      }
    }, 200);
  }, []);

  const start = useCallback(() => {
    if (activeRef.current) return;
    setError('');
    pausedRef.current = false;
    activeRef.current = true;
    setActive(true);
    listen();
  }, [listen]);

  // "I have finished my answer." Ends the current segment and sends it, and the
  // session carries on — this is NOT stop().
  //
  // It exists because the button that shows a stop square and a running timer
  // used to call stop(), and stop() clears activeRef BEFORE stopping the
  // recorder, so onstop hit its `!activeRef.current` guard and threw the answer
  // away. Tapping what looks exactly like "send" silently deleted what you had
  // just said and ended the session: no reply, no next picture, nothing on
  // screen to say why. Waiting out the silence timer was the only way to be
  // heard, and nobody knew that.
  const submit = useCallback(() => {
    const rec = recorderRef.current;
    if (!activeRef.current || !rec || rec.state !== 'recording') return false;
    submitRef.current = true;
    rec.stop();
    return true;
  }, []);

  // Give the floor back after a hold. Deliberately a no-op when the loop is not
  // held, so a stray call cannot open a second recorder alongside a live one.
  const resume = useCallback(() => {
    if (!activeRef.current || !pausedRef.current) return;
    pausedRef.current = false;
    listen();
  }, [listen]);

  const stop = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    pausedRef.current = false;
    submitRef.current = false;
    if (autoStopRef.current) { clearInterval(autoStopRef.current); autoStopRef.current = null; }
    const rec = recorderRef.current;
    if (rec && rec.state === 'recording') rec.stop();
    recorderRef.current = null;
    stopPlayback();
    releaseMic();
    setStatus('idle');
    setElapsedMs(0);
  }, [releaseMic, stopPlayback]);

  // Tapping while AInur talks cuts her off and starts listening immediately.
  const interrupt = useCallback(() => {
    stopPlayback();
    pausedRef.current = false;
    if (activeRef.current) listen();
  }, [listen, stopPlayback]);

  useEffect(() => () => {
    activeRef.current = false;
    if (autoStopRef.current) clearInterval(autoStopRef.current);
    stopPlayback();
    releaseMic();
  }, [releaseMic, stopPlayback]);

  return { status, active, level, elapsedMs, error, setError, start, stop, submit, resume, interrupt };
}
