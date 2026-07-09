import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
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
    await setDoc(doc(db, 'users', uid), { fcmToken: token }, { merge: true });
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
