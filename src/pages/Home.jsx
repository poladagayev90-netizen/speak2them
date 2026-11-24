import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, ChevronRight, MessageCircle, FlaskConical, Trophy, MonitorPlay } from 'lucide-react';
import TeacherInviteBanner from '../components/TeacherInviteBanner';
import DailyTopicModal from '../components/DailyTopicModal';
import NotificationPrompt from '../components/NotificationPrompt';
import StreakModal from '../components/StreakModal';
import StreakJourney from '../components/StreakJourney';
import { getStreakInfo } from '../utils/streak';
import { getTodayContent, weeklyContent } from '../data/weeklyContent';
import { subscribeToCycle } from '../utils/cycle';
import AnalysisReadyModal from '../components/AnalysisReadyModal';
import AcademyPopupModal from '../components/AcademyPopupModal';
import GuestPromptCard from '../components/GuestPromptCard';
import Logo from '../components/Logo';
import { isAdminUser } from '../constants';
import { subscribeToUnreadTotal } from '../utils/chat';
import GuidedTour from '../components/GuidedTour';
import useFirstRunCopy from '../hooks/useFirstRunCopy';
import { isFirstDay } from '../utils/firstRunLang';
import { openAcademy } from '../utils/academyLink';
import { shouldShowAcademyPopup, markAcademyPopupShown } from '../utils/academyPopup';
import { checkRemoteAcademyOpened } from '../utils/academyProgress';
import { isGuestUser } from '../utils/guest';
import CourseProgressCard from '../components/CourseProgressCard';
import CourseCompletionCelebration from '../components/CourseCompletionCelebration';
import SlotNoticeModal from '../components/SlotNoticeModal';
import SlotChangeBanner from '../components/SlotChangeBanner';
import NextPracticeCard from '../components/plan/NextPracticeCard';
import MatchOfferCard from '../components/MatchOfferCard';
import GetReadyCard from '../components/plan/GetReadyCard';
import { TopicCardDeck } from '../components/plan/TopicCard';
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
import { planHeadline, upcomingBookings, peerOf, comingUpLabel, weekGoal } from '../utils/planState';
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
// Polad 2026-10-17 (ads start the next day): only the essentials, and the
// leaderboard must be seen — six stops, all on Today or its tab bar, so the
// tour never has to change page.
const HOME_TOUR_KEYS = [
  { target: '#tour-next', key: 'tour.next' },
  { target: '#tour-topic', key: 'tour.topic' },
  { target: '#tour-ai-chat', key: 'tour.ai' },
  { target: '#tour-lab-tab', key: 'tour.lab' },
  { target: '#tour-leaderboard', key: 'tour.board' },
  { target: '#tour-partners-tab', key: 'tour.partners' },
];

export default function Home({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isGuest = isGuestUser(user);
  const uid = isGuest ? null : user.uid;
  // `lang` also dresses the practice-path cards below (data/practiceCopy.js):
  // the plan card, the usual-week card and the topic card's chrome follow the
  // learner's first-run language, Profile → App language changes it.
  const { t: tr, lang } = useFirstRunCopy(user?.guideLanguage);
  const firstDay = !isGuest && isFirstDay(user);
  const tourSteps = useMemo(() => HOME_TOUR_KEYS.map(({ target, key }) => (
    { target, title: tr(`${key}.title`), content: tr(`${key}.text`) }
  )), [tr]);
  const tourLabels = useMemo(() => ({
    badge: tr('tour.badge'), skip: tr('tour.skip'), back: tr('tour.back'), next: tr('tour.next'), finish: tr('tour.finish'),
  }), [tr]);

  // The week: bookings, proposals, plan status, onboarding answers.
  const plan = useMyPlan(uid);
  // Packages: a quiet line on the card, only when the switch is on and nothing is left.
  const { config: billing } = useBillingConfig(!isGuest);
  const noPractices = !isGuest && outOfPractices(packageView({ user, summary: plan.planStatus?.access, config: billing }), billing);
  // Individual lessons (Preply / Meet) sit in the same "Coming up" list.
  const myLessons = useMyLessons(uid);
  // A teacher (or the admin) also sees the lessons they teach.
  const teaching = useTeachingLessons(uid, !isGuest && (user.role === 'teacher' || isAdminUser(user)));
  // The polite no-show notice and a partner's "change the time?" request
  // still live on the old slot documents.
  const [mine, setMine] = useState(null);
  const [slotChange, setSlotChange] = useState(null);
  useEffect(() => {
    if (!uid) return undefined;
    return subscribeToMySlots(uid, setMine);
  }, [uid]);
  useEffect(() => {
    if (!uid) return undefined;
    return subscribeToSlotChange(uid, setSlotChange);
  }, [uid]);

  const [dailyTopicOpen, setDailyTopicOpen] = useState(false);
  // null = today's topic; a number = one of the next topics, opened ahead.
  const [dailyTopicIndex, setDailyTopicIndex] = useState(null);
  const [showTopicIntro, setShowTopicIntro] = useState(false);
  const [todayTopic, setTodayTopic] = useState(null);
  const [streakModalOpen, setStreakModalOpen] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [academyPopupOpen, setAcademyPopupOpen] = useState(false);
  const [pendingTopicIntro, setPendingTopicIntro] = useState(false);
  const [streakInfo] = useState(() => (isGuest ? { count: 0, alive: false, doneToday: false } : getStreakInfo(user)));

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
  useEffect(() => {
    if (isGuest) {
      setTodayTopic(getTodayContent());
      return undefined;
    }
    return subscribeToCycle(() => setTodayTopic(getTodayContent()));
  }, [isGuest]);

  useEffect(() => {
    if (isGuest || !uid) return;
    const todayDateStr = new Date().toDateString();

    const topicKey = `lastTopicIntroDate_v2_${uid}`;
    const topicDue = localStorage.getItem(topicKey) !== todayDateStr;
    if (topicDue) localStorage.setItem(topicKey, todayDateStr);

    // The streak celebration takes the stage first; the topic intro waits until
    // it closes so two full-screen modals never stack.
    const streakKey = `streak_modal_shown_${todayDateStr}_${uid}`;
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
  }, [isGuest, uid, firstDay]);

  const tourCompleted = useMemo(() => {
    if (!uid) return false;
    if (user?.tourDone_home_v4 === true) return true;
    try { return localStorage.getItem(`speak2them:guided-tour:${uid}:tourDone_home_v4`) === 'true'; } catch { return false; }
  }, [uid, user?.tourDone_home_v4]);

  useEffect(() => {
    if (isGuest || !uid) return undefined;
    if (firstDay && !tourCompleted) return undefined;
    if (streakModalOpen || showTopicIntro || dailyTopicOpen || journeyOpen || mine?.slotNoticePending) return undefined;
    if (!shouldShowAcademyPopup(user)) return undefined;
    let alive = true;
    checkRemoteAcademyOpened(user.uid).then((alreadyOpened) => {
      if (!alive || alreadyOpened) return;
      if (!shouldShowAcademyPopup(user)) return;
      setAcademyPopupOpen(true);
      markAcademyPopupShown(user.uid);
    });
    return () => { alive = false; };
  }, [isGuest, uid, firstDay, tourCompleted, user, streakModalOpen, showTopicIntro, dailyTopicOpen, journeyOpen, mine?.slotNoticePending]);

  const closeStreakModal = () => {
    setStreakModalOpen(false);
    if (pendingTopicIntro) { setShowTopicIntro(true); setPendingTopicIntro(false); }
  };
  const closeJourney = () => {
    setJourneyOpen(false);
    if (pendingTopicIntro) { setShowTopicIntro(true); setPendingTopicIntro(false); }
  };

  const autoMode = useAutoMode(!isGuest);
  const headline = isGuest ? { kind: 'guest' } : planHeadline({ uid, ...plan, autoMode });
  const booked = isGuest ? [] : upcomingBookings(plan.bookings, plan.now);
  // This week's goal: the days picked for it, else the usual number.
  const target = isGuest ? 0 : weekGoal({
    onboarding: plan.onboarding, weekKey: plan.weekKey,
    limitTarget: plan.planStatus?.limit?.active ? plan.planStatus.limit.target : null,
  });
  // The hero already names the nearest booking; the list starts after it.
  // Lessons join it in time order, each going straight to its materials.
  const lessons = isGuest ? [] : mergeSchedule(
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
      {!isGuest && (
        <GuidedTour
          user={user}
          steps={tourSteps}
          labels={tourLabels}
          tourKey="tourDone_home_v4"
          disabled={showTopicIntro || dailyTopicOpen || streakModalOpen || journeyOpen || academyPopupOpen}
        />
      )}
      {!isGuest && showTopicIntro && todayTopic && (
        <div className="topic-intro-overlay">
          <div className="topic-intro-modal">
            <h3 className="topic-intro-label">Today’s topic</h3>
            <h1 className="topic-intro-title">{plainTopic(todayTopic.topic)}</h1>
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
          {!isGuest && isAdminUser(user) && <AdminHeaderLinks uid={user.uid} />}
          <button type="button" className="home-avatar" onClick={() => navigate('/profile')} aria-label="Profile">
            {(user.name || '?').charAt(0).toUpperCase()}
            {!isGuest && <AvatarImage src={user.photo} />}
          </button>
        </div>
      </div>

      <div className="home-body">
        {isGuest ? (
          <GuestPromptCard variant="hero" guideLanguage={user.guideLanguage} />
        ) : (
          <>
            <TeacherInviteBanner user={user} />
            <CourseCompletionCelebration user={user} />

            {/* A polite nudge, never a punishment. The community is small; banning
                people for a missed slot would empty it. */}
            {mine?.slotNoticePending && <SlotNoticeModal uid={user.uid} />}

            {/* An unanswered question belongs at the top of the screen. */}
            <SlotChangeBanner request={slotChange} onDone={() => setSlotChange(null)} />
            {/* Up here, not at the bottom (2026-11-17, Polad: nobody scrolled to
                it). Shows only until the permission is answered or dismissed. */}
            <NotificationPrompt user={user} />

            {/* 0. A proposal waiting for this learner's yes, as the answer card
                itself (2026-11-10: Today showed only «Your next practice» and
                the question sat on Plan below the week grid — Polad could not
                find it). «Your next practice» is a two-yes booking only. */}
            <MatchOfferCard uid={user.uid} />

            {/* 1. The next practice, or what is happening instead. */}
            {/* A teacher (or the admin) is not a learner: no "set up your plan".
                «N need your answer» is not repeated: the cards above ARE that. */}
            {!plan.loading && headline.kind !== 'answer' && !(headline.kind === 'setup' && (user.role === 'teacher' || isAdminUser(user))) && <NextPracticeCard uid={user.uid} headline={headline} now={plan.now} limit={plan.planStatus?.limit} noPractices={noPractices} onboarding={plan.onboarding} hasPartners={(user.callCount || 0) > 0} lang={lang} />}

            {/* «What happened?» after the learner's own miss or cancel, and —
                once — the general week profile for those already practising. */}
            <MissReasonCard uid={user.uid} onboarding={plan.onboarding} now={plan.now} />
            {!plan.loading && <WeekProfileCard user={user} onboarding={plan.onboarding} lang={lang} />}
          </>
        )}

        {/* Today's materials, right under the plan (Polad 2026-10-06: "they
            look good and they ARE the class"). Swipe left to preview upcoming
            topics so Leaderboard + Academy stay above the phone fold. */}
        <TopicCardDeck
          todayTopic={todayTopic}
          todayIndex={todayTopic ? weeklyContent.indexOf(todayTopic) : -1}
          lang={lang}
          isGuest={isGuest}
          onOpen={(idx) => { setDailyTopicIndex(idx); setDailyTopicOpen(true); }}
        />
        {!isGuest && isAdminUser(user) && (
          <ReadyTopics onOpen={(i) => { setDailyTopicIndex(i); setDailyTopicOpen(true); }} />
        )}

        {/* 2b. The next few booked practices and individual lessons, as a
            tutor's "Next lessons" list: who and when at a glance, a lesson one
            tap from its materials, the whole schedule one tap away. */}
        {!isGuest && comingUp.length > 0 && (
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

        {/* Leaderboard and SpeakLab Academy share one row above Get ready so
            newcomers notice the video guides right away. */}
        <div className="pl-quick-row">
          <button
            id="tour-leaderboard"
            type="button"
            className="pl-quick-tile"
            onClick={() => navigate('/ranking')}
          >
            <span className="pl-quick-top">
              <span className="pl-row-icon" aria-hidden="true"><Trophy size={18} /></span>
              <ChevronRight size={16} className="pl-row-end" aria-hidden="true" />
            </span>
            <span className="pl-quick-main">
              <p className="pl-row-title">Leaderboard</p>
              <p className="pl-row-sub">Weekly club</p>
            </span>
          </button>
          <button
            id="tour-academy"
            type="button"
            className="pl-quick-tile"
            onClick={() => openAcademy(navigate, uid)}
          >
            <span className="pl-quick-top">
              <span className="pl-row-icon" aria-hidden="true"><MonitorPlay size={18} /></span>
              <ChevronRight size={16} className="pl-row-end" aria-hidden="true" />
            </span>
            <span className="pl-quick-main">
              <p className="pl-row-title">Academy</p>
              <p className="pl-row-sub">Video guides</p>
            </span>
          </button>
        </div>

        {/* 3. Preparation — below the practice it prepares you for. The
            topic is a picture card so Today is not only text. */}
        <GetReadyCard user={user} />

        {/* 4. The week in one line. */}
        {!isGuest && target > 0 && (
          <ThisWeekCard
            uid={user.uid}
            target={target}
            attended={plan.attended}
            bookings={booked.filter((b) => b.weekKey === plan.weekKey)}
            skipFirst={headline.kind === 'next'}
            now={plan.now}
          />
        )}

        {/* Course standing sits BELOW the actions: a status note must never
            push the things you can actually do down the screen. */}
        {!isGuest && <CourseProgressCard user={user} />}
      </div>

      <DailyTopicModal
        open={dailyTopicOpen}
        onClose={() => { setDailyTopicOpen(false); setDailyTopicIndex(null); }}
        user={user}
        topicIndex={dailyTopicIndex}
        todayIndex={todayTopic ? weeklyContent.indexOf(todayTopic) : -1}
        onSelectTopic={(idx) => setDailyTopicIndex(idx)}
      />
      {!isGuest && (
        <>
          <AnalysisReadyModal
            user={user}
            suppressed={streakModalOpen || showTopicIntro || dailyTopicOpen || journeyOpen || academyPopupOpen}
          />
          <AcademyPopupModal
            open={academyPopupOpen}
            user={user}
            onClose={() => setAcademyPopupOpen(false)}
          />
          <StreakModal
            open={streakModalOpen}
            streakInfo={streakInfo}
            onClose={closeStreakModal}
            onOpenJourney={() => { setStreakModalOpen(false); setJourneyOpen(true); }}
          />
          <StreakJourney open={journeyOpen} streakInfo={streakInfo} onClose={closeJourney} />
        </>
      )}
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
