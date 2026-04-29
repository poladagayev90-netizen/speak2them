import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { tg, tgUser } from './telegram';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Chat from './pages/Chat';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tg.ready();
    tg.expand();

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
          online: true,
          lastSeen: serverTimestamp(),
        }, { merge: true });

        window.addEventListener('beforeunload', () => {
          setDoc(doc(db, 'users', uid), {
            online: false,
            lastSeen: serverTimestamp(),
          }, { merge: true });
        });
      }
      setUser(currentUser);
      setLoading(false);
    });

    // Telegram-dan açılırsa avtomatik anonim login
    if (tgUser && !auth.currentUser) {
      signInAnonymously(auth);
    }

    return unsub;
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
      </Routes>
    </BrowserRouter>
  );
}

export default App;