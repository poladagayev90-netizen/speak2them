import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import {
  subscribeToUpdate, webUpdateReady, applyWebUpdate, checkWebUpdate,
  isAndroidApp, checkAndroidUpdate, startAndroidUpdate,
} from '../utils/appUpdate';
import { isInCall } from '../utils/presence';

// One quiet line when a new version of the app is out (utils/appUpdate.js):
// «New version · Refresh» on the web, «Update in Google Play» in the Android
// app. Never over a call or an open conversation: the web update also applies
// itself when the app comes back to the screen with nothing running.
export default function UpdateBanner() {
  const { pathname } = useLocation();
  const [web, setWeb] = useState(webUpdateReady);
  const [android, setAndroid] = useState(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => subscribeToUpdate(() => setWeb(webUpdateReady())), []);

  useEffect(() => {
    if (isAndroidApp()) {
      let alive = true;
      checkAndroidUpdate().then((r) => { if (alive) setAndroid(r); }).catch(() => {});
      return () => { alive = false; };
    }
    // Web: look for a newer build now, every half hour, and whenever the app
    // comes back to the screen — and then use it at once if nothing is running.
    // Not where something is being typed or run: a call, a chat, a wizard, the
    // admin and teacher desks with unsaved choices.
    const busy = () => isInCall() || /^\/(chat\/|practice|onboarding|admin|teacher|class|homework)/.test(window.location.pathname);
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      if (webUpdateReady() || await checkWebUpdate()) { if (!busy()) applyWebUpdate(); }
    };
    checkWebUpdate();
    const t = setInterval(checkWebUpdate, 30 * 60 * 1000);
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  const inCallScreen = pathname.startsWith('/chat/') || pathname === '/practice' || pathname === '/onboarding';
  const show = !hidden && !inCallScreen && (web || android);
  if (!show) return null;
  const isAndroid = !!android;
  return (
    <div className="update-banner" role="status">
      <RefreshCw size={16} aria-hidden="true" />
      <span className="update-banner-text">
        {isAndroid ? (android.forced ? 'Please update SpeakLab to keep practising' : 'A new version of SpeakLab is out') : 'A new version of SpeakLab is ready'}
      </span>
      <button type="button" className="update-banner-btn"
        onClick={() => (isAndroid ? startAndroidUpdate(android) : applyWebUpdate())}>
        {isAndroid ? 'Update' : 'Refresh'}
      </button>
      {!(isAndroid && android.forced) && (
        <button type="button" className="update-banner-later" onClick={() => setHidden(true)} aria-label="Later">Later</button>
      )}
    </div>
  );
}
