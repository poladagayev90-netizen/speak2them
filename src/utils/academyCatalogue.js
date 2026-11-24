// SWR catalogue loader for SpeakLab Academy (`https://speaklab.me/academy/catalogue.json`).
//
// Live-verified CORS: GitHub Pages/Fastly serves `Access-Control-Allow-Origin: *`
// and `Cache-Control: max-age=600` (~14.5 KB). Keeping a 10-minute localStorage
// + memory cache paints instantly while silently refreshing stale metadata.
export const CATALOGUE_URL = 'https://speaklab.me/academy/catalogue.json';
const CACHE_KEY = 'sl.academy.catalogue.v1';
const TTL_MS = 10 * 60 * 1000;

let memCache = null;

export function getCachedCatalogue() {
  if (memCache?.data) return memCache;
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (raw && raw.data && Array.isArray(raw.data.series)) {
      memCache = raw;
      return raw;
    }
  } catch { /* private mode */ }
  return null;
}

export function isCatalogueFresh(entry, now = Date.now()) {
  return Boolean(entry && entry.data && now - (Number(entry.fetchedAt) || 0) < TTL_MS);
}

export async function fetchAcademyCatalogue({ force = false } = {}) {
  const cached = getCachedCatalogue();
  if (!force && isCatalogueFresh(cached)) return { data: cached.data, fromCache: true };

  try {
    const res = await fetch(CATALOGUE_URL, { cache: 'default' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !Array.isArray(data.series)) throw new Error('Invalid catalogue');
    const entry = { data, fetchedAt: Date.now() };
    memCache = entry;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(entry)); } catch { /* quota */ }
    return { data, fromCache: false };
  } catch (err) {
    if (cached?.data) return { data: cached.data, fromCache: true, stale: true };
    return { data: null, error: err?.message || 'network' };
  }
}
