import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  collection, addDoc, onSnapshot,
  query, orderBy, limitToLast, serverTimestamp,
  doc, getDoc, setDoc, updateDoc, runTransaction, increment
} from 'firebase/firestore';
import { db } from '../firebase';
import AgoraRTC from 'agora-rtc-sdk-ng';
import {
  BookOpen, MessageCircleQuestion, Image as ImageIcon, Drama, MessagesSquare, Target,
  Mic, MicOff, PhoneOff, Clock, X, Check, Trash2, Send, Phone, Calendar,
  BookMarked, Lightbulb, FileText, ChevronRight,
} from 'lucide-react';
import { getTodayContent, getTodayIndex, getContentByIndex } from '../data/weeklyContent';
import GuidedTour from '../components/GuidedTour';
import PremiumBadge from '../components/PremiumBadge';
import TutorBadge from '../components/TutorBadge';
import { BadgeUnlockModal } from '../components/BadgeSystem';
import { checkNewBadges } from '../badges/checker';
import { applyBadgeRewardsToData } from '../badges/rewards';
import { authedFetch } from '../api';
import { FUNCTIONS_BASE } from '../constants';
import { startLocalRecording, addRemoteStream, stopLocalRecording } from '../utils/localRecorder';
import { uploadCallRecording } from '../utils/recordingUpload';
import { enqueueCallAnalysis } from '../utils/analysisQueue';
import { setInCallFlag, isInCall } from '../utils/presence';
import { markChatRead, deleteMessage, touchChat } from '../utils/chat';
import { getWeekKey } from '../utils/ranking';
import TranslateWidget from '../components/TranslateWidget';
import CallImageStage from '../components/CallImageStage';
import CallTabooStage from '../components/CallTabooStage';
import CallQuestionStage from '../components/CallQuestionStage';
import CallDebateStage from '../components/CallDebateStage';
import CallGuessStage from '../components/CallGuessStage';
import AvatarImage from '../components/ui/AvatarImage';
import { tabooWords } from '../data/tabooWords';
import { debateTopics } from '../data/debateTopics';
import { guessQuestions } from '../data/guessQuestions';
import { GUESS_ROUND_SECONDS } from '../utils/guessGame';
import PostCallQuizModal from '../components/PostCallQuizModal';
import CallRoadmap from '../components/CallRoadmap';
import CallInsights from '../components/CallInsights';
import { Capacitor } from '@capacitor/core';

const CHAT_TOUR_STEPS = [
  {
    target: '#tour-translate',
    title: 'Live Translate',
    content: 'Use this button to translate a word or sentence instantly during a call.',
    disableBeacon: true,
  }
];


const APP_ID = process.env.REACT_APP_AGORA_APP_ID;
const TOKEN_URL = `${FUNCTIONS_BASE}/getAgoraToken`;

// Ceiling for the authoritative (timestamp-derived) call length written to
// leaderboard stats. Mirrors the server's CALL_CAP_SECONDS so a pathological
// start timestamp can never inflate a user's minutes.
const AUTHORITATIVE_CALL_CAP_SECONDS = 60 * 60;

export default function Chat({ user }) {
  const { peerId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const audioBlobRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [peer, setPeer] = useState(null);
  const [inCall, setInCall] = useState(false);
  const [muted, setMuted] = useState(false);
  const [callStatus, setCallStatus] = useState('');
  // Kanalda tək olub-olmadığımız. Randevu ilə gələn zənglərdə kanalın ÖZÜ
  // gözləmə otağıdır: birinci gələn qoşulub gözləyir, ikinci gələn kimi səs
  // açılır. Ayrıca "rendezvous" maşını qurmağa ehtiyac qalmır.
  const [peerJoined, setPeerJoined] = useState(false);
  // Toxunulmuş öz mesajım — silmə düyməsi yalnız onun altında görünür.
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [callSeconds, setCallSeconds] = useState(0);
  // Limitə 1 dəq qalmış görünən keçici xəbərdarlıq banneri.
  const [timeWarning, setTimeWarning] = useState(false);
  const [showDaily, setShowDaily] = useState(false);
  const [imageStage, setImageStage] = useState(null);
  const [tabooStage, setTabooStage] = useState(null);
  const [questionStage, setQuestionStage] = useState(null);
  const [debateStage, setDebateStage] = useState(null);
  const [guessStage, setGuessStage] = useState(null);
  // One activity at a time owns the call screen. Every launcher button used to
  // repeat this list inline, which meant adding a game meant editing five
  // conditions and forgetting one.
  const activityOpen = !!(imageStage?.active || tabooStage?.active
    || questionStage?.active || debateStage?.active || guessStage?.active);
  // Any full-screen panel, activities plus the vocabulary sheet.
  const stageOpen = activityOpen || showDaily;
  // Starting an activity has to switch the other four off in the SAME write,
  // or a peer mid-render can briefly see two panels. Spelling the list out at
  // each call site meant five places to forget a stage; this derives it.
  const ACTIVITY_STAGES = ['imageStage', 'tabooStage', 'questionStage', 'debateStage', 'guessStage'];
  const closeActivitiesExcept = (keep) => Object.fromEntries(
    ACTIVITY_STAGES.filter((k) => k !== keep).map((k) => [`${k}.active`, false]),
  );
  // The post-call flow is a queue of full-screen stages. Normally it holds just
  // 'insights' (the single summary screen); 'quiz' is pushed only when the user
  // asks for it from that screen.
  const [postCallStages, setPostCallStages] = useState([]);
  // Whether this call was long enough (3+ min) for the inline rating block.
  const [ratingEligible, setRatingEligible] = useState(false);
  const [dailyTab, setDailyTab] = useState('vocabulary');
  const [flipped, setFlipped] = useState({});
  const [incomingCallData, setIncomingCallData] = useState(null);
  const [newBadge, setNewBadge] = useState(null);
  const [callTranslations, setCallTranslations] = useState([]);
  const [showRoadmap, setShowRoadmap] = useState(false);
  // True when the recording never made it into the queue, so no result is coming.
  const [enqueueFailed, setEnqueueFailed] = useState(false);
  const [newBadgeReward, setNewBadgeReward] = useState('');
  const [, setBadgeQueue] = useState([]);

  const postCallStage = postCallStages[0] || null;
  const advancePostCall = useCallback(() => setPostCallStages((stages) => stages.slice(1)), []);

  // endCall reads this after the call has ended, so it must not re-create the
  // callback (and its cleanup timers) on every translated word.
  const callTranslationsRef = useRef([]);
  callTranslationsRef.current = callTranslations;

  const joinPromiseRef = useRef(null);

  const safeJoin = async (client, ...args) => {
    if (joinPromiseRef.current) await joinPromiseRef.current.catch(() => {});
    joinPromiseRef.current = client.join(...args);
    try {
      return await joinPromiseRef.current;
    } finally {
      joinPromiseRef.current = null;
    }
  };

  const safeLeave = async (client) => {
    if (joinPromiseRef.current) await joinPromiseRef.current.catch(() => {});
    return client.leave();
  };

  const callSecondsRef = useRef(0);
  // Zəngin divar-saatı başlanğıcı — müddət bundan hesablanır (bax timer effekti).
  const callStartedAtRef = useRef(0);
  const warnedRef = useRef(false);
  const endCallRef = useRef(null);
  // Rədd edilmiş zəngin təmizliyi. Ref-dir, çünki onu iki yerdən — sənədin
  // SİLİNMƏSİ və status:'rejected' — çağırmaq lazımdır, ikisi də böyük
  // snapshot effektinin içindədir.
  const declinedRef = useRef(null);
  // Eyni zəng üçün iki dəfə işləməsin (silinmə + status dəyişikliyi üst-üstə
  // düşə bilər). Hər yeni zəngdə startCall sıfırlayır.
  const declineHandledRef = useRef(false);
  const clientRef = useRef(null);
  const localTrackRef = useRef(null);  // mic track — created on user gesture
  const bottomRef = useRef(null);
  const joinedRef = useRef(false);
  // Birbaşa zəngin bir dəfə işə düşməsi üçün. `location.key` dəyişdikcə effekt
  // təkrar qiymətləndirilir, bu ref isə eyni naviqasiyada ikinci zəngi saxlayır.
  const autoCalledRef = useRef(false);
  const endingRef = useRef(false);
  const ringtoneRef = useRef(null);
  const timerRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const prevCallStatus = useRef('');
  const sessionIdRef = useRef(Date.now());
  
  const recognitionRef = useRef(null);
  const inCallRef = useRef(false);

  const stateCallId = location.state?.callId;
  const slotId = location.state?.slotId || null;
  const isMatchedCall = location.state?.matchedCall === true;
  const chatId = [user.uid, peerId].sort().join('_');
  const callDocId = stateCallId || `call_${chatId}`;
  const content = getTodayContent();
  
  // Hard cap on call length. Agora bills per participant-minute, so this is
  // the single biggest lever on running cost. 1 saatlıq yazı üçün MediaRecorder
  // bitrate-i localRecorder.js-də AÇIQ təyin olunub (32 kbps ≈ 14 MB/saat) —
  // brauzerin default bitrate-i ilə 1 saat Storage limitini keçib yükləməni
  // sındırırdı. Analiz tavanı 1800 saniyədir (ANALYSIS_MAX_SECONDS) və yazıdan
  // sükut kəsildiyi üçün uzun zəngdə belə tavana nadir hallarda çatılır.
  // Serverdəki CALL_CAP_SECONDS ilə sinxron saxla.
  let maxCallSeconds = 60 * 60;

  const chatIdRef = useRef(chatId);
  const callDocIdRef = useRef(callDocId);
  const peerIdRef = useRef(peerId);
  const userUidRef = useRef(user.uid);
  chatIdRef.current = chatId;
  callDocIdRef.current = callDocId;
  peerIdRef.current = peerId;
  userUidRef.current = user.uid;

  useEffect(() => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1361/1361-preview.mp3');
    audio.loop = true;
    ringtoneRef.current = audio;
    return () => { audio.pause(); };
  }, []);

  // Unmount safety net: if the user navigates away mid-call, stop the mic,
  // stop the recorder and leave the Agora channel so nothing keeps running.
  useEffect(() => {
    return () => {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      // Navigating away is not endCall(), so the busy flag has to be cleared
      // here too — otherwise the user stays "Zəngdə" for the rest of the
      // session and the App-level presence writer keeps skipping status.
      //
      // Şərt `inCallRef` DEYİL, `isInCall()`-dur. inCallRef yalnız zəng
      // QOŞULANDA true olur, halbuki busy statusu artıq ilk zəng siqnalında
      // yazılır — yəni çalarkən səhifəni tərk edən adam sessiyanın sonuna
      // qədər "In a call" qalırdı. Doğru sual "qoşulmuşam?" yox, "özümü busy
      // elan etmişəm?"dir, o da elə bu bayraqdır.
      if (isInCall()) {
        inCallRef.current = false;
        setInCallFlag(false);
        updateDoc(doc(db, 'users', userUidRef.current), { status: 'online' }).catch(() => {});
      }
      stopLocalRecording();
      if (localTrackRef.current) {
        try { localTrackRef.current.stop(); localTrackRef.current.close(); } catch (e) {}
        localTrackRef.current = null;
      }
      if (clientRef.current) {
        try { clientRef.current.leave(); } catch (e) {}
        clientRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    getDoc(doc(db, 'users', peerId)).then(d => {
      if (d.exists()) setPeer(d.data());
    });
  }, [peerId]);

  useEffect(() => {
    if (!chatId || !user.uid || !peerId) return;
    // Çat sənədi BURADA YARADILMIR. Əvvəl sadəcə birinin profilinə girmək
    // sənəd yaradırdı və söhbətlər siyahısı "Hələ mesaj yoxdur" kabus sətirləri
    // ilə dolurdu. Sənəd yalnız ilk mesajla yaranır (sendMessage → touchChat).
    //
    // Açılış = oxundu: öz oxunmamış sayğacımı sıfırlayıram. Rules qarşı
    // tərəfinkinə toxunmağa icazə vermir.
    markChatRead(chatId, user.uid);

    // Unbounded, this re-read every message in the thread on every mount and
    // streamed the whole history to each participant.
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limitToLast(200)
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs
        .map((d) => {
          const data = d.data();
          return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.() || null };
        })
        .sort((a, b) => {
          if (a.createdAt && b.createdAt) return a.createdAt - b.createdAt;
          if (a.createdAt) return -1;
          if (b.createdAt) return 1;
          return 0;
        });
      setMessages(msgs);
      setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 50);
    }, console.error);
    return unsub;
  }, [chatId, user.uid, peerId]);

  // ─────────────────────────────────────────────────────────────
  // joinCall — mic track already created on user gesture,
  // just fetch token → join → publish existing track
  // ─────────────────────────────────────────────────────────────
  const joinCall = useCallback(async () => {
    const cId = chatIdRef.current;

    ringtoneRef.current?.pause();

    try {
      // Clean up previous client if any
      if (clientRef.current) {
        try { await safeLeave(clientRef.current); } catch (e) {}
        clientRef.current = null;
      }

      // Fetch token (no mic permission needed here)
      const tokenRes = await authedFetch(TOKEN_URL, {
        method: 'POST',
        body: JSON.stringify({ channelName: cId }),
      });
      if (!tokenRes.ok) throw new Error('Token error: ' + tokenRes.status);
      const tokenData = await tokenRes.json();
      if (!tokenData.token) throw new Error('No token');

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;

      client.on('user-published', async (remoteUser, mediaType) => {
        try {
          await client.subscribe(remoteUser, mediaType);
          if (mediaType === 'audio') {
            remoteUser.audioTrack.setPlaybackDevice('default').catch(() => {});
            remoteUser.audioTrack.play();
            // Add remote audio to recording
            addRemoteStream(remoteUser.audioTrack);
            setCallStatus('connected');
            setPeerJoined(true);
          }
        } catch (e) { console.error('[Chat] Subscribe error:', e); }
      });

      client.on('user-unpublished', () => setCallStatus('left'));

      // Reverting to null. Do NOT use string uid because the backend token is generated for integers (0).
      // Agora will auto-generate unique IDs for both users automatically.
      await safeJoin(client, APP_ID, cId, tokenData.token, null);

      // If mic track was pre-created on user gesture, use it.
      // If not (matched call / receiver path), create it now.
      if (!localTrackRef.current) {
        localTrackRef.current = await AgoraRTC.createMicrophoneAudioTrack();
      }

      await client.publish(localTrackRef.current);

      // Start recording both sides
      startLocalRecording(localTrackRef.current);

      setInCall(true);
      inCallRef.current = true;
      setCallStatus('connected');
      joinedRef.current = true;

      // Randevu ilə gəlmişiksə, gəlişimizi slot üzvlüyünə yazırıq. Bu, no-show
      // xatırlatmasının YEGANƏ siqnalıdır: planlaşdırıcı start+10dəq-də biri
      // gəlib digəri gəlməyibsə nəzakətli mesaj qoyur. Rules bu sənəddə yalnız
      // `arrivedAt` sahəsinə icazə verir.
      if (slotId) {
        setDoc(
          doc(db, 'practiceSlots', slotId, 'members', user.uid),
          { arrivedAt: serverTimestamp() },
          { merge: true },
        ).catch((e) => console.warn('[Chat] arrivedAt not written:', e.message));
      }
      // The "how to start" roadmap is only useful for newcomers. Show it for a
      // user's first few calls, then never again — surfacing it on every call
      // is just noise for experienced users. Counter is per-device (localStorage).
      try {
        const ROADMAP_MAX_SHOWS = 3;
        const seen = parseInt(localStorage.getItem('callRoadmapShows_v1') || '0', 10) || 0;
        if (seen < ROADMAP_MAX_SHOWS) {
          setShowRoadmap(true);
          localStorage.setItem('callRoadmapShows_v1', String(seen + 1));
        }
      } catch (e) {
        // localStorage unavailable (private mode) — fall back to showing it.
        setShowRoadmap(true);
      }
      
      // [PROMOTION MVP] Disabled all background speech transcription
      /*
      if (Capacitor.isNativePlatform()) {
        try {
          const hasPerm = await SpeechRecognition.checkPermissions();
          if (hasPerm.speechRecognition !== 'granted') {
            await SpeechRecognition.requestPermissions();
          }
          
          SpeechRecognition.addListener('partialResults', (data) => {
            if (data.matches && data.matches.length > 0) {
              callTranscriptRef.current += data.matches[0] + ' ';
            }
          });

          await SpeechRecognition.start({
            language: 'en-US',
            maxResults: 10,
            prompt: 'Listening...',
            partialResults: true,
            popup: false,
          });
        } catch(err) {
          console.error('[Chat] Native SpeechRecognition error', err);
        }
      } else {
        const WebSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (WebSpeechRecognition) {
          try {
            recognitionRef.current = new WebSpeechRecognition();
            recognitionRef.current.lang = 'en-US';
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = false;
            
            recognitionRef.current.onresult = (event) => {
              let finalTranscript = '';
              for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                  finalTranscript += event.results[i][0].transcript + ' ';
                }
              }
              callTranscriptRef.current += finalTranscript;
            };

            recognitionRef.current.start();
          } catch(err) {
            console.error('[Chat] Web SpeechRecognition start error', err);
          }
        }
      }
      */

      // Mark as busy so the online list shows "Zəngdə" instead of available.
      setInCallFlag(true);
      try {
        await updateDoc(doc(db, 'users', userUidRef.current), { status: 'busy' });
      } catch (e) {}

    } catch (err) {
      setInCallFlag(false);
      console.error('[Chat] joinCall error:', err);
      joinedRef.current = false;
      if (localTrackRef.current) {
        try { localTrackRef.current.stop(); localTrackRef.current.close(); } catch (e) {}
        localTrackRef.current = null;
      }
      if (clientRef.current) {
        try { await safeLeave(clientRef.current); } catch (e) {}
        clientRef.current = null;
      }
      setCallStatus('error');
      
      try {
        await updateDoc(doc(db, 'users', userUidRef.current), { status: 'online' });
      } catch (e) {}
    }
  }, [slotId, user.uid]);

  // Location state — zəng qəbul ediləndən sonra qoşulma.
  //
  // DEPS-LƏR KRİTİKDİR (əvvəl `[]` idi və bu, ƏSL BUG İDİ):
  // GlobalCallListener qəbul edəndə `navigate('/chat/<caller>', {acceptedCall:true})`
  // çağırır. İstifadəçi ARTIQ hər hansı bir `/chat/:peerId` səhifəsindədirsə,
  // React Router eyni route pattern-i üçün komponenti YENİDƏN MOUNT ETMİR —
  // yalnız params/state dəyişir. Boş deps ilə effekt təkrar işləmirdi, deməli
  // joinCall() heç vaxt çağırılmırdı: istifadəçi zəngi qəbul edir, amma zəng
  // ekranı açılmır və söhbət səhifəsində ilişib qalırdı (istifadəçi şikayəti:
  // "cavabla deyirik, amma zəng səhifəsinə keçmir, sohbette kalıyor").
  // `location.key` hər naviqasiyada — eyni ünvana belə — dəyişir, ona görə
  // qəbul hər dəfə etibarlı şəkildə tutulur. `joinedRef` ikiqat qoşulmanı saxlayır.
  useEffect(() => {
    if (location.state?.acceptedCall && !joinedRef.current) {
      joinedRef.current = true;
      const delay = isMatchedCall ? (user.uid < peerId ? 0 : 1200) : 0;
      const timer = setTimeout(() => { joinCall(); }, delay);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, location.state?.acceptedCall, peerId]);

  // "Birbaşa zəng et": Live siyahısındakı və ya profildəki zəng düyməsi bura
  // `autoCall` ilə gətirir və zəng özü başlayır. Əvvəl adama zəng etmək üçün
  // kart → profil → Söhbət → Zəng lazım idi — DÖRD toxunuş, halbuki tətbiqin
  // bütün mənası danışmaqdır.
  //
  // Deps-də `location.key` MÜTLƏQDİR, `acceptedCall`-dakı ilə eyni səbəbdən:
  // istifadəçi artıq hər hansı /chat/:peerId səhifəsindədirsə Router komponenti
  // yenidən mount etmir, boş deps ilə effekt bir daha işləməzdi.
  //
  // QEYD: startCall() mikrofon trekini yaradır və burada istifadəçi jesti
  // kontekstindən KƏNARDA çağırılır. Chrome/Android-də (əsas platforma) icazə
  // bir dəfə verilib saxlanıldığı üçün problem yoxdur; bloklansa startCall öz
  // catch-i ilə `error` vəziyyətinə düşür və istifadəçi söhbətdə qalır, adi
  // "Zəng" düyməsi yerində olur — yəni ən pis halda köhnə davranış.
  useEffect(() => {
    if (!location.state?.autoCall || autoCalledRef.current) return;
    // Boş `callStatus` = heç nə baş vermir. Dolu olsa (calling/connected/ended)
    // zəng onsuz da gedir, üstünə ikincisini açmaq olmaz.
    if (joinedRef.current || callStatus) return;
    autoCalledRef.current = true;
    // Bayraq DƏRHAL tarixçədən silinir. `autoCall` history entry-sində qalsaydı,
    // istifadəçi zəngi bitirib başqa səhifəyə keçəndən sonra GERİ düyməsi ilə
    // bu entry-yə qayıtdıqda komponent təzədən mount olur, `autoCalledRef`
    // sıfırlanır və adama xəbərsiz İKİNCİ zəng gedərdi. replace: true yeni
    // yazı yaratmır, mövcud entry-ni əvəz edir; qalan state (callId, slotId,
    // matchedCall) olduğu kimi saxlanılır.
    navigate(location.pathname, { replace: true, state: { ...location.state, autoCall: false } });
    startCall();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, location.state?.autoCall, peerId]);

  useEffect(() => {
    if (!isMatchedCall || !stateCallId) return;
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

  // Qarşı tərəf zəngi RƏDD EDƏNDƏ zəng edənin geri qaytarmalı olduğu HƏR ŞEY.
  //
  // İki fərqli rədd yolu var və ikisi də buraya gəlməlidir:
  //   • GlobalCallListener.rejectCall — zəng sənədini SİLİR (status yazmır),
  //     yəni aşağıdakı `status === 'rejected'` budağı heç vaxt işə düşmür;
  //   • söhbətin öz modalı — `status: 'rejected'` yazır.
  // Əvvəl silinmə budağı yalnız ekrana "Declined" yazırdı və başqa heç nə
  // etmirdi, ona görə zəng edən tərəf sözün əsl mənasında xətdə qalırdı:
  //   1) 30 saniyəlik taymer ləğv edilmirdi → yarım dəqiqə sonra rədd edilmiş
  //      adama yalan "No answer." xəbərdarlığı çıxırdı;
  //   2) mikrofon treki bağlanmırdı → telefonda mikrofon açıq qalırdı;
  //   3) `status: 'busy'` geri qaytarılmırdı → istifadəçi hamıya "In a call"
  //      görünürdü, halbuki zəng heç başlamamışdı;
  //   4) `setInCallFlag(false)` çağırılmırdı → App.js heartbeat-i də bunu
  //      düzəldə bilmirdi, çünki o, isInCall() true olanda status yazmır.
  // (3) və (4) məhz mənim "ilk zəngdən busy yaz" dəyişikliyimin nəticəsidir —
  // yeni yazı əlavə edib onu təmizləyən bütün yolları yoxlamamışdım.
  //
  // endCall() çağırmıram: o, statistika, yazının yüklənməsi və reytinq axını
  // üçündür. Qoşulmamış zəngdə bunların heç birinin işi yoxdur.
  declinedRef.current = async () => {
    if (declineHandledRef.current) return;
    declineHandledRef.current = true;

    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    ringtoneRef.current?.pause();
    if (localTrackRef.current) {
      try { localTrackRef.current.stop(); localTrackRef.current.close(); } catch (e) {}
      localTrackRef.current = null;
    }
    setInCallFlag(false);
    try {
      await updateDoc(doc(db, 'users', userUidRef.current), { status: 'online' });
    } catch (e) { /* presence is best-effort */ }

    setCallStatus('rejected');
    setTimeout(() => setCallStatus(''), 3000);
  };

  // Firestore call listener
  useEffect(() => {
    if (!callDocId || !user.uid || !peerId) return;

    const unsub = onSnapshot(doc(db, 'calls', callDocId), (snap) => {
      if (!snap.exists()) {
        // Sənədin yoxa çıxması = qarşı tərəf "Decline" basdı (rejectCall onu
        // silir). Tam təmizlik, sadəcə etiket yox.
        if (prevCallStatus.current === 'calling') {
          declinedRef.current?.();
        }
        setIncomingCallData(null);
        prevCallStatus.current = '';
        return;
      }

      const data = snap.data();
      const prevStatus = prevCallStatus.current;
      prevCallStatus.current = data.status;

      // Synced picture stage: either side writes it, both render it.
      setImageStage(data.imageStage || null);

      // Synced Taboo game: same channel, but explainerUid decides which half
      // of the UI each peer gets.
      setTabooStage(data.tabooStage || null);

      // Synced speaking cards: difficulty, deck and the open card all live in
      // the doc, so neither peer can end up looking at a different question.
      setQuestionStage(data.questionStage || null);

      // Synced Debate game: same channel, but sideAUid decides which side's
      // talking points each peer gets — same split as Taboo's explainerUid.
      setDebateStage(data.debateStage || null);

      // Synced Guess It: both peers see the same card and the same deadline,
      // and each writes only their own guess into `answers`.
      setGuessStage(data.guessStage || null);

      // Incoming call for receiver
      if (data.callerId === peerId && data.status === 'calling') {
        setIncomingCallData(data);
      }

      // CALLER side: receiver accepted → join now
      // Mic track was already created in startCall (user gesture),
      // so joinCall can safely run from Firestore snapshot here
      if (data.status === 'accepted' && data.callerId === user.uid && prevStatus !== 'accepted') {
        if (!joinedRef.current) {
          joinedRef.current = true;
          setIncomingCallData(null);
          ringtoneRef.current?.pause();
          joinCall();
        }
      }

      // Söhbətin öz modalından gələn rədd. Eyni təmizlik: bu budaq da taymeri
      // ləğv etmirdi və busy statusunu geri qaytarmırdı.
      if (data.status === 'rejected' && data.callerId === user.uid) {
        declinedRef.current?.();
      }

      if (data.status === 'ended') {
        ringtoneRef.current?.pause();
        setIncomingCallData(null);
        endCallRef.current?.();
      }
    }, (e) => {
      // A listener on a document that gets deleted mid-call must not throw.
      // The rule now guards `resource != null`, but the network can fail too,
      // and an unhandled listener error surfaces as an uncaught FirebaseError
      // in the console with nothing on screen to explain it.
      console.warn('[call] listener stopped:', e.code || e.message);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callDocId, user.uid, peerId]);

  useEffect(() => {
    if (inCall) {
      // KRİTİK: müddət tick SAYMAQLA hesablanmır, divar saatından çıxarılır.
      //
      // Əvvəl `callSecondsRef.current += 1` idi. Brauzer arxa fonda
      // setInterval-ı boğur (mobil: ekran sönəndə və ya başqa tətbiqə
      // keçəndə tick-lər dayana bilər) — telefonu qulağına tutan istifadəçi
      // üçün bu, normal haldır. Nəticədə 30 dəqiqəlik zəng ~80 tick yığırdı
      // və hər yerə "1 dəq 20 san" kimi düşürdü: ekrandakı saymac, 1 saatlıq
      // limit (heç vaxt işə düşmürdü) və analizin audioSeconds sahəsi
      // (müəllim panelində yanlış müddət + şişirdilmiş danışıq sürəti).
      //
      // Date.now() boğulmur, ona görə tick-lər geciksə də dəyər düzgün qalır.
      const startedAt = Date.now();
      callStartedAtRef.current = startedAt;
      warnedRef.current = false;
      setCallSeconds(0);
      callSecondsRef.current = 0;

      timerRef.current = setInterval(() => {
        const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
        callSecondsRef.current = elapsed;
        setCallSeconds(elapsed);

        // Limitə 1 dəqiqə qalmış bloklamayan xəbərdarlıq. Bərabərlik yox,
        // ARALIQ yoxlanılır: boğulmuş tick dəqiq saniyəni atlaya bilər.
        if (maxCallSeconds !== Infinity && !warnedRef.current
          && elapsed >= maxCallSeconds - 60 && elapsed < maxCallSeconds) {
          warnedRef.current = true;
          setTimeWarning(true);
          setTimeout(() => setTimeWarning(false), 10000);
        }
        if (maxCallSeconds !== Infinity && elapsed >= maxCallSeconds) {
          // endCall is async and alert() blocks — without this the interval
          // keeps firing and stacks one alert per second.
          clearInterval(timerRef.current);
          endCallRef.current?.();
          alert('Time is up for this call. Start a new one to keep going.');
        }
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setCallSeconds(0);
    }
    return () => clearInterval(timerRef.current);
  }, [maxCallSeconds, inCall]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  // ─────────────────────────────────────────────────────────────
  // startCall — called on user gesture ("Call" button tap)
  // Pre-create mic track HERE so iOS/Safari grants permission
  // ─────────────────────────────────────────────────────────────
  const startCall = async () => {
    if (!user.uid || !peerId) return;
    try {
      // Yeni zəng = yeni rədd imkanı. Sıfırlanmasa, bir dəfə rədd edilmiş
      // istifadəçiyə ikinci zəngin rəddi bir daha bildirilməzdi.
      declineHandledRef.current = false;
      sessionIdRef.current = Date.now();
      // Pre-create mic track while we have user gesture context
      // This ensures iOS/Safari grants microphone permission
      if (!localTrackRef.current) {
        localTrackRef.current = await AgoraRTC.createMicrophoneAudioTrack();
      }

      // Check if peer is busy BEFORE creating the call document
      const peerSnap = await getDoc(doc(db, 'users', peerId));
      const peerData = peerSnap.data();
      if (peerData?.status === 'busy') {
        alert('That person is on another call right now.');
        if (localTrackRef.current) {
          try { localTrackRef.current.stop(); localTrackRef.current.close(); } catch (e) {}
          localTrackRef.current = null;
        }
        return;
      }

      await setDoc(doc(db, 'calls', callDocId), {
        userA: user.uid,
        userB: peerId,
        callerId: user.uid,
        callerName: user.displayName || 'User',
        receiverId: peerId,
        status: 'calling',
        createdAt: serverTimestamp(),
      });
          
      // Busy from the first ring, not from the moment they answer. joinCall
      // sets this too, but only once the call connects — so for the ~30s a
      // phone is ringing the caller was still advertised as free, and a third
      // person could ring THEM. The flag also stops the App.js heartbeat from
      // writing "online" back over this.
      setInCallFlag(true);
      try {
        await updateDoc(doc(db, 'users', user.uid), { status: 'busy' });
      } catch (e) { /* presence is best-effort; never fail a call over it */ }

      callTimeoutRef.current = setTimeout(() => {
        if (!joinedRef.current) {
          setCallStatus('rejected');
          endCallRef.current();
          alert('No answer.');
        }
      }, 30000);
      setCallStatus('calling');

      try {
        // Ring the callee via web push so they know to open the app. The server
        // resolves the caller's name and the callee's device token itself.
        await authedFetch(`${FUNCTIONS_BASE}/sendCallNotification`, {
          method: 'POST',
          body: JSON.stringify({
            callerId: user.uid,
            receiverId: peerId,
          }),
        });
      } catch (e) {}
    } catch (error) {
      console.error('[Chat] startCall error:', error);
      if (localTrackRef.current) {
        try { localTrackRef.current.stop(); localTrackRef.current.close(); } catch (e) {}
        localTrackRef.current = null;
      }
      // A call that never started must not leave the caller marked busy — they
      // would stop receiving calls and have no way to tell why. (The App.js
      // heartbeat would repair it within a minute because isInCall() is back to
      // false, but a minute of being unreachable is still a minute.)
      setInCallFlag(false);
      try {
        await updateDoc(doc(db, 'users', user.uid), { status: 'online' });
      } catch (e) { /* best-effort, as above */ }
      setCallStatus('error');
    }
  };

  const endCall = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;

    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    // Divar saatından hesablanır — boğulmuş timer-ə güvənmirik. callSeconds
    // artıq düzgündür, amma zəng interval tick-i olmadan bitsə (dərhal
    // qapatma, arxa fon) bu, yeganə etibarlı mənbədir.
    const secondsTalked = callStartedAtRef.current
      ? Math.max(0, Math.floor((Date.now() - callStartedAtRef.current) / 1000))
      : callSecondsRef.current;

    // Stop recording; only calls of at least 2 MINUTES get analyzed. Shorter
    // calls carry too little speech to score usefully and just burn STT/LLM
    // cost, so we neither upload, queue, nor notify for them (no ticket ⇒ the
    // worker never runs ⇒ no "analysis ready" push either).
    const MIN_ANALYSIS_SECONDS = 120; // 2 dəqiqə
    const { blob: recordingBlob, voicedSeconds } = await stopLocalRecording();
    if (recordingBlob && secondsTalked >= MIN_ANALYSIS_SECONDS) {
      audioBlobRef.current = recordingBlob;
      const sessionId = sessionIdRef.current;
      console.log('[Chat] Recording stored, size:', recordingBlob.size, 'voiced:', voicedSeconds);
      setEnqueueFailed(false);
      uploadCallRecording(recordingBlob, user.uid, callDocId, sessionId)
        .then((storagePath) => enqueueCallAnalysis({
          uid: user.uid,
          callDocId,
          sessionId,
          storagePath,
          // Sükut kəsildiyi üçün faylın uzunluğu artıq zəngin uzunluğu deyil.
          // audioSeconds FAYLI təsvir etməlidir (serverin bayt-prefiks düsturu
          // ona bölür), callSeconds isə istifadəçiyə göstərilən zəng müddətidir.
          audioSeconds: voicedSeconds > 0 ? voicedSeconds : secondsTalked,
          callSeconds: secondsTalked,
          peerName: peer?.name || null,
        }))
        .catch((e) => {
          // Nothing was queued, so no worker will ever write a result and no
          // push will arrive. Say so instead of leaving the insights screen
          // spinning on "queued" forever.
          console.error('[Chat] Recording upload/enqueue failed:', e);
          setEnqueueFailed(true);
        });
    }

    try {
      if (localTrackRef.current) {
        try { localTrackRef.current.stop(); localTrackRef.current.close(); } catch (e) {}
        localTrackRef.current = null;
      }
      if (clientRef.current) {
        try { await safeLeave(clientRef.current); } catch (e) {}
        clientRef.current = null;
      }
    } catch (e) {}

    setInCall(false);
    inCallRef.current = false;
    
    if (Capacitor.isNativePlatform()) {
      // try { await SpeechRecognition.stop(); } catch(e) {}
    } else {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
        recognitionRef.current = null;
      }
    }
    
    setCallStatus('');
    setMuted(false);
    setShowRoadmap(false);
    joinedRef.current = false;
    ringtoneRef.current?.pause();

    // Mark as online again — free to be called.
    setInCallFlag(false);
    try {
      await updateDoc(doc(db, 'users', userUidRef.current), { status: 'online' });
    } catch (e) {}

    try {
      let currentUserUnlocks = [];

      const callDocSnap = await getDoc(doc(db, 'calls', callDocId)).catch(() => null);
      if (!callDocSnap?.exists()) {
        endingRef.current = false;
        return;
      }

      await runTransaction(db, async (transaction) => {
        const callRef = doc(db, 'calls', callDocId);
        const callSnap = await transaction.get(callRef);
        if (!callSnap.exists()) return;

        const callData = callSnap.data() || {};
        const participantSet = new Set([
          callData.userA, callData.userB,
          callData.callerId, callData.receiverId,
          user.uid, peerId,
        ].filter(Boolean));
        const uniqueParticipants = Array.from(participantSet).slice(0, 2);

        // Authoritative call length — shared by BOTH participants so their
        // leaderboard stats can never diverge. It is derived from the call's own
        // start timestamp, NOT from each client's local stopwatch
        // (callSecondsRef): that stopwatch stops only when this client's own
        // endCall runs, so when the "ended" signal is slow to reach the peer
        // (mobile backgrounded, network drop, Agora drop) the peer keeps
        // counting and records ~2x the minutes — the 40-vs-20 leaderboard bug.
        // The first participant to end computes the value and pins it on the
        // call doc; the second reuses the stored value verbatim.
        const startMs = callData.matchedAt?.toMillis?.()
          || callData.createdAt?.toMillis?.()
          || callData.timestamp?.toMillis?.()
          || null;
        let durationSeconds;
        if (typeof callData.authoritativeDurationSec === 'number') {
          durationSeconds = callData.authoritativeDurationSec;
        } else if (startMs) {
          durationSeconds = Math.min(
            Math.max(0, Math.floor((Date.now() - startMs) / 1000)),
            AUTHORITATIVE_CALL_CAP_SECONDS,
          );
        } else {
          durationSeconds = secondsTalked; // legacy calls with no start timestamp
        }
        const durationMinutes = Math.ceil(durationSeconds / 60);
        const shouldApplyStats = durationSeconds > 5 && !callData[`statsApplied_${user.uid}`] && uniqueParticipants.length === 2;

        const callSessionUpdate = {
          userA: uniqueParticipants[0] || user.uid,
          userB: uniqueParticipants[1] || peerId,
          duration: durationSeconds,
          durationMinutes,
          authoritativeDurationSec: durationSeconds, // pin so the peer reuses it
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
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await transaction.get(userRef);

        const userData = userSnap.data() || {};
        let streak = userData.streak || 0;

        if (userData.lastCallDate === today) {}
        else if (userData.lastCallDate === yesterday) streak += 1;
        else streak = 1;

        const currentMonthStr = new Date().toISOString().slice(0, 7);
        const isSameMonth = userData.currentMonth === currentMonthStr;
        const newMonthMinutes = (isSameMonth ? (userData.currentMonthMinutes || 0) : 0) + durationMinutes;

        // Weekly leaderboard counter — same lazy-rollover pattern as the
        // monthly one: a stored key from an old week reads as 0.
        const weekKey = getWeekKey();
        const isSameWeek = userData.currentWeek === weekKey;
        const newWeekMinutes = (isSameWeek ? (userData.currentWeekMinutes || 0) : 0) + durationMinutes;

        const updatedStats = {
          ...userData,
          callCount: (userData.callCount || 0) + 1,
          totalMinutes: (userData.totalMinutes || 0) + durationMinutes,
          streak,
          lastCallDate: today,
          currentMonth: currentMonthStr,
          currentMonthMinutes: newMonthMinutes,
          currentWeek: weekKey,
          currentWeekMinutes: newWeekMinutes,
        };
        const badgeCallData = {
          duration: durationSeconds,
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
          currentMonth: updatedStats.currentMonth,
          currentMonthMinutes: updatedStats.currentMonthMinutes,
          currentWeek: updatedStats.currentWeek,
          currentWeekMinutes: updatedStats.currentWeekMinutes,
          ...(newBadges.length > 0 ? rewardResult.updates : {}),
          ...(newBadges.length > 0 ? { badgeUpdatedAt: serverTimestamp() } : {}),
        }, { merge: true });

        if (newBadges.length > 0) {
          currentUserUnlocks = newBadges.map((badgeId, badgeIndex) => ({
            badge: badgeId,
            rewardMessage: rewardResult.rewardMessages[badgeIndex] || '',
            bonusMinutes: rewardResult.updates.bonusMinutes,
          }));
        }

        transaction.set(callRef, {
          ...callSessionUpdate,
          [`statsApplied_${user.uid}`]: true,
          [`statsAppliedAt_${user.uid}`]: serverTimestamp(),
        }, { merge: true });
      });

      // Bill the call against trial/bonus minutes. The server computes the
      // duration from the call's own timestamps and is idempotent per call, so
      // this is a safe fire-and-forget for any real call.
      if (secondsTalked > 5) {
        authedFetch(`${FUNCTIONS_BASE}/consumeTrialMinutes`, {
          method: 'POST',
          body: JSON.stringify({ callId: callDocId }),
        }).catch(() => {});
      }

      if (currentUserUnlocks.length > 0) {
        const [firstUnlock, ...remainingUnlocks] = currentUserUnlocks;
        setNewBadge(firstUnlock.badge);
        setNewBadgeReward(firstUnlock.rewardMessage);
        setBadgeQueue(remainingUnlocks);
        // if (typeof firstUnlock.bonusMinutes === 'number') setBonusMinutes(firstUnlock.bonusMinutes);
      }

      // One post-call screen: the insights summary. Rating lives inline inside
      // it and the word quiz is opt-in from a button there, so the user is
      // never marched through a chain of full-screen modals. Only shown for
      // calls that were actually analyzed (>= 2 min) — a shorter call gets no
      // analysis, so it also gets no post-call screen and no notification.
      if (secondsTalked >= MIN_ANALYSIS_SECONDS) {
        setRatingEligible(secondsTalked >= 180);
        setPostCallStages(['insights']);
      }

    } catch (e) {
      console.error('[Chat] endCall error:', e);
    } finally {
      endingRef.current = false;
    }
  }, [callDocId, peerId, user, peer]);

  endCallRef.current = endCall;

  // Star/submit UI state lives in CallInsights (the rating is an inline block
  // there); this just performs the submission and throws on failure.
  const submitRating = async (stars) => {
    // First read the peer's document to calculate badge unlocks accurately
    const peerRef = doc(db, 'users', peerId);
    const peerDoc = await getDoc(peerRef);
    if (!peerDoc.exists()) throw new Error('Peer not found');

    const peerData = peerDoc.data();
    const updatedPeerData = {
      ...peerData,
      rating: (peerData.rating || 0) + stars,
      ratingCount: (peerData.ratingCount || 0) + 1,
      ...(stars === 5 ? { receivedFiveStar: true } : {}),
    };

    const newBadges = checkNewBadges(updatedPeerData);
    const rewardResult = applyBadgeRewardsToData(updatedPeerData, newBadges);

    // Only the badge rewards are computed here. rating/ratingCount are derived
    // on the server from `stars`, because peerData above was read outside the
    // server's transaction: a rating landing in between would make the totals
    // we compute here stale, and the server would reject them.
    const updates = {
      ...(newBadges.length > 0 ? rewardResult.updates : {}),
      ...(newBadges.length > 0 ? { badgeUpdatedAt: "SERVER_TIMESTAMP" } : {}),
    };

    // callId is the server's proof that this rating belongs to a real call
    // between these two users, and its once-per-call guard.
    const res = await authedFetch(`${FUNCTIONS_BASE}/updatePeerStats`, {
      method: 'POST',
      body: JSON.stringify({ peerId, callId: callDocId, stars, updates })
    });

    // 409 means this call was already rated — the user's vote is recorded, so
    // treat it as done rather than sending them back to the stars.
    if (!res.ok && res.status !== 409) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
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
      // Sənəd əvvəl yazılır: notifyChatMessage trigger-i mesaj yarananda çat
      // sənədindən participants oxuyur, ona görə o, mesajdan ƏVVƏL mövcud olmalıdır.
      await touchChat({ chatId, myUid: user.uid, peerId, lastMessage: messageText });
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
      {/* Deferred behind the post-call summary — the unlock state is kept, so
          badge popups simply appear once the summary closes instead of
          stacking on top of it. */}
      {!postCallStage && <BadgeUnlockModal
        badge={newBadge}
        rewardMessage={newBadgeReward}
        onClose={() => {
          setBadgeQueue((queue) => {
            const [nextUnlock, ...rest] = queue;
            if (nextUnlock) {
              setNewBadge(nextUnlock.badge);
              setNewBadgeReward(nextUnlock.rewardMessage);
              // if (typeof nextUnlock.bonusMinutes === 'number') setBonusMinutes(nextUnlock.bonusMinutes);
              return rest;
            }
            setNewBadge(null);
            setNewBadgeReward('');
            return [];
          });
        }}
      />}

      {incomingCallData && !inCall && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'var(--bg-card)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9998,
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '2px solid var(--accent)',
            borderRadius: '20px', padding: '40px', textAlign: 'center', maxWidth: '320px', width: '90%',
          }}>
            <div style={{ marginBottom: '12px', color: 'var(--accent)' }}><Phone size={44} strokeWidth={1.5} aria-hidden="true" /></div>
            <p style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
              {peer?.name} is calling you...
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
              <button className="btn-accept" onClick={async () => {
                setIncomingCallData(null);
                // Receiver: get mic on button tap (user gesture) then join
                if (!localTrackRef.current) {
                  try {
                    localTrackRef.current = await AgoraRTC.createMicrophoneAudioTrack();
                  } catch (e) {
                    console.error('[Chat] Receiver mic error:', e);
                  }
                }
                await setDoc(doc(db, 'calls', callDocId), { status: 'accepted' }, { merge: true });
                joinedRef.current = false;
                joinCall();
              }}><Check size={18} strokeWidth={1.75} aria-hidden="true" /> Accept</button>
              <button className="btn-reject" onClick={async () => {
                setIncomingCallData(null);
                await updateDoc(doc(db, 'calls', callDocId), { status: 'rejected' });
              }}><X size={18} strokeWidth={1.75} aria-hidden="true" /> Decline</button>
            </div>
          </div>
        </div>
      )}

      {callStatus === 'rejected' && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--danger-solid)', color: 'var(--ink-on-danger)', padding: '12px 24px',
          borderRadius: '12px', fontWeight: 600, zIndex: 9999,
        }}>
          ❌ Call declined
        </div>
      )}

      {(inCall || callStatus === 'calling') && (
        <div className="fullscreen-call">
          <div className="call-avatar-big">
            {peer?.name?.charAt(0).toUpperCase()}
            <AvatarImage src={peer?.photo} />
          </div>
          <h2 className="call-peer-name">
            {peer?.name}
            {peer?.teacherVerified && <TutorBadge />}
            {peer?.isPremium && <PremiumBadge />}
          </h2>
          <p className="call-status-text">
            {callStatus === 'calling' && 'Calling...'}
            {/* Kanaldayıq, amma qarşı tərəf hələ qoşulmayıb — gözləmə otağı. */}
            {callStatus === 'connected' && !peerJoined && 'Waiting for your partner…'}
            {/* The live dot is a styled span, not a 🟢: an emoji is the one
                thing on screen no palette can reach, and a green disc on a
                plum call screen was the only foreign hue left in the app. */}
            {callStatus === 'connected' && peerJoined && (
              <>
                <span className="call-live-dot" aria-hidden="true" />
                {formatTime(callSeconds)}
              </>
            )}
            {callStatus === 'left' && 'Partner left'}
            {callStatus === 'rejected' && 'Declined'}
            {callStatus === 'error' && 'Error'}
          </p>
          {inCall && (
            <>
              {maxCallSeconds !== Infinity && (
                <div style={{
                  background: timeWarning ? 'var(--warning-bg)' : 'var(--bg-secondary)',
                  border: timeWarning ? '1px solid var(--warning)' : 'none',
                  padding: '6px 12px', borderRadius: '20px',
                  fontSize: '12px', color: timeWarning ? 'var(--warning)' : 'var(--text-secondary)',
                  fontWeight: 600, marginTop: '8px',
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                }}>
                  <Clock size={13} strokeWidth={2} aria-hidden="true" />
                  {formatTime(Math.max(0, maxCallSeconds - callSeconds))} left
                </div>
              )}
              {timeWarning && (
                <div style={{
                  background: 'var(--warning)', color: 'var(--text-on-accent)', padding: '10px 16px',
                  borderRadius: '14px', fontSize: '14px', fontWeight: 800,
                  marginTop: '10px', animation: 'pulse 1s ease-in-out infinite',
                }}>
                  ⏳ One minute left — start wrapping up
                </div>
              )}
            </>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
            <div className="fullscreen-call-buttons">
              {inCall && (
                <>
                  <button className="call-btn-big act-vocab" onClick={() => setShowDaily(true)}>
                    <BookOpen size={26} strokeWidth={2.25} aria-hidden="true" /><span>Vocabulary</span>
                  </button>
                  {!activityOpen && (
                    <button
                      className="call-btn-big act-quiz"
                      onClick={() => {
                        // Same contentIndex pinning as the picture stage: the
                        // topic must not be recomputed per device mid-call.
                        updateDoc(doc(db, 'calls', callDocId), {
                          ...closeActivitiesExcept('questionStage'),
                          questionStage: {
                            active: true, contentIndex: getTodayIndex(),
                            difficulty: null, cardIndex: 0,
                          },
                        }).catch((e) => console.error('[Chat] questionStage start failed:', e));
                      }}
                    >
                      <MessageCircleQuestion size={26} strokeWidth={2.25} aria-hidden="true" /><span>Questions</span>
                    </button>
                  )}
                  {!activityOpen && (
                    <button
                      className="call-btn-big act-picture"
                      onClick={() => {
                        // contentIndex pins the topic for BOTH peers: each
                        // device computes "today" from its own clock, so a
                        // clock-skewed or midnight-spanning call used to show
                        // two topics — same imageIndex, different pictures.
                        updateDoc(doc(db, 'calls', callDocId), {
                          ...closeActivitiesExcept('imageStage'),
                          imageStage: {
                            active: true, imageIndex: 0, startedAtMs: Date.now(),
                            contentIndex: getTodayIndex(),
                          },
                        }).catch((e) => console.error('[Chat] imageStage start failed:', e));
                      }}
                    >
                      <ImageIcon size={26} strokeWidth={2.25} aria-hidden="true" /><span>Picture</span>
                    </button>
                  )}
                  {!activityOpen && (
                    <button
                      className="call-btn-big act-taboo"
                      onClick={() => {
                        updateDoc(doc(db, 'calls', callDocId), {
                          ...closeActivitiesExcept('tabooStage'),
                          tabooStage: {
                            active: true,
                            explainerUid: user.uid,
                            cardIndex: Math.floor(Math.random() * tabooWords.length),
                            score: 0,
                          },
                        }).catch((e) => console.error('[Chat] tabooStage start failed:', e));
                      }}
                    >
                      <Drama size={26} strokeWidth={2.25} aria-hidden="true" /><span>Taboo</span>
                    </button>
                  )}
                  {!activityOpen && (
                    <button
                      className="call-btn-big act-debate"
                      onClick={() => {
                        updateDoc(doc(db, 'calls', callDocId), {
                          ...closeActivitiesExcept('debateStage'),
                          debateStage: {
                            active: true,
                            topicIndex: Math.floor(Math.random() * debateTopics.length),
                            sideAUid: user.uid,
                          },
                        }).catch((e) => console.error('[Chat] debateStage start failed:', e));
                      }}
                    >
                      <MessagesSquare size={26} strokeWidth={2.25} aria-hidden="true" /><span>Debate</span>
                    </button>
                  )}
                  {!activityOpen && (
                    <button
                      className="call-btn-big act-guess"
                      onClick={() => {
                        updateDoc(doc(db, 'calls', callDocId), {
                          ...closeActivitiesExcept('guessStage'),
                          guessStage: {
                            active: true,
                            cardIndex: Math.floor(Math.random() * guessQuestions.length),
                            deadlineMs: Date.now() + GUESS_ROUND_SECONDS * 1000,
                            // Cleared explicitly rather than left over: a second
                            // Guess It round in the same call would otherwise
                            // open with both players already "locked in".
                            answers: {},
                            scores: {},
                          },
                        }).catch((e) => console.error('[Chat] guessStage start failed:', e));
                      }}
                    >
                      <Target size={26} strokeWidth={2.25} aria-hidden="true" /><span>Guess It</span>
                    </button>
                  )}
                </>
              )}
            </div>
            
            <div className="fullscreen-call-buttons">
              {inCall && (
                <button className={`call-btn-big ${muted ? 'active-mute' : ''}`} onClick={toggleMute}>
                  {muted ? <MicOff size={26} strokeWidth={2.25} aria-hidden="true" /> : <Mic size={26} strokeWidth={2.25} aria-hidden="true" />}<span>{muted ? 'Unmute' : 'Mute'}</span>
                </button>
              )}
              <button className="call-btn-big end" onClick={endCall}><PhoneOff size={26} strokeWidth={2.25} aria-hidden="true" /><span>End</span></button>
            </div>
          </div>
        </div>
      )}
      {/* The translate ball is position:fixed at z-index 10005, which put it on
          top of EVERYTHING -- including the "Next picture" / "Next topic"
          button at the bottom of every in-call activity panel. Tapping the
          primary action meant tapping the globe instead. While a panel owns the
          screen the widget stands down; closing the panel brings it back.
          The roadmap is in that list for the same reason and it was NOT: the
          globe sat on the roadmap's Skip button, so the first thing a learner
          does on their first call — dismiss the roadmap — opened the
          translator over everything instead. */}
      {inCall && !stageOpen && !showRoadmap && (
        <div id="tour-translate">
          <TranslateWidget 
            userId={user.uid} 
            topic={content?.topic || 'General'} 
            onTranslate={(t) => setCallTranslations(prev => [...prev, t])}
            nativeLanguage={user?.preferredLanguage}
          />
        </div>
      )}

      {/* Wait for the roadmap: on a first call both would fire at once and the
          tour's overlay sat on top, blocking every tap on the roadmap. */}
      {inCall && <GuidedTour user={user} steps={CHAT_TOUR_STEPS} tourKey="tourDone_chat" disabled={showRoadmap} />}

      {inCall && imageStage?.active && content && (
        <CallImageStage
          // Read the topic the starter pinned into the call doc; fall back to
          // the local day for stage docs written before contentIndex existed.
          content={imageStage.contentIndex != null
            ? getContentByIndex(imageStage.contentIndex)
            : content}
          imageIndex={imageStage.imageIndex || 0}
          onNext={() => {
            // Explicit value, not increment(): when both peers tap "next" at
            // the same moment they write the same number and the deck advances
            // by one instead of silently skipping a picture.
            updateDoc(doc(db, 'calls', callDocId), {
              'imageStage.imageIndex': (imageStage.imageIndex || 0) + 1,
            }).catch((e) => console.error('[Chat] imageStage next failed:', e));
          }}
          onClose={() => {
            updateDoc(doc(db, 'calls', callDocId), {
              'imageStage.active': false,
            }).catch((e) => console.error('[Chat] imageStage close failed:', e));
          }}
        />
      )}

      {inCall && questionStage?.active && content && (
        <CallQuestionStage
          content={questionStage.contentIndex != null
            ? getContentByIndex(questionStage.contentIndex)
            : content}
          difficulty={questionStage.difficulty || null}
          cardIndex={questionStage.cardIndex || 0}
          onPickDifficulty={(d) => {
            // Səviyyə seçilən kimi birinci kart açılır — aralıq dəstə yoxdur.
            updateDoc(doc(db, 'calls', callDocId), {
              'questionStage.difficulty': d,
              'questionStage.cardIndex': 0,
            }).catch((e) => console.error('[Chat] questionStage difficulty failed:', e));
          }}
          onGo={(i) => {
            updateDoc(doc(db, 'calls', callDocId), {
              'questionStage.cardIndex': i,
            }).catch((e) => console.error('[Chat] questionStage move failed:', e));
          }}
          onBackToDifficulty={() => {
            updateDoc(doc(db, 'calls', callDocId), {
              'questionStage.difficulty': null,
              'questionStage.cardIndex': 0,
            }).catch((e) => console.error('[Chat] questionStage difficulty reset failed:', e));
          }}
          onClose={() => {
            updateDoc(doc(db, 'calls', callDocId), {
              'questionStage.active': false,
            }).catch((e) => console.error('[Chat] questionStage close failed:', e));
          }}
        />
      )}

      {inCall && tabooStage?.active && (
        <CallTabooStage
          cardIndex={tabooStage.cardIndex || 0}
          score={tabooStage.score || 0}
          isExplainer={tabooStage.explainerUid === user.uid}
          // Only the explainer renders these two buttons, so a single client
          // ever writes the round result — no lost updates.
          onCorrect={() => {
            updateDoc(doc(db, 'calls', callDocId), {
              'tabooStage.score': increment(1),
              'tabooStage.cardIndex': increment(1),
              'tabooStage.explainerUid': peerId,
            }).catch((e) => console.error('[Chat] tabooStage correct failed:', e));
          }}
          onPass={() => {
            updateDoc(doc(db, 'calls', callDocId), {
              'tabooStage.cardIndex': increment(1),
            }).catch((e) => console.error('[Chat] tabooStage pass failed:', e));
          }}
          onClose={() => {
            updateDoc(doc(db, 'calls', callDocId), {
              'tabooStage.active': false,
            }).catch((e) => console.error('[Chat] tabooStage close failed:', e));
          }}
        />
      )}

      {inCall && debateStage?.active && (
        <CallDebateStage
          topicIndex={debateStage.topicIndex || 0}
          side={debateStage.sideAUid === user.uid ? 'A' : 'B'}
          onNextTopic={() => {
            // Növbəti mövzu ardıcıl gedir, random DEYİL: random seçim eyni
            // mövzunu təkrar verə bilirdi və düymə «işləmir» kimi görünürdü.
            // imageStage-dəki kimi açıq dəyər yazılır (increment yox), ona görə
            // hər iki peer eyni anda basanda mövzu bir dəfə irəliləyir.
            //
            // Tərəflər hər mövzuda yer dəyişir: başladan həmişə sideA qalsaydı,
            // bir nəfər heç vaxt əks mövqeyi müdafiə etməzdi — debatın bütün
            // dil faydası isə məhz orada.
            updateDoc(doc(db, 'calls', callDocId), {
              'debateStage.topicIndex': (debateStage.topicIndex || 0) + 1,
              'debateStage.sideAUid': debateStage.sideAUid === user.uid ? peerId : user.uid,
            }).catch((e) => console.error('[Chat] debateStage next failed:', e));
          }}
          onClose={() => {
            updateDoc(doc(db, 'calls', callDocId), {
              'debateStage.active': false,
            }).catch((e) => console.error('[Chat] debateStage close failed:', e));
          }}
        />
      )}

      {inCall && guessStage?.active && (
        <CallGuessStage
          cardIndex={guessStage.cardIndex || 0}
          deadlineMs={guessStage.deadlineMs || 0}
          myUid={user.uid}
          peerUid={peerId}
          peerName={peer?.name}
          answers={guessStage.answers || {}}
          scores={guessStage.scores || {}}
          // Each peer writes only their own guess, so the two submits can never
          // collide — and neither can overwrite the other's number.
          onSubmit={(value) => {
            updateDoc(doc(db, 'calls', callDocId), {
              [`guessStage.answers.${user.uid}`]: value,
            }).catch((e) => console.error('[Chat] guessStage submit failed:', e));
          }}
          // Same reasoning for the point: I only ever touch my own score.
          onWin={() => {
            updateDoc(doc(db, 'calls', callDocId), {
              [`guessStage.scores.${user.uid}`]: increment(1),
            }).catch((e) => console.error('[Chat] guessStage score failed:', e));
          }}
          onNext={() => {
            // Explicit values, not increment: if both peers tap Next at the
            // same moment the card still advances exactly one step. Same
            // reasoning as debateStage.topicIndex.
            updateDoc(doc(db, 'calls', callDocId), {
              'guessStage.cardIndex': (guessStage.cardIndex || 0) + 1,
              'guessStage.deadlineMs': Date.now() + GUESS_ROUND_SECONDS * 1000,
              'guessStage.answers': {},
            }).catch((e) => console.error('[Chat] guessStage next failed:', e));
          }}
          onClose={() => {
            updateDoc(doc(db, 'calls', callDocId), {
              'guessStage.active': false,
            }).catch((e) => console.error('[Chat] guessStage close failed:', e));
          }}
        />
      )}

      {inCall && showRoadmap && !activityOpen && (
        <CallRoadmap
          content={content}
          onStart={() => setShowRoadmap(false)}
          onOpenDaily={() => { setShowRoadmap(false); setShowDaily(true); }}
        />
      )}

      {showDaily && (
        <div className="daily-panel">
          <div className="daily-panel-header">
            <h3>{content.topic}</h3>
            <button className="daily-close" onClick={() => setShowDaily(false)}><X size={20} strokeWidth={1.75} aria-hidden="true" /></button>
          </div>
          {/* Zəng içində suallar artıq sinxron 🗣️ stage-indədir; bu panel yalnız
              lüğət kimi qalır, yoxsa iki ayrı sual siyahısı bir-birini kəsirdi. */}
          <div className="daily-panel-tabs">
            <button className={`dp-tab ${dailyTab === 'vocabulary' ? 'active' : ''}`} onClick={() => setDailyTab('vocabulary')}><BookMarked size={15} strokeWidth={1.75} aria-hidden="true" /> Vocab</button>
            <button className={`dp-tab ${dailyTab === 'idioms' ? 'active' : ''}`} onClick={() => setDailyTab('idioms')}><Lightbulb size={15} strokeWidth={1.75} aria-hidden="true" /> Idioms</button>
          </div>
          <div className="daily-panel-body">
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
                    <p className="idiom-meaning"> {idiom.meaning}</p>
                    <p className="idiom-example"> "{idiom.example}"</p>
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
            {peer?.name?.charAt(0).toUpperCase()}
            <AvatarImage src={peer?.photo} />
          </div>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center' }}>
              {peer?.name}
              {peer?.teacherVerified && <TutorBadge />}
              {peer?.isPremium && <PremiumBadge />}
            </h3>
            <span>{peer?.level || 'English Speaker'}</span>
          </div>
        </div>
        <div className="call-controls">
          {!inCall && callStatus !== 'calling' && (
            <button className="btn-call" onClick={startCall}><Phone size={18} strokeWidth={1.75} aria-hidden="true" /> Call</button>
          )}
          <button className="btn-daily-chat" onClick={() => setShowDaily(!showDaily)}><Calendar size={20} strokeWidth={1.75} aria-hidden="true" /></button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty-hint">
            <p>Say hello and start practising.</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.senderId === user.uid;
            const selected = selectedMsg === m.id;
            return (
              <div key={m.id} className={`message ${isMine ? 'mine' : 'theirs'}${m.kind === 'analysis' ? ' message--card' : ''}`}>
                {!isMine && <span className="message-sender">{m.senderName}</span>}
                {m.deleted ? (
                  <p style={{ fontStyle: 'italic', opacity: 0.6 }}>This message was deleted</p>
                ) : m.kind === 'analysis' ? (
                  /* Serverin yazdığı hesabat kartı (postAnalysisToTeacherChat).
                     senderId şagirddir, ona görə `isMine` elə buradaca kimin
                     baxdığını deyir: öz hesabatımdırsa History-ə, şagirdinkidirsə
                     müəllim səhifəsinə aparır — əlavə rol sorğusu olmadan. */
                  <AnalysisMessage
                    message={m}
                    isMine={isMine}
                    onOpen={() => navigate(isMine ? '/history' : `/teacher/student/${m.senderId}`)}
                  />
                ) : (
                  <p
                    onClick={() => isMine && setSelectedMsg(selected ? null : m.id)}
                    style={{ cursor: isMine ? 'pointer' : 'default' }}
                  >
                    {m.text}
                  </p>
                )}
                {/* Silmə yalnız öz mesajında və toxunuşdan sonra görünür —
                    hər baloncuğun yanında daimi zibil qutusu söhbəti qarışdırır. */}
                {isMine && selected && !m.deleted && (
                  <button
                    type="button"
                    onClick={() => { setSelectedMsg(null); deleteMessage(chatId, m.id); }}
                    style={{
                      marginTop: '6px', padding: '5px 10px', borderRadius: '8px',
                      border: '1px solid var(--danger)', background: 'var(--danger-bg)',
                      color: 'var(--danger)', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" /> Delete for everyone
                  </button>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input" onSubmit={sendMessage}>
        <input
          type="text"
          placeholder="Write a message..."
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <button type="submit" aria-label="Send"><Send size={18} strokeWidth={1.75} aria-hidden="true" /></button>
      </form>
      
      {postCallStage === 'quiz' && (
        <PostCallQuizModal
          words={callTranslations}
          onClose={advancePostCall}
        />
      )}

      {postCallStage === 'insights' && (
        <CallInsights
          userId={user.uid}
          channelName={`${callDocId}_${sessionIdRef.current}`}
          enqueueFailed={enqueueFailed}
          ratingEnabled={ratingEligible}
          peerName={peer?.name}
          onSubmitRating={submitRating}
          quizWordCount={callTranslations.length}
          onStartQuiz={() => setPostCallStages(['quiz'])}
          onClose={advancePostCall}
        />
      )}
    </div>
  );
}

// Hesabat kartı — serverin söhbətə yazdığı `kind: 'analysis'` mesajı.
//
// Niyə adi mesaj kimi göstərmirik: müəllim gündə onlarla sətir oxuyur, düz
// mətn sətri həmin axında itir. Kartın YEGANƏ işi bir baxışda "kim, neçə bal,
// nə üzərində işləyir" demək və hesabata bir toxunuşla aparmaqdır.
//
// `themes` öyrənənin ana dilindədir (analizin özü kimi), çərçivə isə
// ingiliscədir — tətbiqin qalanı ilə eyni qayda.
function AnalysisMessage({ message, isMine, onOpen }) {
  const score = Number.isFinite(message.score) ? message.score : null;
  const themes = Array.isArray(message.themes) ? message.themes.filter(Boolean) : [];

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--s-3)',
        width: '100%', textAlign: 'left', cursor: 'pointer',
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', padding: 'var(--s-3)',
        color: 'var(--text-primary)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0, width: 38, height: 38, borderRadius: 'var(--r-md)',
          background: 'var(--accent-soft)', color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <FileText size={19} strokeWidth={2} />
      </span>

      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: '14px', fontWeight: 800, marginBottom: 2 }}>
          {isMine ? 'Your session report' : 'Session report'}
          {score !== null && (
            // Bal mətnin içindədir, ayrı rəngli nişan deyil: rəng bu palitrada
            // "yaxşı/pis" demir və zəif balı qırmızı etmək qadağandır.
            <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}> · {score}/100</span>
          )}
        </span>
        <span
          style={{
            fontSize: '12px', fontWeight: 600,
            color: 'var(--text-muted)',
            // İKİ sətir, bir sətir yox. Ölçdüm: 360px ekranda bu sətrə ~224px
            // düşür, yəni ~35 simvol — "Working on: Artikllər (a / an / the)"
            // 36 simvoldur və tək sətirdə BİRİNCİ mövzunun ortasından kəsilirdi
            // ("... (a / an / th…"). Mövzu adları kartın bütün mənasıdır, ona
            // görə ikinci sətir verilir; ikidən çoxu isə söhbət axınını qırar.
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {themes.length ? `Working on: ${themes.join(', ')}` : 'Open to see the full report'}
        </span>
      </span>

      <ChevronRight size={18} strokeWidth={2} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
    </button>
  );
}
