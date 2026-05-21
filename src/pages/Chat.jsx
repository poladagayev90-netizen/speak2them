import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  collection, addDoc, onSnapshot,
  query, orderBy, serverTimestamp,
  doc, getDoc, setDoc, updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { getTodayContent } from '../dailyContent';
import PremiumBadge from '../components/PremiumBadge';

const APP_ID = process.env.REACT_APP_AGORA_APP_ID;
const TOKEN_URL = 'https://us-central1-speak2them-64f2b.cloudfunctions.net/getAgoraToken';

export default function Chat({ user }) {
  const { peerId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [peer, setPeer] = useState(null);
  const [inCall, setInCall] = useState(false);
  const [muted, setMuted] = useState(false);
  const [callStatus, setCallStatus] = useState('');
  const [callSeconds, setCallSeconds] = useState(0);
  const [showDaily, setShowDaily] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [selectedStar, setSelectedStar] = useState(0);
  const [dailyTab, setDailyTab] = useState('questions');
  const [difficulty, setDifficulty] = useState('easy');
  const [flipped, setFlipped] = useState({});
  const [incomingCallData, setIncomingCallData] = useState(null);

  const prevCallStatus = useRef('');
  const callSecondsRef = useRef(0);
  const endCallRef = useRef(null);
  const clientRef = useRef(null);
  const localTrackRef = useRef(null);
  const bottomRef = useRef(null);
  const joinedRef = useRef(false);
  const ringtoneRef = useRef(null);
  const timerRef = useRef(null);

  const chatId = [user.uid, peerId].sort().join('_');
  const callDocId = `call_${chatId}`;
  const content = getTodayContent();

  useEffect(() => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1361/1361-preview.mp3');
    audio.loop = true;
    ringtoneRef.current = audio;
    return () => { audio.pause(); };
  }, []);

  useEffect(() => {
    getDoc(doc(db, 'users', peerId)).then(d => {
      if (d.exists()) setPeer(d.data());
    });
  }, [peerId]);

  useEffect(() => {
    if (!chatId || !user.uid || !peerId) {
      console.warn('[Chat] Missing required IDs:', { chatId, userId: user.uid, peerId });
      return;
    }
    
    console.log('[Chat] Setting up message listener for chatId:', chatId);
    try {
      const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
      const unsub = onSnapshot(q, (snap) => {
        console.log('[Chat] Messages updated:', snap.size);
        const msgs = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date()
          };
        });
        setMessages(msgs);
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      }, (error) => {
        console.error('[Chat] Message listener error:', error);
      });
      return unsub;
    } catch (error) {
      console.error('[Chat] Failed to setup message listener:', error);
    }
  }, [chatId, user.uid, peerId]);

  useEffect(() => {
    if (location.state?.acceptedCall && !joinedRef.current && user.uid && peerId) {
      console.log('[Chat] Auto-joining call from location state');
      joinedRef.current = true;
      joinCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid, peerId]);

  useEffect(() => {
    if (!callDocId || !user.uid || !peerId) {
      console.warn('[Chat] Missing call data:', { callDocId, userId: user.uid, peerId });
      return;
    }

   const joinCallRef = useRef(null);
    console.log('[Chat] Setting up call listener for:', callDocId);
    try {
      const unsub = onSnapshot(doc(db, 'calls', callDocId), (snap) => {
        if (!snap.exists()) {
          console.log('[Chat] Call document does not exist');
          if (prevCallStatus.current === 'calling') {
            setCallStatus('rejected');
            setTimeout(() => setCallStatus(''), 3000);
          }
          setIncomingCallData(null);
          prevCallStatus.current = '';
          return;
        }

        const data = snap.data();
        console.log('[Chat] Call status:', data.status);
        prevCallStatus.current = data.status;

        if (data.callerId === peerId && data.status === 'calling') {
          console.log('[Chat] Incoming call from peer');
          setIncomingCallData(data);
        }
        if (data.status === 'accepted' && data.callerId === user.uid && !joinedRef.current) {
          console.log('[Chat] Call accepted, joining');
          joinedRef.current = true;
          setIncomingCallData(null);
          ringtoneRef.current?.pause();
          joinCall();
        }
        if (data.status === 'ended') {
          console.log('[Chat] Call ended');
          ringtoneRef.current?.pause();
          setIncomingCallData(null);
          endCallRef.current?.();
        }
      }, (error) => {
        console.error('[Chat] Call listener error:', error);
      });
      return unsub;
    } catch (error) {
      console.error('[Chat] Failed to setup call listener:', error);
    }
  }, [callDocId, user.uid, peerId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  

  useEffect(() => {
    if (inCall) {
      setCallSeconds(0);
      callSecondsRef.current = 0;
      timerRef.current = setInterval(() => {
        callSecondsRef.current += 1;
        setCallSeconds(callSecondsRef.current);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setCallSeconds(0);
    }
    return () => clearInterval(timerRef.current);
  }, [inCall]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const startCall = async () => {
    try {
      if (!user.uid || !peerId) {
        console.error('[Chat] Cannot start call - missing user data');
        return;
      }

      console.log('[Chat] Starting call with:', peerId);
      await setDoc(doc(db, 'calls', callDocId), {
        callerId: user.uid,
        callerName: user.displayName || 'User',
        receiverId: peerId,
        status: 'calling',
        createdAt: serverTimestamp(),
      });
      setCallStatus('calling');
      console.log('[Chat] Call initiated, status set to calling');

      // Telegram bildirişi göndər
      try {
        const peerSnap = await getDoc(doc(db, 'users', peerId));
        const peerData = peerSnap.data();
        if (!peerData) {
          console.warn('[Chat] Peer data not found');
          return;
        }
        const peerTgId = peerData.telegramId;
        if (peerTgId) {
          console.log('[Chat] Sending Telegram notification');
          await fetch('https://us-central1-speak2them-64f2b.cloudfunctions.net/sendCallNotification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telegramId: peerTgId,
              callerName: user.displayName || 'User',
            }),
          });
        }
      } catch (e) {
        console.error('[Chat] Telegram notification error:', e);
      }
    } catch (error) {
      console.error('[Chat] Failed to start call:', error);
      setCallStatus('error');
      alert('Failed to start call: ' + error.message);
    }
  }

  const joinCall = async () => {
    if (!user.uid || !chatId) {
      console.error('[Chat] Cannot join call - missing required data');
      return;
    }

    try {
      console.log('[Chat] Joining call...');
      ringtoneRef.current?.pause();
      
      await navigator.mediaDevices.getUserMedia({ audio: true });
      // eslint-disable-next-line no-unused-vars
      
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;

      client.on('user-published', async (remoteUser, mediaType) => {
        console.log('[Chat] User published:', mediaType);
        try {
          await client.subscribe(remoteUser, mediaType);
          if (mediaType === 'audio') {
            remoteUser.audioTrack.setPlaybackDevice('default').catch(() => {});
            remoteUser.audioTrack.play();
            setCallStatus('connected');
          }
        } catch (e) {
          console.error('[Chat] Subscribe error:', e);
        }
      });

      client.on('user-unpublished', (remoteUser) => {
        console.log('[Chat] User unpublished');
        setCallStatus('left');
      });

      console.log('[Chat] Fetching Agora token...');
      const tokenRes = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName: chatId }),
      });
      
      if (!tokenRes.ok) {
        throw new Error('Failed to get Agora token: ' + tokenRes.status);
      }
      
      const tokenData = await tokenRes.json();
      if (!tokenData.token) {
        throw new Error('No token received from Agora');
      }

      console.log('[Chat] Joining Agora channel:', chatId);
      await client.join(APP_ID, chatId, tokenData.token, user.uid);
      
      const localTrack = await AgoraRTC.createMicrophoneAudioTrack();
      localTrackRef.current = localTrack;
      
      console.log('[Chat] Publishing local audio');
      await client.publish(localTrack);
      
      setInCall(true);
      setCallStatus('connected');
      console.log('[Chat] Successfully joined call');
    } catch (err) {
      console.error('[Chat] Error joining call:', err);
      setCallStatus('error');
      alert('Failed to join call: ' + err.message);
    }
  };

  const endCall = async () => {
    try {
      const secondsTalked = callSecondsRef.current;

      try {
        if (localTrackRef.current) {
          localTrackRef.current.stop();
          localTrackRef.current.close();
          localTrackRef.current = null;
        }
        if (clientRef.current) {
          await clientRef.current.leave();
          clientRef.current = null;
        }
      } catch (e) {
        console.error('[Chat] Error cleaning up tracks:', e);
      }

      setInCall(false);
      setCallStatus('');
      setMuted(false);
      joinedRef.current = false;
      ringtoneRef.current?.pause();

      try {
        const callSnap = await getDoc(doc(db, 'calls', callDocId));
        const callData = callSnap.data() || {};
        const wasAlreadyEnded = callData.status === 'ended';

        if (secondsTalked > 5 && !wasAlreadyEnded) {
          const minutes = Math.ceil(secondsTalked / 60);
          const today = new Date().toDateString();
          const yesterday = new Date(Date.now() - 86400000).toDateString();
          const isInitiator = callData.callerId === user.uid;

          if (isInitiator) {
            const myRef = doc(db, 'users', user.uid);
            const mySnap = await getDoc(myRef);
            const myData = mySnap.data() || {};
            let myStreak = myData.streak || 0;
            if (myData.lastCallDate === today) {}
            else if (myData.lastCallDate === yesterday) myStreak += 1;
            else myStreak = 1;

            await setDoc(myRef, {
              totalMinutes: (myData.totalMinutes || 0) + minutes,
              callCount: (myData.callCount || 0) + 1,
              streak: myStreak,
              lastCallDate: today,
            }, { merge: true });

            const peerRef = doc(db, 'users', peerId);
            const peerSnap = await getDoc(peerRef);
            const peerData = peerSnap.data() || {};
            let peerStreak = peerData.streak || 0;
            if (peerData.lastCallDate === today) {}
            else if (peerData.lastCallDate === yesterday) peerStreak += 1;
            else peerStreak = 1;

            await setDoc(peerRef, {
              totalMinutes: (peerData.totalMinutes || 0) + minutes,
              callCount: (peerData.callCount || 0) + 1,
              streak: peerStreak,
              lastCallDate: today,
            }, { merge: true });
          }
        }

        if (!wasAlreadyEnded && callSnap.exists()) {
          await updateDoc(doc(db, 'calls', callDocId), { status: 'ended', duration: secondsTalked });
        }

        if (secondsTalked >= 180) setShowRating(true);
      } catch (e) {
        console.error('[Chat] Error ending call:', e);
      }
    } catch (e) {
      console.error('[Chat] Unexpected error in endCall:', e);
    }
  };

  endCallRef.current = endCall;

  const submitRating = async (stars) => {
    try {
      const peerDoc = await getDoc(doc(db, 'users', peerId));
      if (peerDoc.exists()) {
        const peerData = peerDoc.data();
        await updateDoc(doc(db, 'users', peerId), {
          rating: (peerData.rating || 0) + stars,
          ratingCount: (peerData.ratingCount || 0) + 1,
        });
      }
    } catch (e) {}
    setShowRating(false);
  };

  const toggleMute = async () => {
    if (localTrackRef.current) {
      await localTrackRef.current.setMuted(!muted);
      setMuted(!muted);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    
    // Validate required data
    if (!user.uid || !chatId || !peerId) {
      console.error('[Chat] Cannot send message - missing required data:', { userId: user.uid, chatId, peerId });
      alert('Error: User data missing. Please refresh.');
      return;
    }

    const messageText = text.trim();
    const messageData = {
      text: messageText,
      senderId: user.uid,
      senderName: user.displayName || 'User',
      createdAt: serverTimestamp(),
    };

    try {
      console.log('[Chat] Sending message to:', chatId);
      
      // Ensure chat document exists
      const chatRef = doc(db, 'chats', chatId);
      await setDoc(chatRef, {
        participants: [user.uid, peerId],
        updatedAt: serverTimestamp(),
        lastMessage: messageText,
      }, { merge: true });

      // Add message
      await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
      console.log('[Chat] Message sent successfully');
      setText('');
    } catch (error) {
      console.error('[Chat] Failed to send message:', error);
      alert('Failed to send message: ' + error.message);
    }
  };

  return (
    <div className="chat-page">

      {incomingCallData && !inCall && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: '#0f0f1aee', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9998,
        }}>
          <div style={{
            background: '#1e1e30', border: '2px solid #7c6ff7',
            borderRadius: '20px', padding: '40px', textAlign: 'center', maxWidth: '320px', width: '90%',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📞</div>
            <p style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
              {peer?.name} sizi zəng edir...
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
              <button className="btn-accept" onClick={async () => {
                setIncomingCallData(null);
                await setDoc(doc(db, 'calls', callDocId), { status: 'accepted' }, { merge: true });
                joinedRef.current = true;
                joinCall();
              }}>✅ Qəbul et</button>
              <button className="btn-reject" onClick={async () => {
                setIncomingCallData(null);
                await updateDoc(doc(db, 'calls', callDocId), { status: 'rejected' });
              }}>❌ Rədd et</button>
            </div>
          </div>
        </div>
      )}

      {callStatus === 'rejected' && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#ef4444', color: 'white', padding: '12px 24px',
          borderRadius: '12px', fontWeight: 600, zIndex: 9999,
        }}>
          ❌ Zəng rədd edildi
        </div>
      )}

      {showRating && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: '#0f0f1aee', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{
            background: '#1e1e30', border: '1px solid #2e2e50',
            borderRadius: '20px', padding: '40px', textAlign: 'center', maxWidth: '320px', width: '90%',
          }}>
            <div style={{ marginBottom: '12px' }}>
              {peer?.photo
                ? <img src={peer.photo} alt={peer.name} style={{ width: '72px', height: '72px', borderRadius: '50%' }} />
                : <div style={{ width: '72px', height: '72px', background: 'linear-gradient(135deg, #7c6ff7, #5b4de8)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 700, margin: '0 auto' }}>{peer?.name?.charAt(0)}</div>
              }
            </div>
            <p style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Zəng necə getdi?</p>
            <p style={{ color: '#888', fontSize: '14px', marginBottom: '24px' }}>{peer?.name}-i qiymətləndir</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setSelectedStar(star)} style={{
                  fontSize: '36px', background: 'none', border: 'none',
                  cursor: 'pointer', opacity: star <= selectedStar ? 1 : 0.3, transition: 'opacity 0.2s',
                }}>⭐</button>
              ))}
            </div>
            <button onClick={() => selectedStar > 0 && submitRating(selectedStar)} style={{
              width: '100%', padding: '14px',
              background: selectedStar > 0 ? 'linear-gradient(135deg, #7c6ff7, #5b4de8)' : '#2e2e50',
              color: 'white', border: 'none', borderRadius: '12px',
              fontSize: '16px', fontWeight: 700, cursor: selectedStar > 0 ? 'pointer' : 'not-allowed', marginBottom: '12px',
            }}>Göndər</button>
            <button onClick={() => setShowRating(false)} style={{
              background: 'transparent', border: 'none', color: '#888', fontSize: '13px', cursor: 'pointer',
            }}>Keç</button>
          </div>
        </div>
      )}

      {(inCall || callStatus === 'calling') && (
        <div className="fullscreen-call">
          <div className="call-avatar-big">
            {peer?.photo ? <img src={peer.photo} alt={peer.name} /> : peer?.name?.charAt(0).toUpperCase()}
          </div>
          <h2 className="call-peer-name">
            {peer?.name}
            {peer?.isPremium && <PremiumBadge />}
          </h2>
          <p className="call-status-text">
            {callStatus === 'calling' && '📞 Calling...'}
            {callStatus === 'connected' && `🟢 ${formatTime(callSeconds)}`}
            {callStatus === 'left' && '⚠️ Partner left'}
            {callStatus === 'rejected' && '❌ Rədd edildi'}
            {callStatus === 'error' && '❌ Error'}
          </p>
          <div className="fullscreen-call-buttons">
            {inCall && (
              <>
                <button className={`call-btn-big ${muted ? 'active-mute' : ''}`} onClick={toggleMute}>
                  {muted ? '🔇' : '🎤'}<span>{muted ? 'Unmute' : 'Mute'}</span>
                </button>
                <button className="call-btn-big daily-btn" onClick={() => setShowDaily(true)}>
                  📅<span>Daily</span>
                </button>
              </>
            )}
            <button className="call-btn-big end" onClick={endCall}>📵<span>End</span></button>
          </div>
        </div>
      )}

      {showDaily && (
        <div className="daily-panel">
          <div className="daily-panel-header">
            <h3>📅 {content.topic}</h3>
            <button className="daily-close" onClick={() => setShowDaily(false)}>✕</button>
          </div>
          <div className="daily-panel-tabs">
            <button className={`dp-tab ${dailyTab === 'questions' ? 'active' : ''}`} onClick={() => setDailyTab('questions')}>🗣️ Questions</button>
            <button className={`dp-tab ${dailyTab === 'vocabulary' ? 'active' : ''}`} onClick={() => setDailyTab('vocabulary')}>📚 Vocab</button>
            <button className={`dp-tab ${dailyTab === 'idioms' ? 'active' : ''}`} onClick={() => setDailyTab('idioms')}>💬 Idioms</button>
          </div>
          <div className="daily-panel-body">
            {dailyTab === 'questions' && (
              <div>
                <div className="difficulty-toggle" style={{ marginBottom: 12 }}>
                  <button className={`diff-btn ${difficulty === 'easy' ? 'active' : ''}`} onClick={() => setDifficulty('easy')}>🟢 Easy</button>
                  <button className={`diff-btn ${difficulty === 'hard' ? 'active' : ''}`} onClick={() => setDifficulty('hard')}>🔴 Hard</button>
                </div>
                {content.questions[difficulty].map((q, i) => (
                  <div key={i} className="question-card" style={{ marginBottom: 10 }}>
                    <span className="question-number">{i + 1}</span>
                    <p>{q}</p>
                  </div>
                ))}
              </div>
            )}
            {dailyTab === 'vocabulary' && (
              <div className="vocab-list">
                {content.vocabulary.map((v, i) => (
                  <div key={i} className="vocab-card" onClick={() => setFlipped(p => ({ ...p, [i]: !p[i] }))}>
                    {!flipped[i]
                      ? <div className="vocab-front"><h3>{v.word}</h3><span className="tap-hint">Tap to see meaning</span></div>
                      : <div className="vocab-back"><p className="vocab-meaning">{v.meaning}</p><p className="vocab-example">"{v.example}"</p></div>
                    }
                  </div>
                ))}
              </div>
            )}
            {dailyTab === 'idioms' && (
              <div className="idioms-list">
                {content.idioms.map((idiom, i) => (
                  <div key={i} className="idiom-card">
                    <h3>"{idiom.phrase}"</h3>
                    <p className="idiom-meaning">📌 {idiom.meaning}</p>
                    <p className="idiom-example">💡 "{idiom.example}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="chat-header">
        <button className="btn-back" onClick={() => { endCall(); navigate('/'); }}>← Back</button>
        <div className="chat-peer-info">
          <div className="chat-avatar">
            {peer?.photo
              ? <img src={peer.photo} alt={peer.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
              : peer?.name?.charAt(0).toUpperCase()
            }
          </div>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center' }}>
              {peer?.name}
              {peer?.isPremium && <PremiumBadge />}
            </h3>
            <span>{peer?.level || 'English Speaker'}</span>
          </div>
        </div>
        <div className="call-controls">
          {!inCall && callStatus !== 'calling' && (
            <button className="btn-call" onClick={startCall}>🎙️ Call</button>
          )}
          <button className="btn-daily-chat" onClick={() => setShowDaily(!showDaily)}>📅</button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map(m => (
          <div key={m.id} className={`message ${m.senderId === user.uid ? 'mine' : 'theirs'}`}>
            <span className="message-sender">{m.senderName}</span>
            <p>{m.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input" onSubmit={sendMessage}>
        <input
          type="text"
          placeholder="Type a message..."
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <button type="submit">Send ➤</button>
      </form>
    </div>
  );
}