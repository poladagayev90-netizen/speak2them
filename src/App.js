import React, { useEffect, useState, Suspense } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { SafeArea } from '@capacitor-community/safe-area';
import { StatusBar, Style } from '@capacitor/status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db, registerFcmToken } from './firebase';
import { tg, tgUser, isTelegramWebApp } from './telegram';
import ErrorBoundary from './components/ErrorBoundary';
import AppLayout from './components/AppLayout';
import GlobalCallListener from './components/GlobalCallListener';
import { ADMIN_UID } from './constants';
import Logo from './components/Logo';

const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const Home = React.lazy(() => import('./pages/Home'));
const Chats = React.lazy(() => import('./pages/Chats'));
const Chat = React.lazy(() => import('./pages/Chat'));
const AIChat = React.lazy(() => import('./pages/AIChat'));
const Profile = React.lazy(() => import('./pages/Profile'));
const UserProfile = React.lazy(() => import('./pages/UserProfile'));
const DailyHub = React.lazy(() => import('./pages/DailyHub'));
const Survey = React.lazy(() => import('./pages/Survey'));
const PlacementTest = React.lazy(() => import('./pages/PlacementTest'));
const Upgrade = React.lazy(() => import('./pages/Upgrade'));
const Admin = React.lazy(() => import('./pages/Admin'));
const Ranking = React.lazy(() => import('./pages/Ranking'));
const History = React.lazy(() => import('./pages/History'));

const LoadingFallback = () => (
  <div className="loading-screen">
    <div className="loading-logo">🎙️</div>
    <p>Loading...</p>
  </div>
);


function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isTelegramWebApp && tg.ready) {
      tg.ready();
      tg.expand();
      document.body.classList.add('is-telegram');
    }

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

  useEffect(() => {
    let heartbeatInterval = null;
    let visibilityHandler = null;
    let unloadHandler = null;

    const cleanupPresence = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
      if (unloadHandler) window.removeEventListener('beforeunload', unloadHandler);
    };

    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      cleanupPresence();
      if (currentUser) {
        const uid = currentUser.uid;
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);

        const telegramId = tgUser?.id
          ? String(tgUser.id)
          : (userSnap.exists() ? (userSnap.data()?.telegramId || '') : '');

        await setDoc(userRef, {
          uid,
          name: userSnap.exists() ? userSnap.data().name : (currentUser.displayName || 'User'),
          email: currentUser.email || userSnap.data()?.email || '',
          photo: userSnap.exists() && userSnap.data().photo ? userSnap.data().photo : (tgUser?.photo_url || ''),
          telegramId,
          online: true,
          lastSeen: serverTimestamp(),
        }, { merge: true });

        registerFcmToken(uid).catch(() => {});

        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (userSnap.exists()) {
          const data = userSnap.data();
          const lastCallDate = data.lastCallDate || '';
          if (lastCallDate !== today && lastCallDate !== yesterday && (data.streak || 0) > 0) {
            await setDoc(userRef, { streak: 0 }, { merge: true });
          }
        }

        heartbeatInterval = setInterval(async () => {
          try {
            await setDoc(doc(db, 'users', uid), {
              online: true,
              lastSeen: serverTimestamp(),
            }, { merge: true });
          } catch (e) {}
        }, 60000);

        const goOffline = async () => {
          try {
            await setDoc(doc(db, 'users', uid), {
              online: false,
              status: 'offline',
              lastSeen: serverTimestamp(),
            }, { merge: true });
          } catch (e) {}
        };

        unloadHandler = goOffline;
        window.addEventListener('beforeunload', unloadHandler);
        
        visibilityHandler = async () => {
          try {
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
  const homeElement = user
    ? (!user.surveyDone ? <Navigate to="/survey" /> : <Home user={user} />)
    : <Navigate to="/register" />;

  return (
    <>
      <ErrorBoundary>
        {Capacitor.isNativePlatform() ? (
          <HashRouter>
            <Suspense fallback={<LoadingFallback />}>
              <AppLayout user={user}>
                {user && <GlobalCallListener user={user} />}
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
                  <Route path="/premium" element={<Navigate to="/upgrade" replace />} />
                  <Route path="/upgrade" element={user ? <Upgrade user={user} /> : <Navigate to="/login" />} />
                  <Route path="/ranking" element={user ? <Ranking user={user} /> : <Navigate to="/login" />} />
                  <Route path="/history" element={user ? <History user={user} /> : <Navigate to="/login" />} />
                  <Route path="/admin" element={user?.uid === ADMIN_UID ? <Admin user={user} /> : <Navigate to="/" />} />
                </Routes>
              </AppLayout>
            </Suspense>
          </HashRouter>
        ) : (
          <BrowserRouter>
            <Suspense fallback={<LoadingFallback />}>
              <AppLayout user={user}>
                {user && <GlobalCallListener user={user} />}
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
                  <Route path="/premium" element={<Navigate to="/upgrade" replace />} />
                  <Route path="/upgrade" element={user ? <Upgrade user={user} /> : <Navigate to="/login" />} />
                  <Route path="/ranking" element={user ? <Ranking user={user} /> : <Navigate to="/login" />} />
                  <Route path="/history" element={user ? <History user={user} /> : <Navigate to="/login" />} />
                  <Route path="/admin" element={user?.uid === ADMIN_UID ? <Admin user={user} /> : <Navigate to="/" />} />
                </Routes>
              </AppLayout>
            </Suspense>
          </BrowserRouter>
        )}
      </ErrorBoundary>
    </>
  );
}

export default App;
