import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, BookOpen, CalendarClock, ChevronRight } from 'lucide-react';
import TeacherInviteBanner from '../components/TeacherInviteBanner';
import DailyTopicModal from '../components/DailyTopicModal';
import NotificationPrompt from '../components/NotificationPrompt';
import StreakModal from '../components/StreakModal';
import StreakJourney from '../components/StreakJourney';
import { getStreakInfo } from '../utils/streak';
import { getTodayContent, weeklyContent } from '../data/weeklyContent';
import { subscribeToCycle } from '../utils/cycle';
import AnalysisReadyModal from '../components/AnalysisReadyModal';
import Logo from '../components/Logo';
import { ADMIN_UID } from '../constants';
import GuidedTour from '../components/GuidedTour';
import CourseProgressCard from '../components/CourseProgressCard';
import CourseCompletionCelebration from '../components/CourseCompletionCelebration';
import SlotNoticeModal from '../components/SlotNoticeModal';
import IntroCard from '../components/IntroCard';
import SlotChangeBanner from '../components/SlotChangeBanner';
import NextPracticeCard from '../components/plan/NextPracticeCard';
import GetReadyCard from '../components/plan/GetReadyCard';
import TopicCard from '../components/plan/TopicCard';
import ThisWeekCard from '../components/plan/ThisWeekCard';
import useMyPlan from '../hooks/useMyPlan';
import useMyLessons from '../hooks/useMyLessons';
import { lessonItems, mergeSchedule, PLATFORM_LABEL } from '../utils/tutorLessons';
import { plainTopic } from '../utils/topicLabel';
import { subscribeToMySlots, subscribeToSlotChange } from '../utils/practiceSlots';
import { planHeadline, openOffers, upcomingBookings, peerOf, comingUpLabel } from '../utils/planState';
import Button from '../components/ui/Button';
import AvatarImage from '../components/ui/AvatarImage';
import '../components/ui/ui.css';
import '../components/plan/plan.css';

const LESSON_CARD_MS = 48 * 60 * 60 * 1000;

// Today: what to do now.
//
// Practice is planned now (the weekly plan, Phase 3 of the scheduled-practice
// plan), so this screen no longer sends anyone looking for a partner who
// happens to be online — that promise ("open the app, talk to someone") was
// the one it kept breaking. It answers one question, in this order:
//   1. your next practice — or, honestly, why there is none yet;
//   2. proposals waiting for your yes (when the card above is a booking);
//   3. get ready — today's topic, a warm-up with AInur, the next lesson;
//   4. this week — the goal you set against what was held.
// Home and the Plan tab never show the same long list: Today is the next step,
// Plan is the whole week.
const HOME_TOUR_STEPS = [
  {
    target: '#tour-next',
    title: 'Your next practice',
    text: 'Your practices are planned for you every week. This card always shows the next one, or what is happening with your plan.',
  },
  {
    target: '#tour-topic',
    title: 'Today’s topic',
    text: 'Words, idioms and questions for today — open it before you talk.',
  },
  {
    target: '#tour-plan-tab',
    title: 'Your week',
    text: 'Confirm proposals, change a time, or edit your free times.',
  },
  {
    target: '#tour-ai-chat',
    title: 'AInur',
    text: 'Practise speaking any time, with or without a partner.',
  },
];

export default function Home({ user }) {
  const navigate = useNavigate();
  const location = useLocation();

  // The week: bookings, proposals, plan status, onboarding answers.
  const plan = useMyPlan(user.uid);
  // Individual lessons (Preply / Meet) sit in the same "Coming up" list.
  const myLessons = useMyLessons(user.uid);
  // The polite no-show notice and a partner's "change the time?" request
  // still live on the old slot documents.
  const [mine, setMine] = useState(null);
  const [slotChange, setSlotChange] = useState(null);
  useEffect(() => subscribeToMySlots(user.uid, setMine), [user.uid]);
  useEffect(() => subscribeToSlotChange(user.uid, setSlotChange), [user.uid]);

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

  const headline = planHeadline({ uid: user.uid, ...plan });
  const open = openOffers(plan.offers, user.uid, plan.now);
  const booked = upcomingBookings(plan.bookings, plan.now);
  const target = Number(plan.onboarding?.weeklyTarget) || 0;
  // The hero already names the nearest booking; the list starts after it.
  // Lessons join it in time order, each going straight to its materials.
  const lessons = myLessons.active ? lessonItems(myLessons.lessons, plan.now) : [];
  // The next lesson within two days gets its own picture card above the daily
  // topic (Sabina, 2026-10-03: she prepared the day before from Today's topic,
  // and by the lesson Today showed another one). A lesson's topic is fixed when
  // it is planned; the daily topic keeps moving for practice calls — the two
  // cards say which is which, and the lesson leaves the list below.
  const lessonCard = lessons.find((l) => l.startMs - plan.now <= LESSON_CARD_MS) || null;
  const comingUp = mergeSchedule(
    booked.slice(headline.kind === 'next' ? 1 : 0),
    lessons.filter((l) => l !== lessonCard),
  ).slice(0, 3);

  return (
    <div className="home-page">
      <GuidedTour
        user={user}
        steps={HOME_TOUR_STEPS}
        tourKey="tourDone_home_v2"
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
        {/* Profile left the nav for the Lab tab; it opens from here, with the
            admin shield beside it. */}
        <div className="home-header-right">
          {user.uid === ADMIN_UID && (
            <Button variant="secondary" size="sm" onClick={() => navigate('/admin')} icon={<Shield size={14} />}>
              Admin
            </Button>
          )}
          <button type="button" className="home-avatar" onClick={() => navigate('/profile')} aria-label="Profile">
            {(user.name || '?').charAt(0).toUpperCase()}
            <AvatarImage src={user.photo} />
          </button>
        </div>
      </div>

      <div className="home-body">
        <TeacherInviteBanner user={user} />
        <CourseCompletionCelebration user={user} />

        {/* A polite nudge, never a punishment. The community is small; banning
            people for a missed slot would empty it. */}
        {mine?.slotNoticePending && <SlotNoticeModal uid={user.uid} />}


        {/* An unanswered question belongs at the top of the screen. */}
        <SlotChangeBanner request={slotChange} onDone={() => setSlotChange(null)} />
        <IntroCard user={user} />

        {/* 1. The next practice, or what is happening instead. */}
        {!plan.loading && <NextPracticeCard uid={user.uid} headline={headline} now={plan.now} limit={plan.planStatus?.limit} />}

        {/* 2. Proposals, when the card above is already a booking. */}
        {headline.kind === 'next' && open.length > 0 && (
          <button type="button" className="pl-card pl-row" style={{ padding: 'var(--s-3) var(--s-4)' }} onClick={() => navigate('/plan')}>
            <span className="pl-row-icon" aria-hidden="true"><CalendarClock size={18} /></span>
            <span className="pl-row-main">
              <p className="pl-row-title">{open.length} {open.length === 1 ? 'practice needs' : 'practices need'} your answer</p>
              <p className="pl-row-sub">Review the plan</p>
            </span>
            <ChevronRight size={18} className="pl-row-end" aria-hidden="true" />
          </button>
        )}

        {lessonCard && (
          <TopicCard
            topic={weeklyContent[lessonCard.topicIndex]}
            kicker={`Lesson ${lessonCard.number} · ${comingUpLabel(lessonCard.startMs, plan.now)}`}
            lesson
            cta="Prepare for the lesson"
            onOpen={() => navigate(`/class/${lessonCard.id}`)}
          />
        )}

        {/* 2b. The next few booked practices and individual lessons, as a
            tutor's "Next lessons" list: who and when at a glance, a lesson one
            tap from its materials, the whole schedule one tap away. */}
        {comingUp.length > 0 && (
          <section className="pl-card pl-coming" aria-label="Coming up">
            <div className="pl-coming-head">
              <p className="ui-section-label" style={{ margin: 0 }}>Coming up</p>
              <button type="button" className="pl-coming-all" onClick={() => navigate('/plan')}>See all</button>
            </div>
            {comingUp.map((b) => {
              if (b.kind === 'lesson') {
                const topic = weeklyContent[b.topicIndex];
                return (
                  <button key={b.id} type="button" className="pl-row pl-row--lesson" onClick={() => navigate(`/class/${b.id}`)}>
                    <span className="pl-coming-avatar pl-coming-avatar--lesson" aria-hidden="true"><BookOpen size={18} /></span>
                    <span className="pl-row-main">
                      <p className="pl-row-title">Lesson {b.number}{topic ? ` · ${plainTopic(topic.topic)}` : ''}</p>
                      <p className="pl-row-sub">{comingUpLabel(b.startMs, plan.now)} · {PLATFORM_LABEL[b.platform] || 'Preply'}</p>
                    </span>
                    <ChevronRight size={18} className="pl-row-end" aria-hidden="true" />
                  </button>
                );
              }
              const { peerName } = peerOf(b, user.uid);
              return (
                <button key={b.id} type="button" className="pl-row" onClick={() => navigate('/plan')}>
                  <span className="pl-coming-avatar" aria-hidden="true">{peerName.charAt(0).toUpperCase()}</span>
                  <span className="pl-row-main">
                    <p className="pl-row-title">{peerName}</p>
                    <p className="pl-row-sub">{comingUpLabel(b.startMs, plan.now)}</p>
                  </span>
                  <ChevronRight size={18} className="pl-row-end" aria-hidden="true" />
                </button>
              );
            })}
          </section>
        )}

        {/* 3. Preparation — below the practice it prepares you for. The
            topic is a picture card so Today is not only text. */}
        <TopicCard topic={todayTopic} onOpen={() => setDailyTopicOpen(true)} />
        <GetReadyCard user={user} />

        {/* 4. The week in one line. */}
        {target > 0 && (
          <ThisWeekCard
            uid={user.uid}
            target={target}
            attended={plan.attended}
            bookings={booked.filter((b) => b.weekKey === plan.weekKey)}
            skipFirst={headline.kind === 'next'}
            now={plan.now}
          />
        )}

        <NotificationPrompt user={user} />

        {/* Course standing sits BELOW the actions: a status note must never
            push the things you can actually do down the screen. */}
        <CourseProgressCard user={user} />
      </div>

      <DailyTopicModal open={dailyTopicOpen} onClose={() => setDailyTopicOpen(false)} user={user} />
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
