import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, BookOpen, ChevronRight, Users } from 'lucide-react';
import TeacherInviteBanner from '../components/TeacherInviteBanner';
import DailyTopicModal from '../components/DailyTopicModal';
import NotificationPrompt from '../components/NotificationPrompt';
import StreakModal from '../components/StreakModal';
import StreakJourney from '../components/StreakJourney';
import { getStreakInfo } from '../utils/streak';
import TopicDecorations from '../components/TopicDecorations';
import { getTodayContent } from '../data/weeklyContent';
import { subscribeToCycle } from '../utils/cycle';
import AnalysisReadyModal from '../components/AnalysisReadyModal';
import Logo from '../components/Logo';
import { ADMIN_UID } from '../constants';
import GuidedTour from '../components/GuidedTour';
import CourseProgressCard from '../components/CourseProgressCard';
import DailyTopicBanner from '../components/DailyTopicBanner';
import CourseCompletionCelebration from '../components/CourseCompletionCelebration';
import SlotNoticeModal from '../components/SlotNoticeModal';
import UpcomingCallCard from '../components/UpcomingCallCard';
import SlotChangeBanner from '../components/SlotChangeBanner';
import LabBuddy from '../components/LabBuddy';
import TodayTaskCard from '../components/ai/TodayTaskCard';
import useLiveLobby from '../hooks/useLiveLobby';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import '../components/ui/ui.css';

// Today: what to do now.
//
// This screen used to BE the live lobby — partner search, the online-user grid,
// level filters and a practice-slot board, all in one 654-line component. Most
// of a new account's first screen was a grid of grey "Passed" time blocks, so
// the app opened by saying "there is nothing here, wait". All of that moved to
// the Live tab. What is left answers one question, and it always has an answer
// even when nobody else is around.
const HOME_TOUR_STEPS = [
  {
    target: '#tour-today-task',
    title: 'Start here',
    text: 'A short speaking session with AInur, ready every day. She listens, asks questions, and writes you a report afterwards.',
  },
  {
    target: '#tour-live',
    title: 'Talk to a real person',
    text: 'See who is around and start a call, or book a time and we will match you.',
  },
  {
    target: '#tour-daily-topic',
    title: 'Today’s topic',
    text: 'New words, idioms and ready-made questions — worth a look before you speak.',
  },
  {
    target: '#tour-ai-chat',
    title: 'AInur',
    text: 'Every practice activity lives here.',
  },
];

export default function Home({ user }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Shared with the Live tab: one set of subscriptions, two pages.
  const {
    onlineUsers, activeSearchers, mine, slotChange, setSlotChange,
    cancelBusy, cancelUpcoming, joinCallNow, openBoard,
  } = useLiveLobby(user);

  const [dailyTopicOpen, setDailyTopicOpen] = useState(false);
  const [showTopicIntro, setShowTopicIntro] = useState(false);
  const [todayTopic, setTodayTopic] = useState(null);
  const [streakModalOpen, setStreakModalOpen] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [pendingTopicIntro, setPendingTopicIntro] = useState(false);
  const [streakInfo] = useState(() => getStreakInfo(user));

  // The daily-question push deep-links to /?daily=1 — open the topic modal and
  // strip the param so a refresh or back does not reopen it.
  useEffect(() => {
    if (new URLSearchParams(location.search).get('daily')) {
      setDailyTopicOpen(true);
      navigate('/', { replace: true });
    }
  }, [location.search, navigate]);

  // todayTopic MUST track the server cycle rather than being captured once: on
  // a cold start the appConfig/cycle snapshot has not landed, so
  // getTodayContent() falls back to the local calendar formula and the intro
  // modal announces a different topic than the banner. Subscribing keeps every
  // surface on one truth.
  useEffect(() => subscribeToCycle(() => setTodayTopic(getTodayContent())), []);

  useEffect(() => {
    const todayDateStr = new Date().toDateString();

    const topicKey = `lastTopicIntroDate_v2_${user.uid}`;
    const topicDue = localStorage.getItem(topicKey) !== todayDateStr;
    if (topicDue) localStorage.setItem(topicKey, todayDateStr);

    // The streak celebration takes the stage first; the topic intro waits until
    // it closes so two full-screen modals never stack.
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

  const onlineCount = onlineUsers.length;
  const searchingCount = activeSearchers.length;

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
            <h3 className="topic-intro-label">Today’s topic</h3>
            <h1 className="topic-intro-title">{todayTopic.topic}</h1>
            <p className="topic-intro-desc">
              Look through the words, idioms and questions to get ready.
            </p>
            <div className="topic-intro-actions">
              <button
                className="topic-intro-btn-primary"
                onClick={() => { setShowTopicIntro(false); setDailyTopicOpen(true); }}
              >
                <BookOpen size={18} /> Start learning
              </button>
              <button className="topic-intro-btn-secondary" onClick={() => setShowTopicIntro(false)}>
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
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin')} icon={<Shield size={14} />}>
            Admin
          </Button>
        )}
      </div>

      <div className="home-body">
        <TeacherInviteBanner user={user} />
        <CourseCompletionCelebration user={user} />

        {/* A polite nudge, never a punishment. The community is small; banning
            people for a missed slot would empty it. */}
        {mine?.slotNoticePending && <SlotNoticeModal uid={user.uid} />}

        {/* The mascot leans in from the corner when it has something to say,
            then leaves. Home only — on every screen it stops being a character
            and becomes an obstacle. */}
        <LabBuddy user={user} mine={mine} onOpenBoard={openBoard} />

        {/* An unanswered question belongs at the top of the screen. */}
        <SlotChangeBanner request={slotChange} onDone={() => setSlotChange(null)} />

        {/* A confirmed appointment is the whole promise of the product —
            "someone is waiting for you at six" — so it outranks everything. */}
        <UpcomingCallCard
          call={mine?.upcomingCall}
          busy={cancelBusy}
          onJoin={joinCallNow}
          onCancel={cancelUpcoming}
        />

        {/* The point of the release: there is always something to practise,
            whether or not anyone else is online. */}
        <div id="tour-today-task">
          <TodayTaskCard topic={todayTopic?.topic} hasTeacher={!!user?.teacherId} />
        </div>

        {/* Live is a summary here, not the whole lobby. Violet, because the
            other end is a person; the card above is cyan for AInur. */}
        <Card
          tone="peer"
          padding="md"
          id="tour-live"
          onClick={() => navigate('/live')}
          style={{ marginBottom: 'var(--s-3)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 'var(--r-md)', flexShrink: 0,
              background: 'var(--peer-soft)', color: 'var(--peer)',
              display: 'grid', placeItems: 'center',
            }}>
              <Users size={22} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0, fontSize: 'var(--fs-h2)', fontWeight: 700,
                color: 'var(--text-primary)', lineHeight: 'var(--lh-tight)',
              }}>
                Talk to someone
              </p>
              <p style={{
                margin: '4px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)',
                lineHeight: 'var(--lh-body)',
              }}>
                {searchingCount > 0
                  ? `${searchingCount} ${searchingCount === 1 ? 'person is' : 'people are'} looking for a partner right now`
                  : onlineCount > 0
                    ? `${onlineCount} ${onlineCount === 1 ? 'person' : 'people'} online`
                    : 'Book a time and we will match you'}
              </p>
            </div>
            <ChevronRight size={20} strokeWidth={1.75} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </div>
        </Card>

        <div id="tour-daily-topic">
          <DailyTopicBanner user={user} onOpenTopic={() => setDailyTopicOpen(true)} />
        </div>

        <NotificationPrompt user={user} />

        {/* Course standing sits BELOW the actions: a status note must never
            push the things you can actually do down the screen. */}
        <CourseProgressCard user={user} />
      </div>

      <DailyTopicModal open={dailyTopicOpen} onClose={() => setDailyTopicOpen(false)} />
      <AnalysisReadyModal
        user={user}
        suppressed={streakModalOpen || showTopicIntro || dailyTopicOpen || journeyOpen}
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
