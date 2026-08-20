import React, { useEffect, useState, useCallback } from 'react';import TeacherInviteBanner from '../components/TeacherInviteBanner';
import TutorBadge from '../components/TutorBadge';
import { collection, doc, getDocs, onSnapshot, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate, useLocation } from 'react-router-dom';

import DailyTopicModal from '../components/DailyTopicModal';
import NotificationPrompt from '../components/NotificationPrompt';
import StreakModal from '../components/StreakModal';
import StreakJourney from '../components/StreakJourney';
import { getStreakInfo } from '../utils/streak';
import TopicDecorations from '../components/TopicDecorations';
import { getTodayContent } from '../data/weeklyContent';
import { subscribeToCycle } from '../utils/cycle';
import { subscribeToBlocked } from '../utils/blocklist';
import AnalysisReadyModal from '../components/AnalysisReadyModal';
import { AchievementsPanel } from '../components/BadgeSystem';
import Logo from '../components/Logo';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { subscribeToSearchingQueue, SEARCH_STALE_MS, lastAliveMs } from '../utils/matchmaking';
import FlaskSearchOverlay from '../components/FlaskSearchOverlay';
import { ADMIN_UID } from '../constants';
import { getPresence, ONLINE_WINDOW_MS } from '../utils/presence';
import GuidedTour from '../components/GuidedTour';
import CourseProgressCard from '../components/CourseProgressCard';
import DailyTopicBanner from '../components/DailyTopicBanner';
import CourseCompletionCelebration from '../components/CourseCompletionCelebration';
import PracticeBoard from '../components/PracticeBoard';
import SlotNoticeModal from '../components/SlotNoticeModal';
import UpcomingCallCard from '../components/UpcomingCallCard';
import SlotChangeBanner from '../components/SlotChangeBanner';
import LabBuddy from '../components/LabBuddy';
import BuddySwing from '../components/BuddySwing';
import TodayTaskCard from '../components/ai/TodayTaskCard';
import {
  currentBlockSlotId, joinPracticeSlot, leavePracticeSlot, subscribeToMySlots,
  subscribeToSlotChange,
} from '../utils/practiceSlots';
import { Award, Shuffle, X, Globe, Shield, BookOpen } from 'lucide-react';

// Ordered to match the screen top-to-bottom, ending on the bottom nav.
const HOME_TOUR_STEPS = [
  {
    target: '#tour-find-partner',
    title: 'Start here 🎙️',
    content: 'One tap finds a partner at your level (A1–C2) and starts the call. The fastest way to practise.',
    disableBeacon: true,
  },
  {
    target: '#tour-daily-topic',
    title: "Today’s topic 📅",
    content: "Look through today’s topic, new words and questions before your call, so you know what to talk about.",
  },
  {
    target: '#tour-filters',
    title: 'Level filters',
    content: 'Use these to find people at your level.',
  },
  {
    target: '#tour-ai-chat',
    title: 'AI Praktika 🤖',
    content: 'You can start a voice session with AInur any time.',
  }
];

const LEVELS = ['All', 'A1 – Beginner', 'A2 – Elementary', 'B1 – Intermediate',
                'B2 – Upper-Intermediate', 'C1 – Advanced', 'C2 – Proficient'];

export default function Home({ user }) {  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  const [tab, setTab] = useState('online');
  const [levelFilter, setLevelFilter] = useState('All');
  const [userBadges, setUserBadges] = useState(user.badges || []);
  const [dailyTopicOpen, setDailyTopicOpen] = useState(false);
  const [rawSearchers, setRawSearchers] = useState([]);
  // Praktika slotları: mine = {slotIds, recurringSlots, upcomingCall, slotNoticePending}
  const [mine, setMine] = useState(null);
  // Lövhə öz açılma vəziyyətini özü idarə edir; bu sayğac yalnız "zorla aç"
  // siqnalıdır (axtarış partnyor tapmayanda lövhə görünməlidir).
  const [boardOpenSignal, setBoardOpenSignal] = useState(0);
  const [slotToast, setSlotToast] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [slotChange, setSlotChange] = useState(null);
  // Value unused — bumping it only forces the staleness re-filter below.
  const [, setSearcherTick] = useState(0);
  const [showTopicIntro, setShowTopicIntro] = useState(false);
  const [todayTopic, setTodayTopic] = useState(null);
  const [streakModalOpen, setStreakModalOpen] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [pendingTopicIntro, setPendingTopicIntro] = useState(false);
  const [streakInfo] = useState(() => getStreakInfo(user));
  const [blockedIds, setBlockedIds] = useState(() => new Set());
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => subscribeToBlocked(user.uid, setBlockedIds), [user.uid]);

  // The daily-question push deep-links to /?daily=1 — open the topic modal
  // and strip the param so refresh/back doesn't reopen it.
  useEffect(() => {
    if (new URLSearchParams(location.search).get('daily')) {
      setDailyTopicOpen(true);
      navigate('/', { replace: true });
    }
  }, [location.search, navigate]);


  // todayTopic MUST track the server cycle, not be captured once: on a cold
  // start the appConfig/cycle snapshot hasn't landed yet, so getTodayContent()
  // falls back to the local calendar formula — the intro modal then announces
  // a different topic than the banner/material (which do subscribe and
  // self-correct). Subscribing here keeps every surface on one truth.
  useEffect(() => subscribeToCycle(() => setTodayTopic(getTodayContent())), []);

  useEffect(() => {
    const todayDateStr = new Date().toDateString();

    const topicKey = `lastTopicIntroDate_v2_${user.uid}`;
    const topicDue = localStorage.getItem(topicKey) !== todayDateStr;
    if (topicDue) localStorage.setItem(topicKey, todayDateStr);

    // The daily streak celebration takes the stage first; the topic intro is
    // deferred until it closes so two full-screen modals never stack.
    const streakKey = `streak_modal_shown_${todayDateStr}_${user.uid}`;
    const streakDue = localStorage.getItem(streakKey) !== '1';

    if (streakDue) {
      setStreakModalOpen(true);
      setPendingTopicIntro(topicDue);
      localStorage.setItem(streakKey, '1');
    } else if (topicDue) {
      setShowTopicIntro(true);
    }
  }, [user.uid]);

  const closeStreakModal = () => {
    setStreakModalOpen(false);
    if (pendingTopicIntro) { setShowTopicIntro(true); setPendingTopicIntro(false); }
  };

  const closeJourney = () => {
    setJourneyOpen(false);
    if (pendingTopicIntro) { setShowTopicIntro(true); setPendingTopicIntro(false); }
  };

  const handleMatched = useCallback((partnerUid, callId) => {
    navigate(`/chat/${partnerUid}`, {
      state: { acceptedCall: true, callId, matchedCall: true },
    });
  }, [navigate]);

  // Canlı axtarış partnyor tapmayanda niyyət İTMİR: istifadəçi cari 2 saatlıq
  // blokun üzvü olur və lövhə açılır. Səbinə 14:03-də boş görüb çıxsa belə,
  // Rümeysa 14:07-də "1 nəfər gözləyir" görüb qoşulur → dərhal eşləşmə.
  // Əvvəl bilet silinirdi və bu ssenari FİZİKİ olaraq mümkün deyildi.
  const handleNoMatch = useCallback(async () => {
    setBoardOpenSignal((n) => n + 1);
    const slotId = currentBlockSlotId();
    if (!slotId) return; // gecə saatları — blok yoxdur, sadəcə lövhə açılır
    const res = await joinPracticeSlot(slotId);
    if (res.ok && res.data?.matched) {
      setSlotToast(`✅ Your call with ${res.data.partnerName || 'your partner'} is confirmed.`);
    } else {
      setSlotToast('Nobody is free right now. We saved your slot and will notify you when someone joins.');
    }
    setTimeout(() => setSlotToast(''), 8000);
  }, []);

  const { searching, startSearch, cancelSearch } = useMatchmaking({
    user,
    levelFilter,
    onMatched: handleMatched,
    onNoMatch: handleNoMatch,
  });

  // Randevunu ləğv etmək YOLU OLMALIDIR: çıxışı olmayan öhdəlik istifadəçini
  // sıxır və nəticədə heç kim slot qoymur. Partnyora gedən mətndə rədd və ad
  // keçmir (leavePracticeSlot), yəni ləğv utandırıcı hala çevrilmir.
  const cancelUpcoming = useCallback(async () => {
    const uc = mine?.upcomingCall;
    if (!uc) return;
    if (!window.confirm('Cancel this call? Your partner will be notified.')) return;
    setCancelBusy(true);
    const res = await leavePracticeSlot(uc.slotId);
    setCancelBusy(false);
    if (!res.ok) setSlotToast(`⚠️ ${res.errorText}`);
    else setSlotToast('Call cancelled.');
    setTimeout(() => setSlotToast(''), 6000);
  }, [mine]);

  // Randevu / öz slotlarım / nəzakətli xatırlatma — hamısı öz user sənədimdə.
  // App.js-in canlı sahə siyahısına salına bilmirlər (obyekt və massiv `!==`
  // müqayisəsini heç vaxt keçmir, hər heartbeat-də bütün tətbiq render olardı).
  useEffect(() => subscribeToMySlots(user.uid, setMine), [user.uid]);
  useEffect(() => subscribeToSlotChange(user.uid, setSlotChange), [user.uid]);

  // Polled instead of a live listener: with a live query every user's
  // presence heartbeat would be re-streamed to every Home viewer (read
  // amplification). 20s polling makes an exit visible fast (goOffline stamps
  // status:'offline' instantly; the poll is the only remaining latency).
  // The window/heartbeat pair lives in presence.js / App.js.
  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      try {
        const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS);
        const snap = await getDocs(query(
          collection(db, 'users'),
          where('lastSeen', '>', cutoff),
          limit(50)
        ));
        if (cancelled) return;
        const now = Date.now();
        const online = [];
        const all = [];
        snap.docs.forEach(d => {
          const data = d.data();
          const u = { id: d.id, ...data, uid: data.uid || d.id };
          if (u.uid === user.uid || u.id === user.uid) return;
          all.push(u);
          // getPresence respects status:'offline', so a user who just exited
          // drops off the list on the next poll instead of after the window.
          if (getPresence(u, now) !== 'offline' || u.uid === ADMIN_UID) online.push(u);
        });
        // Free people first — someone already in a call cannot talk to you.
        online.sort((a, b) => (getPresence(a, now) === 'busy') - (getPresence(b, now) === 'busy'));
        setOnlineUsers(online);
        setAllUsers(all);
      } catch (e) {
        console.error('[Home] users load failed:', e);
      }
    };

    loadUsers();
    const interval = setInterval(loadUsers, 20000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user.uid]);



  useEffect(() => () => { cancelSearch(); }, [cancelSearch]);

  // Live searchers, so "somebody is waiting right now" is visible in-app and
  // not only via the FCM ping. Reuses the same capped listener the matcher
  // uses; staleness is re-evaluated on a slow tick because a killed app stops
  // pinging without emitting a final snapshot.
  useEffect(() => subscribeToSearchingQueue(setRawSearchers), []);

  useEffect(() => {
    if (rawSearchers.length === 0) return;
    const id = setInterval(() => setSearcherTick((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, [rawSearchers.length]);

  const searcherNow = Date.now();
  const activeSearchers = rawSearchers.filter((t) =>
    t.uid && t.uid !== user.uid && !t.sessionId
    && !blockedIds.has(t.uid)
    && searcherNow - lastAliveMs(t) <= SEARCH_STALE_MS);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setUserBadges(snap.exists() ? (snap.data().badges || []) : []);
    });
    return unsub;
  }, [user.uid]);



  const browsableUsers = allUsers.filter(u => u.uid !== user.uid && u.id !== user.uid);
  const isPeopleTab = tab === 'online' || tab === 'all';
  const baseList = (tab === 'online' ? onlineUsers : browsableUsers)
    .filter(u => !blockedIds.has(u.uid || u.id));
  const displayUsers = levelFilter === 'All' ? baseList : baseList.filter(u => u.level === levelFilter);

  return (
    <div className="home-page">
      <GuidedTour
        user={user}
        steps={HOME_TOUR_STEPS}
        tourKey="tourDone_home"
        disabled={showTopicIntro || dailyTopicOpen || streakModalOpen || journeyOpen}
      />
      {todayTopic && (
        <TopicDecorations 
          topic={todayTopic.topic} 
          intensity={showTopicIntro || dailyTopicOpen ? 'high' : 'low'} 
        />
      )}
      
      {showTopicIntro && todayTopic && (
        <div className="topic-intro-overlay">
          <div className="topic-intro-modal">
            <h3 className="topic-intro-label">🌟 Today's topic</h3>
            <h1 className="topic-intro-title">{todayTopic.topic}</h1>
            <p className="topic-intro-desc">
              Look through the words, idioms and questions to get ready.
            </p>
            <div className="topic-intro-actions">
              <button 
                className="topic-intro-btn-primary" 
                onClick={() => {
                  setShowTopicIntro(false);
                  setDailyTopicOpen(true);
                }}
              >
                <BookOpen size={18} /> Start learning
              </button>
              <button 
                className="topic-intro-btn-secondary" 
                onClick={() => setShowTopicIntro(false)}
              >
                Open
              </button>
            </div>
          </div>
        </div>
      )}



      <div className="home-header">
        <div className="home-logo" style={{ display: 'flex', alignItems: 'center' }}>
          <Logo width={120} />
        </div>
        {user.uid === ADMIN_UID && (
          <button onClick={() => navigate('/admin')} style={{
            background: '#2e2e50', color: '#7c6ff7', border: '1px solid #7c6ff755',
            borderRadius: '10px', padding: '6px 12px', fontWeight: 700,
            fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
          }}>
            <Shield size={12} /> Admin
          </button>
        )}
      </div>

      <div className="home-body">
        {/* Müəllimin birbaşa dəvəti — şagird heç nə yazmadan qəbul edir. */}
        <TeacherInviteBanner user={user} />

        <CourseCompletionCelebration user={user} />

        {/* First card on the screen, and the point of the release: there is
            always something to practise, whether or not anyone is online. */}
        <TodayTaskCard topic={todayTopic?.topic} hasTeacher={!!user?.teacherId} />

        {/* Nəzakətli xatırlatma — cəza YOX. İcma yeni formalaşır, ban insanları
            qaçırardı; bir dəfəlik xahiş kifayətdir. */}
        {mine?.slotNoticePending && <SlotNoticeModal uid={user.uid} />}

        {/* Kolba — deyəcək sözü olanda küncdən boylanır, sonra yox olur.
            Yalnız Lobby-də: hər ekranda çıxsa, personaj deyil, maneə olur. */}
        <LabBuddy
          user={user}
          mine={mine}
          onOpenBoard={() => setBoardOpenSignal((n) => n + 1)}
        />

        {/* Partnyorun vaxt təklifi randevu kartından ƏVVƏL: cavab verilməmiş
            sual ekranın yuxarısında dayanmalıdır. */}
        <SlotChangeBanner request={slotChange} onDone={() => setSlotChange(null)} />

        {/* Təsdiqlənmiş randevu ekranın ƏSAS elementidir: məhsulun bütün vədi
            budur — "bu gün filan saatda səni kimsə gözləyir". */}
        <UpcomingCallCard
          call={mine?.upcomingCall}
          busy={cancelBusy}
          onJoin={() => {
            const uc = mine.upcomingCall;
            navigate(`/chat/${uc.peerUid}`, {
              state: { acceptedCall: true, callId: uc.callId, matchedCall: true, slotId: uc.slotId },
            });
          }}
          onCancel={cancelUpcoming}
        />

        <DailyTopicBanner
          user={user}
          onOpenTopic={() => setDailyTopicOpen(true)}
        />

        <NotificationPrompt user={user} />

        {/* AD QƏSDƏN GÖSTƏRİLMİR. Kim olduğunu bilmək seçicilik (cherry-picking)
            yaradır: aşağı səviyyəli istifadəçi yuxarı səviyyəlini görüb
            qoşulmaqdan çəkinir, rədd təcrübəsi isə özgüvəni qırır. Qoşulma
            şəxsə deyil, gözləyən HOVUZA olur. */}
        {activeSearchers.length > 0 && !searching && (
          <div style={{
            background: 'rgba(124,111,247,0.10)',
            border: '1px solid rgba(124,111,247,0.4)',
            borderRadius: '14px', padding: '12px 16px', marginBottom: '10px',
            display: 'flex', alignItems: 'center', gap: '12px',
            animation: 'searcherPulse 2s ease-in-out infinite',
          }}>
            <span style={{ fontSize: '22px' }}>🔎</span>
            <p style={{ flex: 1, color: 'var(--text-primary, #fff)', fontSize: '14px', margin: 0, lineHeight: 1.4 }}>
              <b>{activeSearchers.length} people</b> is looking for a partner right now — join and you will connect immediately.
            </p>
            <button
              onClick={startSearch}
              style={{
                background: 'linear-gradient(135deg, #7c6ff7, #5b4de8)', color: '#fff',
                border: 'none', borderRadius: '10px', padding: '10px 14px',
                fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Join now
            </button>
            <style>{`
              @keyframes searcherPulse {
                0%, 100% { box-shadow: 0 0 0 0 rgba(124,111,247,0.35); }
                50% { box-shadow: 0 0 0 6px rgba(124,111,247,0); }
              }
            `}</style>
          </div>
        )}

        <button
          id="tour-find-partner"
          onClick={searching ? cancelSearch : startSearch}
          className={searching ? 'btn-random searching' : 'btn-random'}
          style={{
            background: searching ? 'linear-gradient(135deg, #ef4444, #dc2626)' : undefined,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          }}
        >
          {searching
            ? <><X size={20} /> {'Searching... (cancel)'}</>
            : <><Shuffle size={20} /> {'Find a random partner'}</>
          }
        </button>

        <FlaskSearchOverlay
          visible={searching}
          title="Finding a partner…"
          subtitle="Looking for a match — the call starts automatically once we find one"
          onCancel={cancelSearch}
          cancelLabel="Stop searching"
        />

        {slotToast && (
          <div style={{
            background: 'linear-gradient(135deg, #065f46, #047857)',
            border: '1px solid #10b98155', borderRadius: '14px',
            padding: '14px 18px', marginTop: '10px', textAlign: 'center',
            animation: 'fadeInUp 0.4s ease',
          }}>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
              {slotToast}
            </p>
          </div>
        )}

        {/* Lövhənin öz açılan başlığı var — ayrıca tam enli düymə ana səhifədə
            lazımsız yer tuturdu. */}
        <div style={{ marginTop: '12px' }}>
          <PracticeBoard mine={mine} openSignal={boardOpenSignal} />
        </div>

        {/* Günün mövzusu girişi yuxarıdakı DailyTopicBanner-dədir — burada
            ayrıca "Daily Topic" düyməsi eyni modalı açırdı və təkrar idi. */}

        {/* Course standing lives BELOW the primary action — a status note
            ("müraciət göndərildi", progress) must never push Find Random
            Partner down the screen. */}
        <CourseProgressCard user={user} />

        {/* "Kursa qoşul" kartı buradan ÇIXARILDI — eyni /redeem girişi Profildə
            onsuz da var idi, yəni ana səhifədə dublikat idi. Ana səhifə indi
            yalnız praktikaya aid elementləri saxlayır. */}

        <style>{`
          .filter-chip-wrapper::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {/* Row 2: Filter Chips */}
        <div 
          id="tour-filters"
          className="filter-chip-wrapper"
          style={{ 
            display: 'flex', 
            flexDirection: 'row', 
            overflowX: 'auto', 
            gap: '8px', 
            paddingBottom: '4px', 
            marginBottom: '10px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          <button
            onClick={() => setTab('online')}
            style={{
              flexShrink: 0,
              height: '36px',
              padding: '0 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              border: tab === 'online' ? '1px solid #6C3EF4' : '1px solid rgba(255,255,255,0.15)',
              cursor: 'pointer',
              backgroundColor: tab === 'online' ? '#6C3EF4' : 'rgba(255,255,255,0.08)',
              color: tab === 'online' ? '#ffffff' : 'rgba(255,255,255,0.7)',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: tab === 'online' ? '#fff' : '#22c55e', display: 'inline-block' }} />
            Online ({onlineUsers.length})
          </button>
          <button
            onClick={() => setTab('all')}
            style={{
              flexShrink: 0,
              height: '36px',
              padding: '0 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              border: tab === 'all' ? '1px solid #6C3EF4' : '1px solid rgba(255,255,255,0.15)',
              cursor: 'pointer',
              backgroundColor: tab === 'all' ? '#6C3EF4' : 'rgba(255,255,255,0.08)',
              color: tab === 'all' ? '#ffffff' : 'rgba(255,255,255,0.7)',
            }}
          >
            All ({browsableUsers.length})
          </button>
          <button
            onClick={() => setTab('achievements')}
            style={{
              flexShrink: 0,
              height: '36px',
              padding: '0 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              border: tab === 'achievements' ? '1px solid #6C3EF4' : '1px solid rgba(255,255,255,0.15)',
              cursor: 'pointer',
              backgroundColor: tab === 'achievements' ? '#6C3EF4' : 'rgba(255,255,255,0.08)',
              color: tab === 'achievements' ? '#ffffff' : 'rgba(255,255,255,0.7)',
            }}
          >
            <Award size={14} />
            Badges
          </button>
        </div>

        {isPeopleTab && (
          <div className="level-filter">
            {LEVELS.map(l => (
              <button key={l} className={`level-btn ${levelFilter === l ? 'active' : ''}`} onClick={() => setLevelFilter(l)}>
                {l === 'All' ? <><Globe size={12} style={{ marginRight: 4 }} />All</> : l.split(' – ')[0]}
              </button>
            ))}
          </div>
        )}

        {tab === 'achievements' && (
          <AchievementsPanel earnedBadges={userBadges} />
        )}

        {isPeopleTab && (
          <>
            {displayUsers.length === 0 ? (
              /* Boş ekran ən pis andır — 😴 emoji yerinə yellənçəkdə oturan
                 Kolba. Gəlişinə reaksiya verir, sonra sakitcə yellənir. */
              <div className="empty-state">
                <BuddySwing label={tab === 'online' ? 'Nobody is online right now.' : 'No users yet.'} />
              </div>
            ) : (
              <div className="users-grid">
                {displayUsers.map(u => (
                  <div key={u.id || u.uid} className="user-card" style={{
                    border: u.isPremium ? '1px solid #f59e0b55' : '1px solid #2e2e50',
                  }}>
                    <div className="user-avatar" style={{
                      boxShadow: u.isPremium ? '0 0 12px #f59e0b66' : undefined,
                    }}>
                      {u.photo
                        ? <img src={u.photo} alt={u.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                        : u.name?.charAt(0).toUpperCase()}
                    </div>

                    <div className="user-info">
                      <h3 style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                        {u.name || 'User'}
                        {u.teacherVerified && <TutorBadge />}
                      </h3>
                      <span className="user-level">
                        {u.level || 'English Speaker'}
                      </span>
                      {u.bio && (
                        <p className="user-bio">
                          {(u.uid || u.id) === '6Djehd9KB8dTZUgVwVJfLoPI5dF3'
                            ? u.bio
                            : u.bio.split(' ').slice(0, 2).join(' ') + (u.bio.split(' ').length > 2 ? '...' : '')}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: '#888' }}>📞 {u.callCount || 0}</span>
                        <span style={{ fontSize: '11px', color: '#888' }}>🕐 {u.totalMinutes || 0} min</span>
                        {u.streak > 0 && <span style={{ fontSize: '11px', color: '#f59e0b' }}>🔥 {u.streak}</span>}
                        {u.ratingCount > 0 && <span style={{ fontSize: '11px', color: '#f59e0b' }}>⭐ {(u.rating / u.ratingCount).toFixed(1)}</span>}
                      </div>
                      {(() => {
                        const presence = getPresence(u);
                        const label = presence === 'busy' ? '📞 On a call'
                          : presence === 'online' ? '🟢 Online' : '⚫ Offline';
                        return <span className={`online-badge ${presence}`}>{label}</span>;
                      })()}
                    </div>

                    <button
                      className="btn-chat"
                      onClick={() => navigate(`/user/${u.uid || u.id}`)}
                    >
                      👀 View Profile
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <DailyTopicModal open={dailyTopicOpen} onClose={() => setDailyTopicOpen(false)} />
      <AnalysisReadyModal
        user={user}
        suppressed={streakModalOpen || showTopicIntro || dailyTopicOpen || journeyOpen || searching}
      />
      <StreakModal
        open={streakModalOpen}
        streakInfo={streakInfo}
        onClose={closeStreakModal}
        onOpenJourney={() => { setStreakModalOpen(false); setJourneyOpen(true); }}
      />
      <StreakJourney open={journeyOpen} streakInfo={streakInfo} onClose={closeJourney} />
    </div>
  );
}
