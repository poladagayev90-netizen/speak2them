import { useEffect } from 'react';

// Keeps the screen on while `active` (a call is open).
//
// Rümeysa (2026-09-30): when her phone dimmed and locked mid-call, the browser
// suspended the microphone and her partner heard nothing while she kept
// talking. Two mechanisms, because no single one covers every phone:
//
//   1. The Screen Wake Lock API — Chrome/Android, and Safari 16.4+. The
//      browser drops the lock whenever the page is hidden, so it is taken
//      again on return.
//   2. iPhone/iPad: a muted, inline, looping 2-second video. iOS does not
//      auto-lock while a video plays, and this works where the API does not
//      (an app added to the home screen before iOS 18.4, older iOS). On iOS
//      both run; the video costs nothing (1.8 KB, black, no sound).
//
// Nothing a web page does helps if the learner presses the power button.
const isIOS = () => typeof navigator !== 'undefined'
  && (/iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

function startVideo() {
  const v = document.createElement('video');
  v.setAttribute('playsinline', '');
  v.setAttribute('muted', '');
  v.muted = true;
  v.loop = true;
  v.src = '/keep-awake.mp4';
  v.setAttribute('aria-hidden', 'true');
  // Must stay in the DOM and "visible" for iOS to count it as playing.
  Object.assign(v.style, {
    position: 'fixed', width: '1px', height: '1px', left: '0', bottom: '0',
    opacity: '0.01', pointerEvents: 'none', zIndex: '-1',
  });
  document.body.appendChild(v);
  const play = () => v.play().catch(() => {});
  play();
  return { video: v, play };
}

export default function useWakeLock(active) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;
    let lock = null;
    let cancelled = false;
    const hasApi = typeof navigator !== 'undefined' && !!navigator.wakeLock;
    const fallback = isIOS() || !hasApi ? startVideo() : null;

    const acquire = async () => {
      if (!hasApi || cancelled || document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) { lock.release().catch(() => {}); lock = null; }
      } catch { /* battery saver or unsupported: the video / the call still work */ }
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (!lock || lock.released) acquire();
      // iOS pauses media in a hidden page; resume it on return.
      if (fallback) fallback.play();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (lock) lock.release().catch(() => {});
      if (fallback) {
        fallback.video.pause();
        fallback.video.removeAttribute('src');
        fallback.video.load();
        fallback.video.remove();
      }
    };
  }, [active]);
}
