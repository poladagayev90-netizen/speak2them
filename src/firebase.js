import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

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

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error('[Firebase] Failed to initialize Firebase:', error);
  throw error;
}

export async function registerFcmToken(uid) {
  if (!uid || !process.env.REACT_APP_FIREBASE_VAPID_KEY) return;

  try {
    if (!(await isSupported())) return;
    if (Notification.permission === 'denied') return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      await setDoc(doc(db, 'users', uid), { fcmToken: token }, { merge: true });
    }
  } catch (error) {
    console.warn('[Firebase] FCM registration skipped:', error.message);
  }
}

export { auth, db };
export default app;
