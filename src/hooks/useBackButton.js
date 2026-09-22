import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

// Android's hardware back button.
//
// Capacitor 8's bridge does not touch it — grep its 60 Java files and neither
// `onBackPressed` nor `backButton` appears — so with no JS listener Android
// does its default: finish the activity. One back press closed SpeakLab
// outright. Mid-call that was worse than annoying: the route unmounts, Chat's
// cleanup stops the microphone and leaves the Agora channel, and the call is
// simply gone. A user reported it as "you press back and the screen goes off".
//
// Screens register their own handler here. The most recently mounted enabled
// one runs first and returns true when it has consumed the press — which is
// what a person means by "back": the thing that is in front of me closes.
// Nobody consuming it falls through to history, and at the root we MINIMISE
// rather than exit, so the app is where they left it when they come back.
const stack = [];
let wired = false;

function wire() {
  if (wired || !Capacitor.isNativePlatform()) return;
  wired = true;
  App.addListener('backButton', ({ canGoBack }) => {
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      try {
        if (stack[i]()) return;
      } catch (e) {
        console.warn('[back] handler failed:', e.message);
      }
    }
    if (canGoBack) {
      window.history.back();
      return;
    }
    App.minimizeApp().catch(() => {});
  }).catch((e) => console.warn('[back] listener not registered:', e.message));
}

/**
 * @param {() => boolean} handler returns true when it handled the press.
 * @param {boolean} enabled
 */
export default function useBackButton(handler, enabled = true) {
  // The handler reads state that changes every render; a ref keeps the entry
  // in the stack stable so it is not pushed and popped on each one.
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform()) return undefined;
    wire();
    const fn = () => ref.current();
    stack.push(fn);
    return () => {
      const i = stack.indexOf(fn);
      if (i !== -1) stack.splice(i, 1);
    };
  }, [enabled]);
}
