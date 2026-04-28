import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection, addDoc, onSnapshot,
  query, orderBy, serverTimestamp, doc, getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import AgoraRTC from 'agora-rtc-sdk-ng';

const APP_ID = process.env.REACT_APP_AGORA_APP_ID;

export default function Chat({ user }) {
  const { peerId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [peer, setPeer] = useState(null);
  const [inCall, setInCall] = useState(false);
  const [muted, setMuted] = useState(false);
  const clientRef = useRef(null);
  const localTrackRef = useRef(null);
  const bottomRef = useRef(null);

  const chatId = [user.uid, peerId].sort().join('_');

  // Peer məlumatlarını gətir
  useEffect(() => {
    getDoc(doc(db, 'users', peerId)).then(d => {
      if (d.exists()) setPeer(d.data());
    });
  }, [peerId]);

  // Mesajları dinlə
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

  // Mesaj göndər
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text,
      senderId: user.uid,
      senderName: user.displayName,
      createdAt: serverTimestamp(),
    });
    setText('');
  };

  // Audio zəng başlat
  const startCall = async () => {
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    clientRef.current = client;
    await client.join(APP_ID, chatId, null, user.uid);
    const localTrack = await AgoraRTC.createMicrophoneAudioTrack();
    localTrackRef.current = localTrack;
    await client.publish(localTrack);
    client.on('user-published', async (remoteUser, mediaType) => {
      await client.subscribe(remoteUser, mediaType);
      if (mediaType === 'audio') remoteUser.audioTrack.play();
    });
    setInCall(true);
  };

  // Zəngi bitir
  const endCall = async () => {
    localTrackRef.current?.stop();
    localTrackRef.current?.close();
    await clientRef.current?.leave();
    setInCall(false);
  };

  // Mikrofonu sustur
  const toggleMute = async () => {
    if (localTrackRef.current) {
      await localTrackRef.current.setMuted(!muted);
      setMuted(!muted);
    }
  };

  return (
    <div className="chat-page">
      <div className="chat-header">
        <button className="btn-back" onClick={() => { endCall(); navigate('/'); }}>← Back</button>
        <div className="chat-peer-info">
          <div className="chat-avatar">{peer?.name?.charAt(0).toUpperCase()}</div>
          <div>
            <h3>{peer?.name}</h3>
            <span>{peer?.level}</span>
          </div>
        </div>
        <div className="call-controls">
          {!inCall ? (
            <button className="btn-call" onClick={startCall}>🎙️ Start Call</button>
          ) : (
            <>
              <button className="btn-mute" onClick={toggleMute}>
                {muted ? '🔇 Unmute' : '🎤 Mute'}
              </button>
              <button className="btn-end" onClick={endCall}>📵 End Call</button>
            </>
          )}
        </div>
      </div>

      <div className="chat-messages">
        {messages.map(m => (
          <div
            key={m.id}
            className={`message ${m.senderId === user.uid ? 'mine' : 'theirs'}`}
          >
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