import React, { useEffect, useState, Suspense } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { SafeArea } from '@capacitor-community/safe-area';
import { StatusBar, Style } from '@capacitor/status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, watchFcmToken } from './firebase';
import { isInCall } from './utils/presence';
import { subscribeToCycle } from './utils/cycle';
import ErrorBoundary from './components/ErrorBoundary';
import AppLayout from './components/AppLayout';
import GlobalCallListener from './components/GlobalCallListener';
import { ADMIN_UID } from './constants';
import Logo from './components/Logo';

// Import thunks are kept separate from React.lazy so the bottom-nav tabs can
// be preloaded on idle (see the preload effect in App) — without this, the
// first visit to each tab downloads its chunk on the spot and the page flashes.
const importHome = () => import('./pages/Home');
const importChats = () => import('./pages/Chats');
const importAIChat = () => import('./pages/AIChat');
const importProfile = () => import('./pages/Profile');
const importRanking = () => import('./pages/Ranking');
const TAB_PAGE_IMPORTS = [importHome, importChats, importAIChat, importRanking, importProfile];

const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const Home = React.lazy(importHome);
const Chats = React.lazy(importChats);
const Chat = React.lazy(() => import('./pages/Chat'));
const AIChat = React.lazy(importAIChat);
const Profile = React.lazy(importProfile);
const UserProfile = React.lazy(() => import('./pages/UserProfile'));
const DailyHub = React.lazy(() => import('./pages/DailyHub'));
const Survey = React.lazy(() => import('./pages/Survey'));
const PlacementTest = React.lazy(() => import('./pages/PlacementTest'));
const Upgrade = React.lazy(() => import('./pages/Upgrade'));
const Admin = React.lazy(() => import('./pages/Admin'));
const Ranking = React.lazy(importRanking);
const History = React.lazy(() => import('./pages/History'));
const DailyPuzzle = React.lazy(() => import('./pages/DailyPuzzle'));
const Redeem = React.lazy(() => import('./pages/Redeem'));

// Shown INSIDE the layout while a page chunk loads — the bottom nav stays
// mounted, so a tab switch never blanks the whole screen.
// Vəziyyət keçidlərini (trial→kurs, kurs→bitmə, premium) reload OLMADAN
// bütün app-a çatdıran sahələr. Yalnız bunlar dəyişəndə user state yenilənir —
// presence heartbeat-in hər 60 saniyəlik lastSeen yazısı re-render yaratmır.
const LIVE_USER_FIELDS = [
  'mode', 'startTick', 'cohortId', 'isPremium', 'subscriptionPlan',
  'premiumPlan', 'trialStartedAt', 'courseActivatedAt', 'courseCompletedAt',
  'freeAccessUntil', 'surveyDone',
];

const fieldValue = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : v);

const PageFallback = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '60vh', color: 'var(--text-muted)', fontSize: 22,
  }} aria-label="Yüklənir">
    <span className="loading-logo" style={{ fontSize: 34 }}>🎙️</span>
  </div>
);

// One shared shell for both routers. Suspense sits INSIDE AppLayout around
// only the Routes: while a lazy chunk downloads, the nav and layout stay put
// (the old placement unmounted the entire shell into a full-screen loader on
// every first visit to a tab — the "tab switch flash").
function AppShell({ user }) {
  const homeElement = user
    ? (!user.surveyDone ? <Navigate to="/survey" /> : <Home user={user} />)
    : <Navigate to="/register" />;

  return (
    <AppLayout user={user}>
      {user && <GlobalCallListener user={user} />}
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
          <Route path="/survey" element={user ? <Survey user={user} /> : <Navigate to="/login" />} />
          <Route path="/placement" element={user ? <PlacementTest user={user} /> : <Navigate to="/login" />} />
          <Route path="/" element={homeElement} />
          <Route path="/chats" element={user ? <Chats user={user} /> : <Navigate to="/login" />} />
          <Route path="/chat/:peerId" element={user ? <Chat user={user} /> : <Navigate to="/login" />} />
          <Route path="/ai-chat" element={user ? <AIChat user={user} /> : <Navigate to="/login" />} />
          <Route path="/profile" element={user ? <Profile user={user} /> : <Navigate to="/login" />} />
          <Route path="/user/:uid" element={user ? <UserProfile user={user} /> : <Navigate to="/login" />} />
          <Route path="/daily" element={user ? <DailyHub /> : <Navigate to="/login" />} />
          <Route path="/puzzle" element={user ? <DailyPuzzle user={user} /> : <Navigate to="/login" />} />
          <Route path="/redeem" element={user ? <Redeem user={user} /> : <Navigate to="/login" />} />
          <Route path="/premium" element={<Navigate to="/upgrade" replace />} />
          <Route path="/upgrade" element={user ? <Upgrade user={user} /> : <Navigate to="/login" />} />
          <Route path="/ranking" element={user ? <Ranking user={user} /> : <Navigate to="/login" />} />
          <Route path="/history" element={user ? <History user={user} /> : <Navigate to="/login" />} />
          <Route path="/admin" element={user?.uid === ADMIN_UID ? <Admin user={user} /> : <Navigate to="/" />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}


function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Held only to re-render the tree when the global cycle advances (nightly),
  // so the topic updates live; the value itself is read via the shared cache.
  const [, setCycle] = useState(null);

  useEffect(() => {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;
    const isMobile = window.innerWidth <= 768;
    if (isPWA || isMobile) {
      document.documentElement.style.setProperty('--app-max-width', '100vw');
      document.body.style.maxWidth = '100vw';
      document.body.style.width = '100vw';
    }

    if (Capacitor.isNativePlatform()) {
      // Set status bar overlay to false so webview sits below it if possible
      // OR set to true if we want to use safe area
      StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      SafeArea.getSafeAreaInsets().then(({ insets }) => {
        document.documentElement.style.setProperty('--safe-area-top', `${insets.top}px`);
        document.documentElement.style.setProperty('--safe-area-bottom', `${insets.bottom}px`);
      }).catch(() => {});
      
      SafeArea.addListener('safeAreaChanged', data => {
        document.documentElement.style.setProperty('--safe-area-top', `${data.insets.top}px`);
        document.documentElement.style.setProperty('--safe-area-bottom', `${data.insets.bottom}px`);
      });
    }
  }, []);

  // Warm the bottom-nav tab chunks shortly after first paint so the first
  // visit to each tab renders from cache instead of downloading its bundle.
  useEffect(() => {
    if (loading) return undefined;
    const t = setTimeout(() => {
      TAB_PAGE_IMPORTS.forEach((load) => load().catch(() => {}));
    }, 2000);
    return () => clearTimeout(t);
  }, [loading]);

  // Subscribe once to the server-driven topic cycle (appConfig/cycle). This
  // warms the shared cache used by getTodayIndex()/getTodayContent() app-wide.
  useEffect(() => subscribeToCycle(setCycle), []);

  useEffect(() => {
    let heartbeatInterval = null;
    let visibilityHandler = null;
    let unloadHandler = null;
    let stopTokenWatch = null;
    let stopLiveUserSync = null;

    const cleanupPresence = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
      if (unloadHandler) {
        window.removeEventListener('beforeunload', unloadHandler);
        window.removeEventListener('pagehide', unloadHandler);
      }
      if (stopTokenWatch) { stopTokenWatch(); stopTokenWatch = null; }
      if (stopLiveUserSync) { stopLiveUserSync(); stopLiveUserSync = null; }
    };

    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      cleanupPresence();
      if (currentUser) {
        const uid = currentUser.uid;
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);

        await setDoc(userRef, {
          uid,
          name: userSnap.exists() ? userSnap.data().name : (currentUser.displayName || 'User'),
          email: currentUser.email || userSnap.data()?.email || '',
          photo: userSnap.exists() && userSnap.data().photo ? userSnap.data().photo : (currentUser.photoURL || ''),
          online: true,
          lastSeen: serverTimestamp(),
        }, { merge: true });

        // Keep this device's FCM token fresh for the whole session, not just at
        // load: re-mints on foreground return and on a periodic timer.
        stopTokenWatch = watchFcmToken(uid);

        // Streak reset removed from app-load: Chat.jsx already resets streak
        // to 1 when there is a gap (lastCallDate is older than yesterday).
        // Resetting here was zeroing the streak BEFORE the user could call,
        // so consecutive-day users saw streak = 0 or 1 instead of climbing.

        heartbeatInterval = setInterval(async () => {
          try {
            await setDoc(doc(db, 'users', uid), {
              online: true,
              lastSeen: serverTimestamp(),
            }, { merge: true });
          } catch (e) {}
        }, 60000); // presence heartbeat; ONLINE_WINDOW_MS (150s) must stay ≥2.5× this

        const goOffline = async () => {
          try {
            await setDoc(doc(db, 'users', uid), {
              online: false,
              status: 'offline',
              lastSeen: serverTimestamp(),
            }, { merge: true });
          } catch (e) {}
        };

        // A tab closed mid-call must still stop looking busy to everyone else.
        // pagehide fires far more reliably than beforeunload on mobile
        // browsers/installed PWAs, so register the same handler on both.
        unloadHandler = goOffline;
        window.addEventListener('beforeunload', unloadHandler);
        window.addEventListener('pagehide', unloadHandler);

        visibilityHandler = async () => {
          try {
            // Backgrounding the app during a call (very common on mobile) must
            // not clear the busy flag — the call is still running.
            if (isInCall()) {
              await setDoc(doc(db, 'users', uid), {
                online: true,
                lastSeen: serverTimestamp(),
              }, { merge: true });
              return;
            }
            if (document.visibilityState === 'hidden') await goOffline();
            if (document.visibilityState === 'visible') {
              await setDoc(doc(db, 'users', uid), {
                online: true,
                status: 'online',
                lastSeen: serverTimestamp(),
              }, { merge: true });
            }
          } catch (e) {}
        };
        document.addEventListener('visibilitychange', visibilityHandler);

        // Ensure user is online and available on initial load
        try {
          await setDoc(doc(db, 'users', uid), {
            online: true,
            status: 'online',
            lastSeen: serverTimestamp(),
          }, { merge: true });
        } catch (e) {}

        const freshUserSnap = await getDoc(userRef);
        const freshUserData = freshUserSnap.exists() ? freshUserSnap.data() : {};

        const appUser = {
          ...currentUser,
          ...freshUserData,
          uid,
          email: currentUser.email || freshUserData.email || '',
          displayName: currentUser.displayName || freshUserData.name || 'User',
        };

        setUser(appUser);

        // Trial→kurs, tamamlanma və premium keçidləri serverdə yazılan kimi
        // ekranda görünsün (redeem-dən sonra reload tələb olunmasın).
        stopLiveUserSync = onSnapshot(userRef, (snap) => {
          if (!snap.exists()) return;
          const d = snap.data();
          setUser((prev) => {
            if (!prev || prev.uid !== uid) return prev;
            const changed = LIVE_USER_FIELDS.some(
              (k) => fieldValue(prev[k]) !== fieldValue(d[k])
            );
            if (!changed) return prev;
            const merged = { ...prev };
            LIVE_USER_FIELDS.forEach((k) => { merged[k] = d[k]; });
            return merged;
          });
        }, () => {});
      } else {
        cleanupPresence();
        setUser(null);
      }

      setLoading(false);
    });

    return () => {
      unsub();
      cleanupPresence();
    };
  }, []);

  if (loading) {
    return (
      <>
        <div className="splash-screen">
          <div className="splash-content" style={{ display: 'flex', justifyContent: 'center' }}>
            <Logo width={240} />
          </div>
          <div className="splash-quote">
            <p className="splash-motto">"The limits of my language are the limits of my world."</p>
            <span className="splash-by">- Ludwig Wittgenstein</span>
          </div>
          <p className="splash-credit">Built by Polad</p>
        </div>
      </>
    );
  }
  return (
    <>
      <ErrorBoundary>
        {Capacitor.isNativePlatform() ? (
          <HashRouter>
            <AppShell user={user} />
          </HashRouter>
        ) : (
          <BrowserRouter>
            <AppShell user={user} />
          </BrowserRouter>
        )}
      </ErrorBoundary>
    </>
  );
}

export default App;
