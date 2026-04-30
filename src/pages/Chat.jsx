import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection, addDoc, onSnapshot,
  query, orderBy, serverTimestamp,
  doc, getDoc, setDoc, deleteDoc
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import AgoraRTC from 'agora-rtc-sdk-ng';

const APP_ID = process.env.REACT_APP_AGORA_APP_ID;
const functionsInstance = getFunctions();
const getAgoraToken = httpsCallable(functionsInstance, 'getAgoraToken');

export default function Chat({ user }) {
  const { peerId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [peer, setPeer] = useState(null);
  const [inCall, setInCall] = useState(false);
  const [muted, setMuted] = useState(false);
  const [callStatus, setCallStatus] = useState('');
  const [incomingCall, setIncomingCall] = useState(false);
  const clientRef = useRef(null);
  const localTrackRef = useRef(null);
  const bottomRef = useRef(null);
  const inCallRef = useRef(false);

  const chatId = [user.uid, peerId].sort().join('_');
  const callDocId = `call_${chatId}`;

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

  // Agora-ya qoşul — HƏR İKİ TƏRƏF üçün eyni funksiya
  const joinAgoraChannel = useCallback(async () => {
    if (inCallRef.current) return; // artıq qoşulubsa keç
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;

      // Qarşı tərəf yayım başladıqda dinlə
      client.on('user-published', async (remoteUser, mediaType) => {
        await client.subscribe(remoteUser, mediaType);
        if (mediaType === 'audio') {
          remoteUser.audioTrack.play();
          setCallStatus('🟢 Connected');
        }
      });

      client.on('user-unpublished', () => {
        setCallStatus('⚠️ Partner left the call');
      });

      // Token al
      const tokenResult = await getAgoraToken({ channelName: chatId });
      const token = tokenResult.data.token;

      // Kanala qoşul
      await client.join(APP_ID, chatId, token, user.uid);

      // Mikrofonu aç və yayımla
      const localTrack = await AgoraRTC.createMicrophoneAudioTrack();
      localTrackRef.current = localTrack;
      await client.publish(localTrack);

      inCallRef.current = true;
      setInCall(true);
      setCallStatus('🟢 Connected');
    } catch (err) {
      console.error('Agora error:', err);
      setCallStatus('❌ Xəta: ' + err.message);
    }
  }, [chatId, user.uid]);

  // Zəng sənədini dinlə
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'calls', callDocId), (snap) => {
      if (!snap.exists()) {
        setIncomingCall(false);
        return;
      }
      const data = snap.data();

      // Zəng gəldi — qəbul et düyməsi göstər
      if (data.callerId !== user.uid && data.status === 'calling') {
        setIncomingCall(true);
        setCallStatus('📞 Incoming call...');
      }

      // Qarşı tərəf qəbul etdi — zəng edən də kanala qoşsun
      if (data.status === 'accepted' && data.callerId === user.uid && !inCallRef.current) {
        setCallStatus('Connecting...');
        joinAgoraChannel();
      }

      // Zəng bitdi
      if (data.status === 'ended') {
        setIncomingCall(false);
        handleEndCall();
      }
    });
    return unsub;
  }, [callDocId, user.uid, joinAgoraChannel]);

  const startCall = async () => {
    setCallStatus('📞 Calling...');
    await setDoc(doc(db, 'calls', callDocId), {
      callerId: user.uid,
      callerName: user.displayName || 'User',
      status: 'calling',
      createdAt: serverTimestamp(),
    });
    // Zəng edən HƏLƏ kanala qoşmur — qəbul edildikdə qoşacaq
  };

  const acceptCall = async () => {
    setIncomingCall(false);
    // Əvvəlcə özü kanala qoşur
    await joinAgoraChannel();
    // Sonra Firestore-a "accepted" yazır ki, zəng edən də qoşsun
    await setDoc(doc(db, 'calls', callDocId), {
      status: 'accepted',
    }, { merge: true });
  };

  const rejectCall = async () => {
    setIncomingCall(false);
    await deleteDoc(doc(db, 'calls', callDocId));
    setCallStatus('');
  };

  const handleEndCall = async () => {
    localTrackRef.current?.stop();
    localTrackRef.current?.close();
    await clientRef.current?.leave();
    clientRef.current = null;
    localTrackRef.current = null;
    inCallRef.current = false;
    setInCall(false);
    setCallStatus('');
  };

  const endCall = async () => {
    await handleEndCall();
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
      {incomingCall && (
        <div className="incoming-call">
          <p>📞 {peer?.name} sizi zəng edir...</p>
          <div className="incoming-call-buttons">
            <button className="btn-accept" onClick={acceptCall}>✅ Qəbul et</button>
            <button className="btn-reject" onClick={rejectCall}>❌ Rədd et</button>
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
          {!inCall ? (
            <button className="btn-call" onClick={startCall}>🎙️ Call</button>
          ) : (
            <>
              <button className="btn-mute" onClick={toggleMute}>
                {muted ? '🔇 Unmute' : '🎤 Mute'}
              </button>
              <button className="btn-end" onClick={endCall}>📵 End</button>
            </>
          )}
        </div>
      </div>

      {callStatus && (
        <div style={{
          textAlign: 'center',
          padding: '8px',
          background: '#1e1e30',
          color: '#7c6ff7',
          fontSize: '14px'
        }}>
          {callStatus}
        </div>
      )}

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