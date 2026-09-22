import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, BookOpen, Users } from 'lucide-react';
import TeacherInviteBanner from '../components/TeacherInviteBanner';
import DailyTopicModal from '../components/DailyTopicModal';
import NotificationPrompt from '../components/NotificationPrompt';
import StreakModal from '../components/StreakModal';
import StreakJourney from '../components/StreakJourney';
import { getStreakInfo } from '../utils/streak';
import { getTodayContent } from '../data/weeklyContent';
import { subscribeToCycle } from '../utils/cycle';
import AnalysisReadyModal from '../components/AnalysisReadyModal';
import Logo from '../components/Logo';
import { ADMIN_UID } from '../constants';
import GuidedTour from '../components/GuidedTour';
import CourseProgressCard from '../components/CourseProgressCard';
import CourseCompletionCelebration from '../components/CourseCompletionCelebration';
import SlotNoticeModal from '../components/SlotNoticeModal';
import UpcomingCallCard from '../components/UpcomingCallCard';
import MatchOfferCard from '../components/MatchOfferCard';
import IntroCard from '../components/IntroCard';
import WeekGoalCard from '../components/WeekGoalCard';
import SlotChangeBanner from '../components/SlotChangeBanner';
import TodayNudge from '../components/TodayNudge';
import TodayTaskCard from '../components/ai/TodayTaskCard';
import TodayMore from '../components/TodayMore';
import { needsIntro } from '../utils/intro';
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
    cancelBusy, cancelUpcoming, joinCallNow,
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

  // ONE next step, chosen by where the learner is. Everything else goes into
  // the quiet "More for today" list below it.
  //   1. someone is searching right now -> join them (they wait a minute or two)
  //   2. the intro call is still to do   -> it is what opens live practice
  //   3. otherwise                       -> today's AInur session, always there
  // Appointments, offers and slot changes still sit ABOVE the hero: they are
  // promises to another person, not suggestions.
  const introFirst = needsIntro(user);
  const hero = searchingCount > 0 && !introFirst ? 'live' : introFirst ? 'intro' : 'ainur';
  const openLive = () => navigate('/live', {
    // Nobody around? Then the useful thing on the Live tab is the calendar,
    // not the empty people list — open it on arrival.
    state: (searchingCount + onlineCount) === 0 && !introFirst ? { openBoard: true } : undefined,
  });
  const liveSummary = introFirst
    ? 'Opens after your intro call'
    : onlineCount > 0
      ? `${onlineCount} ${onlineCount === 1 ? 'person' : 'people'} online`
      : 'Book a time and we will match you';

  return (
    <div className="home-page">
      <GuidedTour
        user={user}
        steps={HOME_TOUR_STEPS}
        tourKey="tourDone_home"
        disabled={showTopicIntro || dailyTopicOpen || streakModalOpen || journeyOpen}
      />
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


        {/* An unanswered question belongs at the top of the screen. */}
        <SlotChangeBanner request={slotChange} onDone={() => setSlotChange(null)} />

        {/* A confirmed appointment is the whole promise of the product —
            "someone is waiting for you at six" — so it outranks everything. */}
        {/* A proposal waiting for this learner's yes sits right above the
            bookings it turns into. */}
        <MatchOfferCard uid={user?.uid} />
        <UpcomingCallCard
          call={mine?.upcomingCall}
          busy={cancelBusy}
          onJoin={joinCallNow}
          onCancel={cancelUpcoming}
        />

        {/* The weekly commitment from onboarding against what happened. */}
        <WeekGoalCard user={user} />

        {hero === 'intro' && <IntroCard user={user} />}

        {/* The point of the release: there is always something to practise,
            whether or not anyone else is online. */}
        {hero === 'ainur' && (
          <div id="tour-today-task">
            <TodayTaskCard topic={todayTopic?.topic} hasTeacher={!!user?.teacherId} />
          </div>
        )}

        {/* Somebody is searching right now: joining them IS the next step. The
            card says so with a live dot and a button, because they only wait a
            minute or two. The deep purple, because the other end is a person. */}
        {hero === 'live' && (
          <Card
            tone="peer"
            padding="md"
            id="tour-live"
            onClick={openLive}
            style={{ marginBottom: 'var(--s-3)', borderColor: 'var(--accent)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
              <div style={{
                position: 'relative',
                width: 44, height: 44, borderRadius: 'var(--r-md)', flexShrink: 0,
                background: 'var(--peer-soft)', color: 'var(--peer)',
                display: 'grid', placeItems: 'center',
              }}>
                <Users size={22} strokeWidth={1.75} aria-hidden="true" />
                <span className="live-dot" aria-hidden="true" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0, fontSize: 'var(--fs-h2)', fontWeight: 700,
                  color: 'var(--text-primary)', lineHeight: 'var(--lh-tight)',
                }}>
                  Talk to someone
                </p>
                <p style={{
                  margin: '4px 0 0', fontSize: 'var(--fs-sm)', fontWeight: 600,
                  color: 'var(--accent)', lineHeight: 'var(--lh-body)',
                }}>
                  {`${searchingCount} ${searchingCount === 1 ? 'person is waiting' : 'people are waiting'} right now — join and you connect immediately`}
                </p>
              </div>
              <span style={{
                flexShrink: 0, padding: '8px 14px', borderRadius: 'var(--r-pill)',
                background: 'var(--accent)', color: 'var(--text-on-accent)',
                fontSize: 'var(--fs-sm)', fontWeight: 700, whiteSpace: 'nowrap',
              }}>
                Join
              </span>
            </div>
          </Card>
        )}

        {/* A quiet contextual prompt, in the flow rather than floating over it,
            and BELOW the main action -- a nudge must never outrank the thing it
            is nudging you towards. */}
        <TodayNudge user={user} mine={mine} />

        <TodayMore
          user={user}
          showAinur={hero !== 'ainur'}
          live={hero === 'live' ? null : { text: liveSummary, onClick: openLive }}
          onOpenTopic={() => setDailyTopicOpen(true)}
        />

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
