import React, { useEffect, useState, useRef, useCallback } from 'react';
import { collection, deleteDoc, doc, limit, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { useNavigate, useLocation } from 'react-router-dom';
import IncomingCallModal from './IncomingCallModal';
import { subscribeToBlocked } from '../utils/blocklist';

export default function GlobalCallListener({ user }) {
  const [incomingCall, setIncomingCall] = useState(null);
  const ringtoneRef = useRef(null);
  // Ref, state yox: zəng snapshot-u gələndə render gözləmədən oxunmalıdır.
  const blockedRef = useRef(new Set());
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => subscribeToBlocked(user?.uid, (s) => { blockedRef.current = s; }), [user?.uid]);

  useEffect(() => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1361/1361-preview.mp3');
    audio.loop = true;
    ringtoneRef.current = audio;
    return () => { audio.pause(); };
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'calls'),
      where('receiverId', '==', user.uid),
      where('status', '==', 'calling'),
      limit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const callData = { ...snap.docs[0].data(), callDocId: snap.docs[0].id };
        // Bloklanmış şəxsin zəngi: modal görünmür, zəng sənədi silinir ki,
        // qarşı tərəf sonsuz "çalır" vəziyyətində qalmasın.
        if (callData.callerId && blockedRef.current.has(callData.callerId)) {
          deleteDoc(doc(db, 'calls', callData.callDocId)).catch(() => {});
          return;
        }
        setIncomingCall(callData);
        const playPromise = ringtoneRef.current?.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            console.warn('Autoplay prevented. User interaction required.');
          });
        }
      } else {
        setIncomingCall(null);
        ringtoneRef.current?.pause();
      }
    });
    return unsub;
  }, [user.uid]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall?.callDocId) return;
    ringtoneRef.current?.pause();

    try {
      // Acquire mic permission while we still have the user gesture (iOS/Safari),
      // then release the track immediately — Chat creates its own track on join.
      const tempTrack = await AgoraRTC.createMicrophoneAudioTrack();
      tempTrack.stop();
      tempTrack.close();
    } catch (e) {
      console.warn('[GlobalCallListener] Mic permission denied or failed:', e);
    }

    await setDoc(doc(db, 'calls', incomingCall.callDocId), { status: 'accepted' }, { merge: true });
    setIncomingCall(null);
    navigate(`/chat/${incomingCall.callerId}`, { state: { acceptedCall: true } });
  }, [incomingCall, navigate]);

  const rejectCall = useCallback(async () => {
    if (!incomingCall?.callDocId) return;
    ringtoneRef.current?.pause();
    await deleteDoc(doc(db, 'calls', incomingCall.callDocId));
    setIncomingCall(null);
  }, [incomingCall]);

  // Don't show modal if we are already in the chat with that person
  if (incomingCall && location.pathname === `/chat/${incomingCall.callerId}`) {
     return null; 
  }

  return <IncomingCallModal call={incomingCall} onAccept={acceptCall} onReject={rejectCall} />;
}
