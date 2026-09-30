import { useEffect } from 'react';

// Keeps the screen on while `active` (a call is open).
//
// Rümeysa (2026-09-30): when her phone dimmed and locked mid-call, the browser
// suspended the microphone and her partner heard nothing while she kept
// talking. The Screen Wake Lock API stops the screen timing out. The browser
// drops the lock whenever the page is hidden, so it is taken again on return.
// It cannot help if the learner presses the power button; nothing a web page
// can do keeps the mic alive then.
export default function useWakeLock(active) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.wakeLock) return undefined;
    let lock = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) { lock.release().catch(() => {}); lock = null; }
      } catch { /* battery saver or unsupported: the call still works */ }
    };
    const onVisible = () => { if (document.visibilityState === 'visible' && (!lock || lock.released)) acquire(); };

    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (lock) lock.release().catch(() => {});
    };
  }, [active]);
}
