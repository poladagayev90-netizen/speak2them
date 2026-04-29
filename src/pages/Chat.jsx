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
  const [callStatus, setCallStatus] = useState('');
  const clientRef = useRef(null);
  const localTrackRef = useRef(null);
  const bottomRef = useRef(null);

  const chatId = [user.uid, peerId].sort().join('_');

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

  const startCall = async () => {
    try {
      setCallStatus('Connecting...');
      
      // Mikrofon icazəsi əvvəlcədən al
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;

      client.on('user-published', async (remoteUser, mediaType) => {
        await client.subscribe(remoteUser, mediaType);
        if (mediaType === 'audio') {
          remoteUser.audioTrack.play();
          setCallStatus('Connected ✅');
        }
      });

      client.on('user-unpublished', () => {
        setCallStatus('Partner left the call');
      });

      await client.join(APP_ID, chatId, null, user.uid);
      const localTrack = await AgoraRTC.createMicrophoneAudioTrack();
      localTrackRef.current = localTrack;
      await client.publish(localTrack);
      setInCall(true);
      setCallStatus('Waiting for partner... 🎙️');
    } catch (err) {
      console.error(err);
      setCallStatus('❌ Microphone access denied!');
    }
  };

  const endCall = async () => {
    localTrackRef.current?.stop();
    localTrackRef.current?.close();
    await clientRef.current?.leave();
    setInCall(false);
    setCallStatus('');
  };

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
            <button class