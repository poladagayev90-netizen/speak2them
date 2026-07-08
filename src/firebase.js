import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
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

export async function registerFcmToken(uid) {
  if (!uid || !process.env.REACT_APP_FIREBASE_VAPID_KEY) return;

  try {
    if (!(await isSupported())) return;
    if (Notification.permission === 'denied') return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

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
  } catch (error) {
    console.warn('[Firebase] FCM registration skipped:', error.message);
  }
}

export { auth, db, storage, GoogleAuthProvider, signInWithPopup };
export default app;
