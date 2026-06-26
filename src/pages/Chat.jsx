import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  collection, addDoc, onSnapshot,
  query, orderBy, serverTimestamp,
  doc, getDoc, setDoc, updateDoc, runTransaction
} from 'firebase/firestore';
import { db } from '../firebase';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { getTodayContent } from '../data/weeklyContent';
import CallInsights from '../components/CallInsights';
import PremiumBadge from '../components/PremiumBadge';
import { BadgeUnlockModal } from '../components/BadgeSystem';
import { checkNewBadges } from '../badges/checker';
import { applyBadgeRewardsToData } from '../badges/rewards';
import { authedFetch } from '../api';
import { FUNCTIONS_BASE } from '../constants';
import { startLocalRecording, stopLocalRecording } from '../utils/localRecorder';
import { analyzeCallAudio } from '../utils/analyzeWithGemini';

const APP_ID = process.env.REACT_APP_AGORA_APP_ID;
const TOKEN_URL = `${FUNCTIONS_BASE}/getAgoraToken`;

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
  const [showInsights, setShowInsights] = useState(false);
  const [selectedStar, setSelectedStar] = useState(0);
  const [dailyTab, setDailyTab] = useState('questions');
  const [difficulty, setDifficulty] = useState('easy');
  const [flipped, setFlipped] = useState({});
  const [incomingCallData, setIncomingCallData] = useState(null);

  const [newBadge, setNewBadge] = useState(null);
  const [newBadgeReward, setNewBadgeReward] = useState('');
  const [, setBadgeQueue] = useState([]);
  const [bonusMinutes, setBonusMinutes] = useState(user.bonusMinutes || 0);

  const callSecondsRef = useRef(0);
  const endCallRef = useRef(null);
  const clientRef = useRef(null);
  const localTrackRef = useRef(null);
  const bottomRef = useRef(null);
  const joinedRef = useRef(false);
  const endingRef = useRef(false);
  const ringtoneRef = useRef(null);
  const timerRef = useRef(null);
  const prevCallStatus = useRef('');

  const stateCallId = location.state?.callId;
  const isMatchedCall = location.state?.matchedCall === true;
  const chatId = [user.uid, peerId].sort().join('_');
  const callDocId = stateCallId || `call_${chatId}`;
  const content = getTodayContent();
  const freeCallLimitSeconds = (15 + bonusMinutes) * 60;

  // Refs for stable access inside callbacks
  const chatIdRef = useRef(chatId);
  const callDocIdRef = useRef(callDocId);
  const peerIdRef = useRef(peerId);
  const userUidRef = useRef(user.uid);
  chatIdRef.current = chatId;
  callDocIdRef.current = callDocId;
  peerIdRef.current = peerId;
  userUidRef.current = user.uid;

  useEffect(() => {
    setBonusMinutes(user.bonusMinutes || 0);
  }, [user.bonusMinutes]);

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
    if (!chatId || !user.uid || !peerId) return;

    const participants = [user.uid, peerId].sort();
    setDoc(doc(db, 'chats', chatId), {
      participants,
      updatedAt: serverTimestamp(),
    }, { merge: true }).catch((err) => {
      console.error('[Chat] ensure chat doc error:', err);
    });

    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const msgs = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              createdAt: data.createdAt?.toDate?.() || null,
            };
          })
          .sort((a, b) => {
            if (a.createdAt && b.createdAt) return a.createdAt - b.createdAt;
            if (a.createdAt) return -1;
            if (b.createdAt) return 1;
            return 0;
          });
        setMessages(msgs);
        setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 50);
      },
      (err) => {
        console.error('[Chat] messages listener error:', err);
      }
    );
    return unsub;
  }, [chatId, user.uid, peerId]);

  // Əsas joinCall — heç bir guard yoxdur, çağıran tərəf özü yoxlayır
  const joinCall = useCallback(async () => {
    const uid = userUidRef.current;
    const cId = chatIdRef.current;

    ringtoneRef.current?.pause();

    try {
      // Əvvəlki client varsa təmizlə
      if (clientRef.current) {
        try {
          await clientRef.current.leave();
        } catch (e) {}
        clientRef.current = null;
      }
      if (localTrackRef.current) {
        localTrackRef.current.stop();
        localTrackRef.current.close();
        localTrackRef.current = null;
      }

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;

      client.on('user-published', async (remoteUser, mediaType) => {
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

      client.on('user-unpublished', () => setCallStatus('left'));

      const tokenRes = await authedFetch(TOKEN_URL, {
        method: 'POST',
        body: JSON.stringify({ channelName: cId }),
      });

      if (!tokenRes.ok) throw new Error('Token error: ' + tokenRes.status);
      const tokenData = await tokenRes.json();
      if (!tokenData.token) throw new Error('No token');

      await client.join(APP_ID, cId, tokenData.token, uid);

      const localTrack = await AgoraRTC.createMicrophoneAudioTrack();
      localTrackRef.current = localTrack;
      await client.publish(localTrack);

      // Extract stream from Agora to prevent double microphone permission lock
      const nativeTrack = localTrack.getMediaStreamTrack();
      const stream = new MediaStream([nativeTrack]);
      startLocalRecording(stream);

      setInCall(true);
      setCallStatus('connected');
      joinedRef.current = true;
    } catch (err) {
      console.error('[Chat] joinCall error:', err);
      joinedRef.current = false;
      clientRef.current = null;
      localTrackRef.current = null;
      setCallStatus('error');
    }
  }, []);

  // Location state — caller qəbul alandan sonra
  useEffect(() => {
    if (location.state?.acceptedCall && !joinedRef.current) {
      joinedRef.current = true;
      // Small stagger for matched calls to prevent Agora collision
      const delay = isMatchedCall ? (user.uid < peerId ? 0 : 1200) : 0;
      const timer = setTimeout(() => { joinCall(); }, delay);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isMatchedCall || !stateCallId) return;
    // Ensure call doc exists with correct structure for matched calls
    setDoc(doc(db, 'calls', stateCallId), {
      userA: [user.uid, peerId].sort()[0],
      userB: [user.uid, peerId].sort()[1],
      callerId: user.uid,
      receiverId: peerId,
      status: 'accepted',
      source: 'random_match',
    }, { merge: true }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Firestore call listener
  useEffect(() => {
    if (!callDocId || !user.uid || !peerId) return;

    const unsub = onSnapshot(doc(db, 'calls', callDocId), (snap) => {
      if (!snap.exists()) {
        if (prevCallStatus.current === 'calling') {
          setCallStatus('rejected');
          setTimeout(() => setCallStatus(''), 3000);
        }
        setIncomingCallData(null);
        prevCallStatus.current = '';
        return;
      }

      const data = snap.data();
      const prevStatus = prevCallStatus.current;
      prevCallStatus.current = data.status;

      // Gələn zəng
      if (data.callerId === peerId && data.status === 'calling') {
        setIncomingCallData(data);
      }

      // Caller tərəfi — qəbul edildi
      if (data.status === 'accepted' && data.callerId === user.uid && prevStatus !== 'accepted') {
        if (!joinedRef.current) {
          joinedRef.current = true;
          setIncomingCallData(null);
          ringtoneRef.current?.pause();
          joinCall();
        }
      }

      // Rədd edildi
      if (data.status === 'rejected' && data.callerId === user.uid) {
        setCallStatus('rejected');
        ringtoneRef.current?.pause();
        setTimeout(() => setCallStatus(''), 3000);
      }

      // Bitdi
      if (data.status === 'ended') {
        ringtoneRef.current?.pause();
        setIncomingCallData(null);
        endCallRef.current?.();
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callDocId, user.uid, peerId]);

  useEffect(() => {
    if (inCall) {
      setCallSeconds(0);
      callSecondsRef.current = 0;
      timerRef.current = setInterval(() => {
        callSecondsRef.current += 1;
        setCallSeconds(callSecondsRef.current);

        if (!user.isPremium && callSecondsRef.current >= freeCallLimitSeconds) {
          endCallRef.current?.();
          alert('⏰ Pulsuz danışıq limitin doldu!\n\nBonus dəqiqələrin varsa limitə əlavə olunur.\n\n👑 Premium al — limitsiz danış!');
        }

        if (!user.isPremium && callSecondsRef.current === Math.max(0, freeCallLimitSeconds - 120)) {
          alert('⚠️ 2 dəqiqə qaldı! Premium al — limitsiz danış!');
        }
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setCallSeconds(0);
    }
    return () => clearInterval(timerRef.current);
  }, [freeCallLimitSeconds, inCall, user.isPremium]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const startCall = async () => {
    if (!user.uid || !peerId) return;
    try {
      await setDoc(doc(db, 'calls', callDocId), {
        userA: user.uid,
        userB: peerId,
        callerId: user.uid,
        callerName: user.displayName || 'User',
        receiverId: peerId,
        status: 'calling',
        createdAt: serverTimestamp(),
      });
      setCallStatus('calling');

      try {
        const peerSnap = await getDoc(doc(db, 'users', peerId));
        const peerData = peerSnap.data();
        if (peerData?.telegramId) {
          await authedFetch(`${FUNCTIONS_BASE}/sendCallNotification`, {
            method: 'POST',
            body: JSON.stringify({
              telegramId: peerData.telegramId,
              callerName: user.displayName || 'User',
              callerId: user.uid,
              receiverId: peerId,
            }),
          });
        }
      } catch (e) {}
    } catch (error) {
      console.error('[Chat] startCall error:', error);
      setCallStatus('error');
    }
  };

  const endCall = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;

    const secondsTalked = callSecondsRef.current;

    // Trigger recording stop asynchronously without blocking endCall
    stopLocalRecording().then(async (audioBlob) => {
      if (audioBlob && user && secondsTalked >= 10) {
        await analyzeCallAudio(audioBlob, user.uid, callDocId);
        setShowInsights(true);
      }
    }).catch(console.error);

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
    } catch (e) {}

    setInCall(false);
    setCallStatus('');
    setMuted(false);
    joinedRef.current = false;
    ringtoneRef.current?.pause();

    try {
      let currentUserUnlocks = [];

      // If call doc doesn't exist, still do local cleanup
      const callDocSnap = await getDoc(doc(db, 'calls', callDocId)).catch(() => null);
      if (!callDocSnap?.exists()) {
        setInCall(false);
        setCallStatus('');
        setMuted(false);
        joinedRef.current = false;
        endingRef.current = false;
        return;
      }

      await runTransaction(db, async (transaction) => {
        const callRef = doc(db, 'calls', callDocId);
        const callSnap = await transaction.get(callRef);
        if (!callSnap.exists()) return;

        const callData = callSnap.data() || {};
        
        // Gather all possible participant UIDs robustly
        const participantSet = new Set([
          callData.userA,
          callData.userB, 
          callData.callerId,
          callData.receiverId,
          user.uid,
          peerId,
        ].filter(Boolean));
        const participants = Array.from(participantSet).slice(0, 2);
        const uniqueParticipants = participants;
        const durationMinutes = Math.ceil(secondsTalked / 60);
        const shouldApplyStats = secondsTalked > 5 && !callData.statsApplied && uniqueParticipants.length === 2;

        const callSessionUpdate = {
          userA: uniqueParticipants[0] || user.uid,
          userB: uniqueParticipants[1] || peerId,
          duration: secondsTalked,
          durationMinutes,
          timestamp: callData.timestamp || serverTimestamp(),
          endedAt: serverTimestamp(),
          status: 'ended',
        };

        if (!shouldApplyStats) {
          if (callData.status !== 'ended') {
            transaction.set(callRef, callSessionUpdate, { merge: true });
          }
          return;
        }

        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        const userRefs = uniqueParticipants.map((uid) => doc(db, 'users', uid));
        const userSnaps = await Promise.all(userRefs.map((userRef) => transaction.get(userRef)));

        userSnaps.forEach((userSnap, index) => {
          const participantId = uniqueParticipants[index];
          const userRef = userRefs[index];
          const userData = userSnap.data() || {};
          let streak = userData.streak || 0;

          if (userData.lastCallDate === today) {}
          else if (userData.lastCallDate === yesterday) streak += 1;
          else streak = 1;

          const updatedStats = {
            ...userData,
            callCount: (userData.callCount || 0) + 1,
            totalMinutes: (userData.totalMinutes || 0) + durationMinutes,
            streak,
            lastCallDate: today,
          };
          const badgeCallData = {
            duration: secondsTalked,
            matchTime: callData.matchTimeSeconds || callData.matchTime || 999,
            hour: new Date().getHours(),
          };
          const newBadges = checkNewBadges(updatedStats, badgeCallData);
          const rewardResult = applyBadgeRewardsToData(updatedStats, newBadges);

          transaction.set(userRef, {
            callCount: updatedStats.callCount,
            totalMinutes: updatedStats.totalMinutes,
            streak: updatedStats.streak,
            lastCallDate: updatedStats.lastCallDate,
            ...(newBadges.length > 0 ? rewardResult.updates : {}),
            ...(newBadges.length > 0 ? { badgeUpdatedAt: serverTimestamp() } : {}),
          }, { merge: true });

          if (participantId === user.uid && newBadges.length > 0) {
            currentUserUnlocks = newBadges.map((badgeId, badgeIndex) => ({
              badge: badgeId,
              rewardMessage: rewardResult.rewardMessages[badgeIndex] || '',
              bonusMinutes: rewardResult.updates.bonusMinutes,
            }));
          }
        });

        transaction.set(callRef, {
          ...callSessionUpdate,
          statsApplied: true,
          statsAppliedAt: serverTimestamp(),
        }, { merge: true });
      });

      if (currentUserUnlocks.length > 0) {
        const [firstUnlock, ...remainingUnlocks] = currentUserUnlocks;
        setNewBadge(firstUnlock.badge);
        setNewBadgeReward(firstUnlock.rewardMessage);
        setBadgeQueue(remainingUnlocks);
        if (typeof firstUnlock.bonusMinutes === 'number') {
          setBonusMinutes(firstUnlock.bonusMinutes);
        }
      }

      if (secondsTalked >= 180) setShowRating(true);


    } catch (e) {
      console.error('[Chat] endCall error:', e);
    } finally {
      endingRef.current = false;
    }
  }, [callDocId, peerId, user]);

  endCallRef.current = endCall;

  const submitRating = async (stars) => {
    try {
      await runTransaction(db, async (transaction) => {
        const peerRef = doc(db, 'users', peerId);
        const peerDoc = await transaction.get(peerRef);
        if (!peerDoc.exists()) return;

        const peerData = peerDoc.data();
        const updatedPeerData = {
          ...peerData,
          rating: (peerData.rating || 0) + stars,
          ratingCount: (peerData.ratingCount || 0) + 1,
          ...(stars === 5 ? { receivedFiveStar: true } : {}),
        };
        const newBadges = checkNewBadges(updatedPeerData);
        const rewardResult = applyBadgeRewardsToData(updatedPeerData, newBadges);

        transaction.set(peerRef, {
          rating: updatedPeerData.rating,
          ratingCount: updatedPeerData.ratingCount,
          ...(stars === 5 ? { receivedFiveStar: true } : {}),
          ...(newBadges.length > 0 ? rewardResult.updates : {}),
          ...(newBadges.length > 0 ? { badgeUpdatedAt: serverTimestamp() } : {}),
        }, { merge: true });
      });
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
    if (!text.trim() || !user.uid || !chatId || !peerId) return;
    const messageText = text.trim();
    const senderName = user.displayName || user.name || 'User';
    setText('');

    try {
      await setDoc(doc(db, 'chats', chatId), {
        participants: [user.uid, peerId].sort(),
        updatedAt: serverTimestamp(),
        lastMessage: messageText,
        lastSenderId: user.uid,
      }, { merge: true });
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: messageText,
        senderId: user.uid,
        senderName,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[Chat] sendMessage error:', error);
      setText(messageText);
    }
  };

  return (
    <div className="chat-page">
      <BadgeUnlockModal
        badge={newBadge}
        rewardMessage={newBadgeReward}
        onClose={() => {
          setBadgeQueue((queue) => {
            const [nextUnlock, ...rest] = queue;
            if (nextUnlock) {
              setNewBadge(nextUnlock.badge);
              setNewBadgeReward(nextUnlock.rewardMessage);
              if (typeof nextUnlock.bonusMinutes === 'number') {
                setBonusMinutes(nextUnlock.bonusMinutes);
              }
              return rest;
            }

            setNewBadge(null);
            setNewBadgeReward('');
            return [];
          });
        }}
      />

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
                joinedRef.current = false;
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
          {inCall && !user.isPremium && (
            <div style={{
              marginTop: '8px',
              color: callSeconds > 780 ? '#ef4444' : '#f59e0b',
              fontSize: '13px', fontWeight: 600,
            }}>
              ⏰ {formatTime(Math.max(0, freeCallLimitSeconds - callSeconds))} qaldı
              {callSeconds > 780 && ' — Premium al!'}
            </div>
          )}
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
        {messages.length === 0 ? (
          <div className="chat-empty-hint">
            <p>👋 Say hello and start practicing!</p>
          </div>
        ) : (
          messages.map(m => (
            <div key={m.id} className={`message ${m.senderId === user.uid ? 'mine' : 'theirs'}`}>
              {m.senderId !== user.uid && <span className="message-sender">{m.senderName}</span>}
              <p>{m.text}</p>
            </div>
          ))
        )}
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

      {showInsights && (
        <CallInsights
          userId={user.uid}
          channelName={callDocId}
          onClose={() => { setShowInsights(false); navigate('/'); }}
        />
      )}
    </div>
  );
}
