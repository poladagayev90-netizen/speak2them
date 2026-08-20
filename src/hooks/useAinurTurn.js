import { useCallback, useEffect, useRef, useState } from 'react';
import { auth } from '../firebase';
import { FUNCTIONS_BASE } from '../constants';

// One exchange with AInur: record → send → hear her answer.
//
// Deliberately NOT push-to-talk. The old /ai-chat screen made you hold a button
// down, which is fine for one sentence and unusable for the 60–90 seconds a
// picture description actually takes. Here you tap once to start and once to
// stop, and a run of silence stops it for you.
//
// status: 'idle' | 'recording' | 'sending' | 'speaking'

const SILENCE_STOP_MS = 2600;   // long enough to think mid-sentence
const MIN_SPEAK_MS = 900;       // ignore an accidental double tap
const MAX_SPEAK_MS = 120000;    // hard ceiling; also bounds the upload size

export default function useAinurTurn() {
  const [status, setStatus] = useState('idle');
  const [level, setLevel] = useState(0);       // 0..1 mic input, for the meter
  const [error, setError] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const startedAtRef = useRef(0);
  const lastVoiceAtRef = useRef(0);
  const audioElRef = useRef(null);
  const resolveRef = useRef(null);
  const autoStopRef = useRef(null);

  const cleanupAudio = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }, []);

  // Stop everything on unmount, or a closed tab keeps the mic light on.
  useEffect(() => () => {
    cleanupAudio();
    if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current = null; }
  }, [cleanupAudio]);

  const startRecording = useCallback(async () => {
    setError('');
    // Barge-in: tapping the mic while AInur is talking cuts her off, the same
    // way you would interrupt a person.
    if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current = null; }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('SpeakLab needs your microphone. Allow access and try again.');
      setStatus('idle');
      return false;
    }
    streamRef.current = stream;

    // Level meter + silence detection share one analyser. This is the same
    // approach as localRecorder.js: read the waveform on an audio thread rather
    // than guessing from timing.
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
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
        if (peak > 0.06) lastVoiceAtRef.current = now;
        setElapsedMs(now - startedAtRef.current);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // No meter is a cosmetic loss; recording still works.
    }

    let mr;
    // iOS Safari has no webm; fall back rather than throwing.
    const types = ['audio/webm', 'audio/mp4', ''];
    for (const t of types) {
      try { mr = t ? new MediaRecorder(stream, { mimeType: t }) : new MediaRecorder(stream); break; } catch { /* next */ }
    }
    if (!mr) {
      setError('This browser cannot record audio.');
      cleanupAudio();
      setStatus('idle');
      return false;
    }

    chunksRef.current = [];
    mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
      cleanupAudio();
      setLevel(0);
      const resolve = resolveRef.current;
      resolveRef.current = null;
      if (resolve) resolve(blob);
    };

    recorderRef.current = mr;
    startedAtRef.current = Date.now();
    lastVoiceAtRef.current = Date.now();
    setElapsedMs(0);
    mr.start(250);
    setStatus('recording');

    // Auto-stop on a run of silence, and a hard ceiling so a forgotten session
    // cannot upload ten minutes of room tone.
    autoStopRef.current = setInterval(() => {
      const now = Date.now();
      const spoken = now - startedAtRef.current;
      const quiet = now - lastVoiceAtRef.current;
      if (spoken > MAX_SPEAK_MS || (spoken > MIN_SPEAK_MS && quiet > SILENCE_STOP_MS)) {
        if (recorderRef.current && recorderRef.current.state === 'recording') recorderRef.current.stop();
        clearInterval(autoStopRef.current);
        autoStopRef.current = null;
      }
    }, 300);

    return true;
  }, [cleanupAudio]);

  const stopRecording = useCallback(() => new Promise((resolve) => {
    if (autoStopRef.current) { clearInterval(autoStopRef.current); autoStopRef.current = null; }
    const mr = recorderRef.current;
    if (!mr || mr.state === 'inactive') { resolve(null); return; }
    resolveRef.current = resolve;
    mr.stop();
  }), []);

  // Send the recording and play the answer. Returns the server payload so the
  // caller can light up keyword pills and append to the on-screen transcript.
  const send = useCallback(async (blob, payload) => {
    if (!blob || blob.size < 1200) {
      setStatus('idle');
      setError('That was very short. Tap the microphone and tell me more.');
      return null;
    }
    setStatus('sending');
    setError('');

    const base64Audio = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    let data;
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch(`${FUNCTIONS_BASE}/aiActivityTurn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ ...payload, base64Audio, mimeType: blob.type || 'audio/webm' }),
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        setStatus('idle');
        return null;
      }
    } catch {
      setError('No connection. Check your internet and try again.');
      setStatus('idle');
      return null;
    }

    if (data.silent) {
      setError('I could not hear anything. Tap the microphone and speak again.');
      setStatus('idle');
      return data;
    }

    if (data.audioBase64) {
      const el = new Audio(`data:audio/mp3;base64,${data.audioBase64}`);
      audioElRef.current = el;
      setStatus('speaking');
      el.onended = () => { audioElRef.current = null; setStatus('idle'); };
      el.onerror = () => { audioElRef.current = null; setStatus('idle'); };
      el.play().catch(() => { audioElRef.current = null; setStatus('idle'); });
    } else {
      // TTS can fail on its own; the reply is still on screen.
      setStatus('idle');
    }
    return data;
  }, []);

  return { status, level, error, elapsedMs, startRecording, stopRecording, send, setError };
}
