import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingKeys = requiredConfigKeys.filter(key => !firebaseConfig[key]);

if (missingKeys.length > 0) {
  console.error('[Firebase] Missing configuration keys:', missingKeys);
}

let app;
let auth;
let db;
let storage;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} catch (error) {
  console.error('[Firebase] Failed to initialize Firebase:', error);
  throw error;
}

// The CRA/Workbox service worker already owns scope "/". Registering the
// messaging worker there too would replace it on every load — each swap tears
// down the push subscription, invalidating the FCM token, so pushes silently
// stop arriving. Give messaging its own scope (the same one the SDK uses by
// default) so both workers coexist.
const FCM_SW_SCOPE = '/firebase-cloud-messaging-push-scope';

// Each device keeps its own token doc under users/{uid}/fcmTokens so a second
// device never overwrites the first (the old single users/{uid}.fcmToken field
// meant only the most recently opened device received pushes). The doc id is a
// stable hash of the token, so re-registering an unchanged token updates the
// same doc instead of piling up duplicates.
async function tokenDocId(token) {
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Non-secure contexts have no crypto.subtle; a deterministic 32-bit hash is
    // enough for a per-device id (a collision only merges two tokens for one
    // user, which self-heals when the stale one is pruned on send failure).
    let h = 5381;
    for (let i = 0; i < token.length; i++) h = ((h << 5) + h + token.charCodeAt(i)) >>> 0;
    return 'h' + h.toString(16);
  }
}

// Registers the messaging SW, mints a token, stores it, and wires the
// foreground handler. Shared by the gesture (enableNotifications) and load
// (refreshFcmToken) paths — both need the identical token + listener setup once
// permission is granted; only who asks for permission differs.
async function registerTokenAndListener(uid) {
  const registration = await navigator.serviceWorker.register(
    '/firebase-messaging-sw.js',
    { scope: FCM_SW_SCOPE }
  );
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (token) {
    const id = await tokenDocId(token);
    await setDoc(
      doc(db, 'users', uid, 'fcmTokens', id),
      { token, userAgent: (navigator.userAgent || '').slice(0, 300), updatedAt: serverTimestamp() },
      { merge: true }
    );
  }

  // Data-only pushes that arrive while a tab is open never reach the SW's
  // onBackgroundMessage — display them here or they are lost entirely.
  onMessage(messaging, (payload) => {
    const data = payload?.data;
    if (!data?.title) return;
    registration.showNotification(data.title, {
      body: data.body || '',
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: data.type || 'speaklab',
      data: { url: data.url || '/' },
    });
  });

  return Boolean(token);
}

// Opt-in from a user gesture (a tap). Notification.requestPermission() is
// unreliable without a gesture and is outright required to be gesture-triggered
// on iOS/installed PWAs, so this must never be called from an effect or the
// auth callback. Returns the resulting permission-ish status for the UI to act
// on: 'granted' | 'denied' | 'default' | 'unsupported'.
export async function enableNotifications(uid) {
  if (!uid || !process.env.REACT_APP_FIREBASE_VAPID_KEY) return 'unsupported';

  try {
    if (!(await isSupported())) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission; // 'denied' | 'default'

    await registerTokenAndListener(uid);
    return 'granted';
  } catch (error) {
    console.error('[Firebase] enableNotifications failed:', error);
    return 'unsupported';
  }
}

// Load-time refresh for users who already granted permission. Never prompts —
// it bails unless permission is already 'granted' — so it is safe to call from
// the auth callback and keeps an opted-in user's token fresh across sessions.
export async function refreshFcmToken(uid) {
  if (!uid || !process.env.REACT_APP_FIREBASE_VAPID_KEY) return;

  try {
    if (!(await isSupported())) return;
    if (Notification.permission !== 'granted') return;

    await registerTokenAndListener(uid);
  } catch (error) {
    console.warn('[Firebase] refreshFcmToken skipped:', error.message);
  }
}

// The modular Web SDK has no onTokenRefresh callback (it was removed), so we
// actively re-mint the token instead of only doing it once at app load: on
// every foreground return and on a periodic timer while the app stays open.
// registerTokenAndListener is idempotent — getToken returns the *current*
// token and the SW registration is reused — so a token that rotated while the
// app was closed (or during a long-lived session) is re-written without the
// user doing anything. This is the practical web equivalent of onTokenRefresh
// and closes the "stale token until the next full reload" gap. Returns a
// cleanup function; call it when the user signs out / the effect tears down.
const TOKEN_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h

export function watchFcmToken(uid) {
  if (!uid) return () => {};

  let stopped = false;
  const tick = () => { if (!stopped) refreshFcmToken(uid).catch(() => {}); };

  tick(); // immediate refresh — covers rotation since the previous session

  const onVisible = () => {
    if (document.visibilityState === 'visible') tick();
  };
  document.addEventListener('visibilitychange', onVisible);
  const interval = setInterval(tick, TOKEN_REFRESH_INTERVAL_MS);

  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(interval);
  };
}

// Popups are unreliable in an installed PWA (standalone display) and inside
// in-app webviews. Fall back to a full-page redirect: onAuthStateChanged in
// App.js creates/refreshes the user doc afterwards, so the redirect path needs
// no extra bookkeeping.
const POPUP_UNAVAILABLE = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
]);

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    if (POPUP_UNAVAILABLE.has(error.code)) {
      await signInWithRedirect(auth, provider);
      return null; // the page navigates away; nothing else to do here
    }
    throw error; // popup-closed-by-user etc. — a real cancellation
  }
}

export { auth, db, storage, GoogleAuthProvider, signInWithPopup };
export default app;
