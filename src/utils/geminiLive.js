// One Gemini Live session in the browser — the warm-up call's voice line.
//
// The browser talks to Gemini directly over a WebSocket with a ONE-USE
// ephemeral token from `warmupCallStart`; the model, voice and the whole
// system prompt are locked inside that token on the server, so nothing here
// can change what AInur is told. Audio: mic → 16 kHz PCM up, 24 kHz PCM down
// (src/utils/livePcm.js).
//
// HALF-DUPLEX on purpose: while AInur's voice is playing (plus a short tail)
// the microphone is not sent. Phones on speaker and laptops without headphones
// otherwise feed her own voice back to her — she interrupts herself, and her
// words land in the learner's transcript (which the closing screen quotes).
// Waiting for her to finish costs a learner almost nothing in a warm-up.

import { downsampleToInt16, int16ToBase64, base64ToFloat32, rms, LIVE_OUT_RATE } from './livePcm';

const WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';
// Mic frames are batched to ~100 ms before sending.
const SEND_EVERY_SEC = 0.1;
// After her last sample plays, the mic stays closed this long (room echo).
const ECHO_TAIL_MS = 350;

const WORKLET_SRC = `
class MicTap extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('mic-tap', MicTap);
`;

/**
 * openLiveSession({ token, model, on }) → controller.
 * `on(type, payload)` events:
 *   ready                — setup done, mic open
 *   speaking (bool)      — AInur's voice is playing
 *   level (0..1)         — the learner's mic level (while the mic is open)
 *   aiText (string)      — her words so far in the current turn
 *   meText (string)      — the learner's words so far in the current turn
 *   line ({who, text})   — a finished line
 *   turnComplete
 *   usage (object)       — latest usageMetadata
 *   goAway
 *   closed ({code, reason})
 *   error (Error)
 */
export async function openLiveSession({ token, model, on }) {
  const emit = (type, payload) => { try { on(type, payload); } catch { /* UI errors stay in the UI */ } };

  // The mic first: a refusal is the learner's choice and must surface before
  // the one-use token is spent on a connection.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });

  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

  let closed = false;
  let ws = null;
  let micNode = null;
  let srcNode = null;
  let muteSink = null;
  let pending = [];
  let pendingLen = 0;
  let playHead = 0;
  const playing = new Set();
  let speaking = false;
  let quietUntil = 0;
  let aiText = '';
  let meText = '';
  let lastLevelAt = 0;
  let pollTimer = null;
  let onReady = null;

  const send = (obj) => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  };

  const setSpeaking = (v) => {
    if (v === speaking) return;
    speaking = v;
    if (!v) quietUntil = Date.now() + ECHO_TAIL_MS;
    emit('speaking', v);
  };

  const flushPlayback = () => {
    for (const s of playing) { try { s.stop(); } catch { /* already ended */ } }
    playing.clear();
    playHead = ctx.currentTime;
    setSpeaking(false);
  };

  const enqueueAudio = (b64) => {
    const samples = base64ToFloat32(b64);
    if (!samples.length) return;
    const buf = ctx.createBuffer(1, samples.length, LIVE_OUT_RATE);
    buf.copyToChannel(samples, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const at = Math.max(ctx.currentTime + 0.03, playHead);
    src.start(at);
    playHead = at + buf.duration;
    playing.add(src);
    src.onended = () => playing.delete(src);
    setSpeaking(true);
  };

  const finishLine = (who) => {
    const text = (who === 'ai' ? aiText : meText).replace(/\s+/g, ' ').trim();
    if (who === 'ai') aiText = ''; else meText = '';
    if (text) emit('line', { who, text });
  };

  const onMicFrame = (frame) => {
    if (closed) return;
    const now = Date.now();
    if (now - lastLevelAt > 120) { lastLevelAt = now; emit('level', speaking ? 0 : Math.min(1, rms(frame) * 6)); }
    // Half-duplex: nothing goes up while she speaks, or just after.
    if (speaking || now < quietUntil) { pending = []; pendingLen = 0; return; }
    pending.push(frame);
    pendingLen += frame.length;
    if (pendingLen < ctx.sampleRate * SEND_EVERY_SEC) return;
    const joined = new Float32Array(pendingLen);
    let o = 0;
    for (const f of pending) { joined.set(f, o); o += f.length; }
    pending = []; pendingLen = 0;
    const pcm = downsampleToInt16(joined, ctx.sampleRate);
    send({ realtimeInput: { audio: { data: int16ToBase64(pcm), mimeType: 'audio/pcm;rate=16000' } } });
  };

  const startMic = async () => {
    srcNode = ctx.createMediaStreamSource(stream);
    // The tap must reach the destination to be pulled, but silently.
    muteSink = ctx.createGain();
    muteSink.gain.value = 0;
    muteSink.connect(ctx.destination);
    if (ctx.audioWorklet) {
      const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
      try {
        await ctx.audioWorklet.addModule(url);
        micNode = new AudioWorkletNode(ctx, 'mic-tap');
        micNode.port.onmessage = (e) => onMicFrame(e.data);
      } finally {
        URL.revokeObjectURL(url);
      }
    } else {
      // Old WebViews: ScriptProcessor is deprecated but still everywhere.
      micNode = ctx.createScriptProcessor(2048, 1, 1);
      micNode.onaudioprocess = (e) => onMicFrame(e.inputBuffer.getChannelData(0).slice(0));
    }
    srcNode.connect(micNode);
    micNode.connect(muteSink);
  };

  const handle = async (msg) => {
    if (msg.setupComplete) {
      await startMic();
      // When nothing is queued any more, she has stopped speaking.
      pollTimer = setInterval(() => {
        if (speaking && playing.size === 0 && ctx.currentTime >= playHead) setSpeaking(false);
      }, 100);
      emit('ready');
      if (onReady) onReady();
      return;
    }
    const sc = msg.serverContent;
    if (sc) {
      if (sc.interrupted) flushPlayback();
      if (sc.inputTranscription && sc.inputTranscription.text) {
        meText += sc.inputTranscription.text;
        emit('meText', meText.trim());
      }
      const parts = (sc.modelTurn && sc.modelTurn.parts) || [];
      for (const p of parts) {
        if (p.inlineData && p.inlineData.data) {
          // Her answer has started: the learner's line is over.
          if (meText) finishLine('me');
          enqueueAudio(p.inlineData.data);
        }
      }
      if (sc.outputTranscription && sc.outputTranscription.text) {
        if (meText) finishLine('me');
        aiText += sc.outputTranscription.text;
        emit('aiText', aiText.trim());
      }
      if (sc.turnComplete) {
        finishLine('ai');
        emit('turnComplete');
      }
    }
    if (msg.usageMetadata) emit('usage', msg.usageMetadata);
    if (msg.goAway) emit('goAway', msg.goAway);
  };

  const teardown = () => {
    if (closed) return;
    closed = true;
    clearInterval(pollTimer);
    try { if (ws && ws.readyState <= 1) ws.close(1000, 'done'); } catch { /* closing */ }
    try { micNode && micNode.disconnect(); } catch { /* gone */ }
    try { srcNode && srcNode.disconnect(); } catch { /* gone */ }
    stream.getTracks().forEach((t) => t.stop());
    for (const s of playing) { try { s.stop(); } catch { /* ended */ } }
    playing.clear();
    ctx.close().catch(() => {});
  };

  // Resolves once the server has accepted the setup and the mic is running —
  // nothing may be sent before setupComplete.
  await new Promise((resolve, reject) => {
    let ready = false;
    onReady = () => { ready = true; resolve(); };
    const fail = (e) => { if (!ready) { teardown(); reject(e); } };
    try {
      ws = new WebSocket(`${WS_URL}?access_token=${encodeURIComponent(token)}`);
    } catch (e) {
      fail(e);
      return;
    }
    ws.onopen = () => send({ setup: { model: `models/${model}` } });
    ws.onmessage = async (ev) => {
      let text = ev.data;
      if (typeof text !== 'string') text = await (ev.data.text ? ev.data.text() : new Response(ev.data).text());
      let msg;
      try { msg = JSON.parse(text); } catch { return; }
      handle(msg).catch((e) => { emit('error', e); fail(e); });
    };
    ws.onerror = () => fail(new Error('live-connect-failed'));
    ws.onclose = (ev) => {
      // Keep any half-spoken lines.
      if (meText) finishLine('me');
      if (aiText) finishLine('ai');
      if (!ready) { fail(new Error(`live-closed-${ev.code}:${ev.reason || ''}`)); return; }
      teardown();
      emit('closed', { code: ev.code, reason: ev.reason });
    };
  });

  return {
    // A stage cue for AInur: '[start]' or '[wrap-up]' (her prompt knows both).
    cue(text) {
      send({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } });
    },
    close() {
      try { ws && ws.close(1000, 'done'); } catch { /* closing */ }
      teardown();
    },
    get speaking() { return speaking; },
  };
}
