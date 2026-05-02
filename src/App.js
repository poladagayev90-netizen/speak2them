import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { tg, tgUser } from './telegram';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import DailyHub from './pages/DailyHub';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tg.ready();
    tg.expand();

    let heartbeatInterval = null;

    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const uid = tgUser ? String(tgUser.id) : currentUser.uid;

        await setDoc(doc(db, 'users', uid), {
          uid,
          name: tgUser
            ? tgUser.first_name + ' ' + (tgUser.last_name || '')
            : currentUser.displayName || 'User',
          telegramId: tgUser?.id || null,
          photo: tgUser?.photo_url || '',
          level: 'B1 – Intermediate',
          online: true,
          lastSeen: serverTimestamp(),
        }, { merge: true });

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
      } else {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
      }

      setUser(currentUser);
      setLoading(false);
    });

    return () => {
      unsub();
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">🎙️</div>
        <p>Loading Speak2Them...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"        element={!user ? <Login />    : <Navigate to="/" />} />
        <Route path="/register"     element={!user ? <Register /> : <Navigate to="/" />} />
        <Route path="/"             element={user  ? <Home user={user} /> : <Navigate to="/login" />} />
        <Route path="/chat/:peerId" element={user  ? <Chat user={user} /> : <Navigate to="/login" />} />
        <Route path="/profile"      element={user  ? <Profile user={user} /> : <Navigate to="/login" />} />
        <Route path="/daily"        element={user  ? <DailyHub /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;