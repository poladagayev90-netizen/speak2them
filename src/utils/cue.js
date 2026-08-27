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
