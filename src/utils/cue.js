// A physical "something just happened" signal for the silent activities.
//
// Deliberately VIBRATION, not a sound. Describing pictures runs with the
// microphone open continuously, so any chime we play goes straight back into
// the recorder and out to Whisper as part of the learner's answer. A buzz
// cannot pollute the transcript, and on a phone — where this app lives — it is
// the stronger signal anyway.
//
// Everything here is best-effort: navigator.vibrate is absent on desktop and on
// iOS Safari, and browsers ignore it until the page has been interacted with.
// The visual state is always the real channel; this only sharpens it.
export function cue(pattern = 18) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // A device that refuses to buzz is not an error worth reporting.
  }
}

// Two short pulses: used when the picture changes, so it reads as a bigger
// event than a new question on the same picture.
export const cueStep = () => cue([14, 60, 14]);

// A SHORT RISING BLIP when a word on the list is finally used.
//
// The rule at the top of this file said no sound, and the reason was real: the
// microphone runs continuously, so anything played through the speaker is
// recorded and sent to Whisper as part of the answer. What changed is WHEN this
// fires. Words are credited by the server, so a word only ever lights up while
// the loop is HELD — the recorder is closed, AInur is about to speak, and
// nothing is listening. That is the one window where a sound is free.
//
// Synthesised rather than shipped as a file: two oscillator notes cost no
// bytes, no request and no cache, and the pitch can climb with the number of
// words won so getting two at once sounds better than getting one.
let audioCtx = null;
export function wordWon(count = 1) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    // Autoplay policy parks the context until a gesture; the session always
    // starts with a tap, so a resume here is enough.
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const now = audioCtx.currentTime;
    // Two notes, a rising interval. More words won, higher and brighter.
    const base = 660 + Math.min(count - 1, 3) * 110;
    [0, 0.085].forEach((offset, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(i === 0 ? base : base * 1.5, now + offset);
      // Short, and it fades — a square-edged stop clicks.
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.09, now + offset + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.14);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.16);
    });
    // The buzz still fires alongside it: a phone on silent must not lose the
    // signal entirely.
    cue([12, 40, 18]);
  } catch {
    // No WebAudio, a blocked context, a device that refuses — the pill still
    // animates, which is the channel that always works.
  }
}
