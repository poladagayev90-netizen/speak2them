import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, CalendarClock, ChevronRight, MessageCircle, FlaskConical } from 'lucide-react';
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
import { isAdminUser } from '../constants';
import { subscribeToUnreadTotal } from '../utils/chat';
import GuidedTour from '../components/GuidedTour';
import useFirstRunCopy from '../hooks/useFirstRunCopy';
import { isFirstDay } from '../utils/firstRunLang';
import CourseProgressCard from '../components/CourseProgressCard';
import CourseCompletionCelebration from '../components/CourseCompletionCelebration';
import SlotNoticeModal from '../components/SlotNoticeModal';
import IntroCard from '../components/IntroCard';
import SlotChangeBanner from '../components/SlotChangeBanner';
import NextPracticeCard from '../components/plan/NextPracticeCard';
import GetReadyCard from '../components/plan/GetReadyCard';
import TopicCard from '../components/plan/TopicCard';
import NextTopics from '../components/plan/NextTopics';
import ReadyTopics from '../components/plan/ReadyTopics';
import ThisWeekCard from '../components/plan/ThisWeekCard';
import MissReasonCard from '../components/plan/MissReason';
import WeekProfileCard from '../components/plan/WeekProfileCard';
import useMyPlan, { useAutoMode } from '../hooks/useMyPlan';
import { useBillingConfig } from '../hooks/usePackages';
import { outOfPractices, packageView } from '../utils/packages';
import useMyLessons, { useTeachingLessons } from '../hooks/useMyLessons';
import { lessonItems, teachingItems, mergeSchedule, PLATFORM_LABEL } from '../utils/tutorLessons';
import { plainTopic } from '../utils/topicLabel';
import { subscribeToMySlots, subscribeToSlotChange } from '../utils/practiceSlots';
import { planHeadline, openOffers, upcomingBookings, peerOf, comingUpLabel, weekGoal } from '../utils/planState';
import AvatarImage from '../components/ui/AvatarImage';
import '../components/ui/ui.css';
import '../components/plan/plan.css';

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
// Two cards, in the learner's own language — the tour is the end of the
// first run (utils/firstRunLang.js). Polad 2026-10-14: four cards on top of a
// streak pop-up and a topic pop-up was the first thing a newcomer met.
const HOME_TOUR_KEYS = [
  { target: '#tour-next', key: 'tour.next' },
  { target: '#tour-plan-tab', key: 'tour.plan' },
];

export default function Home({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t: tr } = useFirstRunCopy(user?.guideLanguage);
  const firstDay = isFirstDay(user);
  const tourSteps = useMemo(() => HOME_TOUR_KEYS.map(({ target, key }) => (
    { target, title: tr(`${key}.title`), content: tr(`${key}.text`) }
  )), [tr]);
  const tourLabels = useMemo(() => ({
    badge: tr('tour.badge'), skip: tr('tour.skip'), back: tr('tour.back'), next: tr('tour.next'), finish: tr('tour.finish'),
  }), [tr]);

  // The week: bookings, proposals, plan status, onboarding answers.
  const plan = useMyPlan(user.uid);
  // Packages: a quiet line on the card, only when the switch is on and nothing is left.
  const { config: billing } = useBillingConfig();
  const noPractices = outOfPractices(packageView({ user, summary: plan.planStatus?.access, config: billing }), billing);
  // Individual lessons (Preply / Meet) sit in the same "Coming up" list.
  const myLessons = useMyLessons(user.uid);
  // A teacher (or the admin) also sees the lessons they teach.
  const teaching = useTeachingLessons(user.uid, user.role === 'teacher' || isAdminUser(user));
  // The polite no-show notice and a partner's "change the time?" request
  // still live on the old slot documents.
  const [mine, setMine] = useState(null);
  const [slotChange, setSlotChange] = useState(null);
  useEffect(() => subscribeToMySlots(user.uid, setMine), [user.uid]);
  useEffect(() => subscribeToSlotChange(user.uid, setSlotChange), [user.uid]);

  const [dailyTopicOpen, setDailyTopicOpen] = useState(false);
  // null = today's topic; a number = one of the next topics, opened ahead.
  const [dailyTopicIndex, setDailyTopicIndex] = useState(null);
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

    // The first day: neither pop-up — the newcomer has just come through the
    // wizard and gets the short tour only. Both keys are marked as shown, so
    // neither appears later that evening either.
    if (firstDay) {
      localStorage.setItem(streakKey, '1');
      return;
    }

    if (streakDue) {
      setStreakModalOpen(true);
      setPendingTopicIntro(topicDue);
      localStorage.setItem(streakKey, '1');
    } else if (topicDue) {
      setShowTopicIntro(true);
    }
  }, [user.uid, firstDay]);

  const closeStreakModal = () => {
    setStreakModalOpen(false);
    if (pendingTopicIntro) { setShowTopicIntro(true); setPendingTopicIntro(false); }
  };
  const closeJourney = () => {
    setJourneyOpen(false);
    if (pendingTopicIntro) { setShowTopicIntro(true); setPendingTopicIntro(false); }
  };

  const autoMode = useAutoMode();
  const headline = planHeadline({ uid: user.uid, ...plan, autoMode });
  const open = openOffers(plan.offers, user.uid, plan.now);
  const booked = upcomingBookings(plan.bookings, plan.now);
  // This week's goal: the days picked for it, else the usual number.
  const target = weekGoal({
    onboarding: plan.onboarding, weekKey: plan.weekKey,
    limitTarget: plan.planStatus?.limit?.active ? plan.planStatus.limit.target : null,
  });
  // The hero already names the nearest booking; the list starts after it.
  // Lessons join it in time order, each going straight to its materials.
  const lessons = mergeSchedule(
    myLessons.active ? lessonItems(myLessons.lessons, plan.now) : [],
    teachingItems(teaching, plan.now),
  );
  // Lessons live in «Coming up» only (Polad 2026-10-12: a second picture card
  // next to today's topic made Today look crowded). The row names the lesson's
  // own topic, so it is not confused with the daily one, and opens /class/:id.
  const upcoming = mergeSchedule(booked.slice(headline.kind === 'next' ? 1 : 0), lessons);
  const comingUp = upcoming.slice(0, 3);
  // The next lesson always keeps a row, even behind three earlier practices.
  if (lessons[0] && !comingUp.includes(lessons[0])) comingUp[comingUp.length - 1] = lessons[0];

  return (
    <div className="home-page">
      <GuidedTour
        user={user}
        steps={tourSteps}
        labels={tourLabels}
        tourKey="tourDone_home_v3"
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
          {/* The admin's nav holds the panel; Partners and Lab live here. */}
          {isAdminUser(user) && <AdminHeaderLinks uid={user.uid} />}
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
        {/* A teacher (or the admin) is not a learner: no "set up your plan". */}
        {!plan.loading && !(headline.kind === 'setup' && (user.role === 'teacher' || isAdminUser(user))) && <NextPracticeCard uid={user.uid} headline={headline} now={plan.now} limit={plan.planStatus?.limit} noPractices={noPractices} onboarding={plan.onboarding} />}

        {/* «What happened?» after the learner's own miss or cancel, and —
            once — the general week profile for those already practising. */}
        <MissReasonCard uid={user.uid} onboarding={plan.onboarding} now={plan.now} />
        {!plan.loading && <WeekProfileCard user={user} onboarding={plan.onboarding} />}

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

        {/* Today's materials, right under the plan (Polad 2026-10-06: "they
            look good and they ARE the class"). Online now is on Partners only. */}
        <TopicCard topic={todayTopic} onOpen={() => { setDailyTopicIndex(null); setDailyTopicOpen(true); }} />
        {todayTopic && (
          <NextTopics
            todayIndex={weeklyContent.indexOf(todayTopic)}
            onOpen={(i) => { setDailyTopicIndex(i); setDailyTopicOpen(true); }}
          />
        )}
        {isAdminUser(user) && (
          <ReadyTopics onOpen={(i) => { setDailyTopicIndex(i); setDailyTopicOpen(true); }} />
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
                      <p className="pl-row-sub">{b.teaching ? `${b.studentName} · ` : ''}{comingUpLabel(b.startMs, plan.now)} · {PLATFORM_LABEL[b.platform] || 'Preply'}</p>
                    </span>
                    <ChevronRight size={18} className="pl-row-end" aria-hidden="true" />
                  </button>
                );
              }
              const { peerName } = peerOf(b, user.uid);
              return (
                <button key={b.id} type="button" className="pl-row" onClick={() => navigate('/plan', { state: { openBooking: b.id } })}>
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

      <DailyTopicModal open={dailyTopicOpen} onClose={() => { setDailyTopicOpen(false); setDailyTopicIndex(null); }} user={user} topicIndex={dailyTopicIndex} />
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

// Partners (with the unread count the nav button used to carry) and Lab, for
// the admin, whose bottom nav is the admin's work instead.
function AdminHeaderLinks({ uid }) {
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  useEffect(() => subscribeToUnreadTotal(uid, setUnread), [uid]);
  return (
    <>
      <button type="button" className="home-icon-btn" onClick={() => navigate('/chats')} aria-label={unread ? `Partners, ${unread} unread` : 'Partners'}>
        <MessageCircle size={20} aria-hidden="true" />
        {unread > 0 && <span className="home-icon-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      <button type="button" className="home-icon-btn" onClick={() => navigate('/lab')} aria-label="Lab">
        <FlaskConical size={20} aria-hidden="true" />
      </button>
    </>
  );
}
