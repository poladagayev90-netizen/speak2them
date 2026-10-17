import { useEffect, useState } from 'react';
import { authedFetch } from '../api';
import { FUNCTIONS_BASE } from '../constants';

// Who is in the app right now (functions onlineNow — temporary, behind
// appConfig/features.onlineNow). Asked once on mount and then every 30 s, only
// while the page is visible: a hidden tab asks nothing. Any failure shows
// nobody; the strip simply is not there. 30 s pairs with the server's 20 s
// roster cache (functions ONLINE_NOW_CACHE_MS) and its 240/hour rate limit.
const REFRESH_MS = 30000;

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
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);
  return { people, on };
}
