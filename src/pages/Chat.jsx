import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  collection, addDoc, onSnapshot,
  query, orderBy, serverTimestamp,
  doc, getDoc, setDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import AgoraRTC from 'agora-rtc-sdk-ng';

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
  const clientRef = useRef(null);
  const localTrackRef = useRef(null);
  const bottomRef = useRef(null);
  const joinedRef = useRef(false);
  const ringtoneRef = useRef(null);
  const timerRef = useRef(null);

  const chatId = [user.uid, peerId].sort().join('_');
  const callDocId = `call_${chatId}`;

  useEffect(() => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
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
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt')
    );
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return unsub;
  }, [chatId]);

  useEffect(() => {
    if (location.state?.acceptedCall && !joinedRef.current) {
      joinedRef.current = true;
      joinCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'calls', callDocId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.status === 'accepted' && data.callerId === user.uid && !joinedRef.current) {
        joinedRef.current = true;
        ringtoneRef.current?.pause();
        joinCall();
      }
      if (data.status === 'ended') {
        ringtoneRef.current?.pause();
        endCall();
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, user.uid]);

  // Zəng sayacı
  useEffect(() => {
    if (inCall) {
      setCallSeconds(0);
      timerRef.current = setInterval(() => {
        setCallSeconds(s => s + 1);
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
    await setDoc(doc(db, 'calls', callDocId), {
      callerId: user.uid,
      callerName: user.displayName || 'User',
      receiverId: peerId,
      status: 'calling',
      createdAt: serverTimestamp(),
    });
    try { ringtoneRef.current?.play(); } catch (e) {}
    setCallStatus('calling');
  };

  const joinCall = async () => {
    ringtoneRef.current?.pause();
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;

      client.on('user-published', async (remoteUser, mediaType) => {
        await client.subscribe(remoteUser, mediaType);
        if (mediaType === 'audio') {
          remoteUser.audioTrack.setPlaybackDevice('default').catch(() => {});
          remoteUser.audioTrack.play();
          setCallStatus('connected');
        }
      });

      client.on('user-unpublished', () => {
        setCallStatus('left');
      });

      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName: chatId }),
      });
      const data = await res.json();
      await client.join(APP_ID, chatId, data.token, user.uid);
      const localTrack = await AgoraRTC.createMicrophoneAudioTrack();
      localTrackRef.current = localTrack;
      await client.publish(localTrack);
      setInCall(true);
      setCallStatus('connected');
    } catch (err) {
      console.error(err);
      setCallStatus('error');
    }
  };

  const endCall = async () => {
    joinedRef.current = false;
    ringtoneRef.current?.pause();
    clearInterval(timerRef.current);
    localTrackRef.current?.stop();
    localTrackRef.current?.close();
    await clientRef.current?.leave();
    setInCall(false);
    setCallStatus('');
    try {
      await setDoc(doc(db, 'calls', callDocId), { status: 'ended' }, { merge: true });
      setTimeout(() => deleteDoc(doc(db, 'calls', callDocId)), 2000);
    } catch (e) {}
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
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text,
      senderId: user.uid,
      senderName: user.displayName || 'User',
      createdAt: serverTimestamp(),
    });
    setText('');
  };

  return (
    <div className="chat-page">

      {/* TAM EKRAN ZƏNG İNTERFEYSİ */}
      {(inCall || callStatus === 'calling') && (
        <div className="fullscreen-call">
          <div className="call-avatar-big">
            {peer?.photo
              ? <img src={peer.photo} alt={peer.name} />
              : peer?.name?.charAt(0).toUpperCase()
            }
          </div>
          <h2 className="call-peer-name">{peer?.name}</h2>
          <p className="call-status-text">
            {callStatus === 'calling' && '📞 Calling...'}
            {callStatus === 'connected' && `🟢 ${formatTime(callSeconds)}`}
            {callStatus === 'left' && '⚠️ Partner left'}
            {callStatus === 'error' && '❌ Error'}
          </p>

          <div className="fullscreen-call-buttons">
            {inCall && (
              <button
                className={`call-btn-big ${muted ? 'active-mute' : ''}`}
                onClick={toggleMute}
              >
                {muted ? '🔇' : '🎤'}
                <span>{muted ? 'Unmute' : 'Mute'}</span>
              </button>
            )}
            <button className="call-btn-big end" onClick={endCall}>
              📵
              <span>End</span>
            </button>
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
            <h3>{peer?.name}</h3>
            <span>{peer?.level || 'English Speaker'}</span>
          </div>
        </div>
        <div className="call-controls">
          {!inCall && callStatus !== 'calling' && (
            <button className="btn-call" onClick={startCall}>🎙️ Call</button>
          )}
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