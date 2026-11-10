import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { authedFetch } from '../api';
import { FUNCTIONS_BASE } from '../constants';

// Who is in the app right now (functions onlineNow — temporary, behind
// appConfig/features.onlineNow). Asked once on mount and then every 15 s, only
// while the page is visible: a hidden tab asks nothing. Any failure shows
// nobody; the strip simply is not there.
//
// 15 s (was 30 s) pairs with the server's 5 s presence cache
// (functions ONLINE_NOW_PRESENCE_MS) and its 480/hour rate limit: someone who
// opens the app shows up for the others within ~20 s at worst (measured on
// emulators with two instances, 2026-11-10: median 12 s, max 15 s incl. login;
// before: median 23 s, max 32 s, up to ~50 s in theory — Polad: «iki onlayn
// tərəf bir-birini gec görür»). Each call reads at most the presence query
// (cached 5 s) plus the caller's own relations (cached 60 s).
const REFRESH_MS = 15000;

export default function useOnlineNow(enabled = true) {
  const [people, setPeople] = useState([]);
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (!enabled) { setPeople([]); return undefined; }
    let alive = true;
    let timer = null;
    const load = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const res = await authedFetch(`${FUNCTIONS_BASE}/onlineNow`, { method: 'POST', body: '{}' });
        const data = res.ok ? await res.json() : null;
        if (!alive) return;
        setPeople(Array.isArray(data?.people) ? data.people : []);
        setOn(!(data && data.on === false));
      } catch {
        if (alive) setPeople([]);
      }
    };
    load();
    timer = setInterval(load, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    // The Android app coming back to the front does not always fire
    // visibilitychange in the WebView; the native resume does.
    let resume = null;
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('resume', () => { if (alive) load(); }).then((h) => {
        if (alive) resume = h; else h.remove();
      }).catch(() => {});
    }
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      if (resume) resume.remove();
    };
  }, [enabled]);
  return { people, on };
}
