// Audio for the Gemini Live API (the warm-up call) — pure, tested in
// livePcm.test.js. Live takes raw 16-bit little-endian PCM at 16 kHz and
// answers with the same at 24 kHz, both base64 inside JSON messages.

export const LIVE_IN_RATE = 16000;
export const LIVE_OUT_RATE = 24000;

// Microphone samples (Float32, the AudioContext's own rate — 44.1/48 kHz on
// most devices) → 16 kHz Int16. Averaging each output sample's window is a
// cheap low-pass, enough for speech that a speech model then hears.
export function downsampleToInt16(input, inRate, outRate = LIVE_IN_RATE) {
  if (!input || !input.length) return new Int16Array(0);
  const ratio = inRate / outRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = start; j < end; j += 1) sum += input[j];
    const s = Math.max(-1, Math.min(1, sum / (end - start)));
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }
  return out;
}

export function int16ToBase64(int16) {
  const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

// base64 PCM16 LE → Float32 in [-1, 1] for an AudioBuffer.
export function base64ToFloat32(b64) {
  const bin = atob(b64 || '');
  const n = Math.floor(bin.length / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    if (v >= 0x8000) v -= 0x10000;
    out[i] = v / 0x8000;
  }
  return out;
}

// Root-mean-square of a frame — drives the "you are being heard" ring.
export function rms(frame) {
  if (!frame || !frame.length) return 0;
  let s = 0;
  for (let i = 0; i < frame.length; i += 1) s += frame[i] * frame[i];
  return Math.sqrt(s / frame.length);
}
