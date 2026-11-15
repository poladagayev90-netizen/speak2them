// Vercel Web Analytics (2026-11-15, Polad: the Instagram ad sends visits and
// nothing counted them). Cookieless, so no consent banner. The component is
// rendered only on the web — never inside the Capacitor Android app (App.js).
//
// Every page view passes through `analyticsUrl` first:
// - the query string is dropped EXCEPT utm_* — Vercel groups visits by
//   utmSource / utmCampaign, which is how the ad's visits are told apart
//   (link the ad as …/?utm_source=instagram&utm_campaign=<name>);
// - path segments that look like ids (Firebase uids, call ids, long tokens)
//   become ":id", so /chat/<uid> is one row and no uid leaves the app.

const ID_SEGMENT = /^(?=.*\d)[A-Za-z0-9_-]{16,}$|^call_/;

export function utmOf(raw) {
  const keep = new URLSearchParams();
  try {
    new URL(raw).searchParams.forEach((value, key) => {
      if (/^utm_[a-z]+$/i.test(key)) keep.set(key.toLowerCase(), value.slice(0, 100));
    });
  } catch { /* not a URL */ }
  return keep;
}

// `landingUtm`: the utm_* of the address the visit started on. The app may
// redirect (/ → /register) before the script sends the first page view, and
// the redirect drops the query — so the first view gets them back.
export function analyticsUrl(raw, landingUtm = null) {
  let url;
  try { url = new URL(raw); } catch { return raw; }
  let keep = utmOf(raw);
  if (![...keep.keys()].length && landingUtm) keep = landingUtm;
  const path = url.pathname
    .split('/')
    .map((seg) => (ID_SEGMENT.test(seg) ? ':id' : seg))
    .join('/');
  const q = keep.toString();
  return `${url.origin}${path}${q ? `?${q}` : ''}`;
}

const LANDING_UTM = typeof window !== 'undefined' ? utmOf(window.location.href) : null;
let firstSent = false;

export function beforeSendAnalytics(event) {
  const url = analyticsUrl(event.url, firstSent ? null : LANDING_UTM);
  firstSent = true;
  return { ...event, url };
}
