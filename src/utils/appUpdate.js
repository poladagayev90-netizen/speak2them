import { Capacitor } from '@capacitor/core';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// "There is a new version" (Polad 2026-10-07, plan #7).
//
// Web / iOS PWA: the build on the server is newer than the one running. The
// service worker activates new versions at once (skipWaiting) and fetches
// network-first, so a reload is all an update needs — the question is only
// WHEN. It used to be location.reload() the moment a worker installed, in the
// middle of a call too. Now the app says so (UpdateBanner) and applies it when
// the learner taps, or on its own when the app comes back to the screen and
// nothing is running (no call, no open conversation).
// Android: the web app is packed inside the APK, so a new version only comes
// through Google Play. Play's in-app update API (@capawesome/capacitor-app-
// update) knows whether one is out. appConfig/version.android.min forces it
// (Play's full-screen update) for a version that must not be used any more;
// .latest is the fallback for an APK not installed from Play, which the API
// cannot see.

const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.speaklab.app';

let ready = false;
const listeners = new Set();
const emit = () => listeners.forEach((f) => f());
const markReady = () => { if (!ready) { ready = true; emit(); } };

// The main bundle this page is running (a CRA build names it by its hash).
const MAIN_RE = /static\/js\/main\.[a-z0-9]+\.js/;
export function runningMainJs(doc = document) {
  for (const s of doc.querySelectorAll('script[src]')) {
    const m = MAIN_RE.exec(s.getAttribute('src') || '');
    if (m) return m[0];
  }
  return null;
}
// Pure: does the server's asset manifest name another main bundle?
export function isNewerBuild(manifest, running) {
  const main = manifest && manifest.files && manifest.files['main.js'];
  const m = main && MAIN_RE.exec(main);
  return !!(m && running && m[0] !== running);
}

// index.js passes on the service worker's own signal too.
export function onWebUpdateReady() { markReady(); }
export const webUpdateReady = () => ready;
export function subscribeToUpdate(cb) { listeners.add(cb); return () => listeners.delete(cb); }

export function applyWebUpdate() {
  window.location.reload();
}

// On load, whenever the app comes back to the screen, and every half hour —
// an installed PWA can stay open for days. A failed check says nothing.
export async function checkWebUpdate() {
  const running = runningMainJs();
  if (!running) return false; // the dev server has no hashed bundle
  try {
    const res = await fetch('/asset-manifest.json', { cache: 'no-store' });
    if (!res.ok) return false;
    if (isNewerBuild(await res.json(), running)) { markReady(); return true; }
  } catch { /* offline */ }
  return false;
}

export const isAndroidApp = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

async function versionConfig() {
  try {
    const snap = await getDoc(doc(db, 'appConfig', 'version'));
    return (snap.exists() && snap.data().android) || {};
  } catch { return {}; }
}

// null when this build is current; otherwise { forced, immediate }.
export async function checkAndroidUpdate() {
  if (!isAndroidApp()) return null;
  const cfg = await versionConfig();
  const min = Number(cfg.min) || 0;
  try {
    const { AppUpdate, AppUpdateAvailability } = await import('@capawesome/capacitor-app-update');
    const info = await AppUpdate.getAppUpdateInfo();
    const current = Number(info.currentVersionCode) || 0;
    const available = info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE;
    const forced = min > current;
    // Too old to use: Play's own full-screen update, straight away.
    if (forced && available && info.immediateUpdateAllowed) {
      await AppUpdate.performImmediateUpdate().catch(() => {});
    }
    return available || forced ? { forced, immediate: !!info.immediateUpdateAllowed } : null;
  } catch {
    // Not installed from Play (a test APK): the version the admin set.
    try {
      const { App } = await import('@capacitor/app');
      const current = Number((await App.getInfo()).build) || 0;
      const latest = Number(cfg.latest) || 0;
      if (latest > current || min > current) return { forced: min > current, immediate: false };
    } catch { /* nothing to compare with */ }
    return null;
  }
}

export async function startAndroidUpdate({ immediate } = {}) {
  try {
    const { AppUpdate } = await import('@capawesome/capacitor-app-update');
    if (immediate) {
      try { await AppUpdate.performImmediateUpdate(); return; } catch { /* fall through to the store */ }
    }
    await AppUpdate.openAppStore();
  } catch {
    window.open(PLAY_URL, '_blank');
  }
}
