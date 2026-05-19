import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { tg, tgUser } from './telegram';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import DailyHub from './pages/DailyHub';
import Survey from './pages/Survey';
import MatchMaking from './pages/MatchMaking';
import Premium from './pages/Premium';
import Admin from './pages/Admin';

const ADMIN_UID = '6Djehd9KB8dTZUgVwVJfLoPI5dF3'; // sənin uid-in

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tg.ready();
    tg.expand();

    let heartbeatInterval = null;

    const unsub = onAuthStateChanged(auth, async (currentUser) => {
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
          level: userSnap.exists() ? userSnap.data().level : 'B1 – Intermediate',
          telegramId,
          online: true,
          lastSeen: serverTimestamp(),
        }, { merge: true });

        // Streak yoxla
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (userSnap.exists()) {
          const data = userSnap.data();
          const lastCallDate = data.lastCallDate || '';
          if (lastCallDate !== today && lastCallDate !== yesterday && (data.streak || 0) > 0) {
            await setDoc(userRef, { streak: 0 }, { merge: true });
          }
        }

        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(async () => {
          try {
            await setDoc(doc(db, 'users', uid), {
              online: true,
              lastSeen: serverTimestamp(),
            }, { merge: true });
          } catch (e) {}
        }, 30000);

        const goOffline = () => {
          setDoc(doc(db, 'users', uid), {
            online: false,
            lastSeen: serverTimestamp(),
          }, { merge: true });
        };

        window.addEventListener('beforeunload', goOffline);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') goOffline();
          if (document.visibilityState === 'visible') {
            setDoc(doc(db, 'users', uid), {
              online: true,
              lastSeen: serverTimestamp(),
            }, { merge: true });
          }
        });

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
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        setUser(null);
      }

      setLoading(false);
    });

    return () => {
      unsub();
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, []);

  if (loading) {
    return (
      <div className="splash-screen">
        <div className="splash-content">
          <div className="splash-logo">🎙️</div>
          <h1 className="splash-title">Speak2Them</h1>
        </div>
        <div className="splash-quote">
          <p className="splash-motto">"The limits of my language are the limits of my world."</p>
          <span className="splash-by">— Ludwig Wittgenstein</span>
        </div>
        <p className="splash-credit">Built by Polad 🚀</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
        <Route path="/survey"   element={user ? <Survey user={user} /> : <Navigate to="/login" />} />
        <Route path="/" element={
          user
            ? (user.surveyDone === false ? <Navigate to="/survey" /> : <Home user={user} />)
            : <Navigate to="/login" />
        } />
        <Route path="/match"        element={user ? <MatchMaking user={user} /> : <Navigate to="/login" />} />
        <Route path="/chat/:peerId" element={user ? <Chat user={user} /> : <Navigate to="/login" />} />
        <Route path="/profile"      element={user ? <Profile user={user} /> : <Navigate to="/login" />} />
        <Route path="/daily"        element={user ? <DailyHub /> : <Navigate to="/login" />} />
        <Route path="/premium"      element={user ? <Premium user={user} /> : <Navigate to="/login" />} />
        <Route path="/admin"        element={user?.uid === ADMIN_UID ? <Admin user={user} /> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;