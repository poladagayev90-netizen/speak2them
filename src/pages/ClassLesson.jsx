import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { db } from '../firebase';
import { weeklyContent } from '../data/weeklyContent';
import { plainTopic } from '../utils/topicLabel';
import { atMs, byDate, episodeFor, lessonWhen, PLATFORM_LABEL } from '../utils/tutorLessons';
// ui.css (Button) before plan.css (TopicCard), the order the rest of the app
// imports them in — CSS chunks must agree on it or the build refuses.
import Button from '../components/ui/Button';
import TopicCard from '../components/plan/TopicCard';
import DailyTopicModal from '../components/DailyTopicModal';
import '../components/homework/homework.css';
import '../components/cohort/cohort.css';
import { StoryDilemma, StoryListening, StoryQuestions, StoryReading } from '../components/story/StoryEpisode';

// One individual lesson, for the learner (/class/:lessonId). Before the lesson
// it is the preparation: the topic sheet — the same one the teacher shares in
// the lesson — and the lesson's Julian episode (shared by the learner's level,
// once approved): the listening reveals what Julian chose last time, the
// reading ends on a new dilemma, and the lesson debates it. The topic stays
// the same until the lesson is held; then the page points to the homework, and
// the Today card moves on to the next lesson.
export default function ClassLesson({ user }) {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(undefined);
  const [lessons, setLessons] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [level, setLevel] = useState(null);
  const [chapter, setChapter] = useState(null);
  const uid = user?.uid;

  useEffect(() => onSnapshot(
    doc(db, 'tutorLessons', lessonId),
    (snap) => setLesson(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    () => setLesson(null)
  ), [lessonId]);
  // All of this learner's lessons, to know which episode/lesson number this is.
  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(
      query(collection(db, 'tutorLessons'), where('uid', '==', uid)),
      (snap) => setLessons(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byDate)),
      () => setLessons([])
    );
  }, [uid]);
  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(doc(db, 'tutorStudents', uid), (snap) => setLevel(snap.exists() ? snap.get('level') : null), () => setLevel(null));
  }, [uid]);

  // The episode for this lesson's number at the learner's level. The rules
  // hide drafts, so an error just means it is not ready yet.
  const number = lesson ? episodeFor(lesson, lessons) : null;
  const chapterId = level && number ? `${level}_${number}` : null;
  useEffect(() => {
    if (!chapterId) { setChapter(null); return undefined; }
    return onSnapshot(
      doc(db, 'storyChapters', chapterId),
      (snap) => setChapter(snap.exists() && snap.get('status') === 'approved' ? snap.data() : null),
      () => setChapter(null)
    );
  }, [chapterId]);

  const back = <button type="button" className="hw-back" onClick={() => navigate('/')} aria-label="Back"><ArrowLeft size={20} /></button>;
  if (lesson === undefined) return <div className="hw-page"><p className="hw-lead">Loading…</p></div>;
  if (!lesson || lesson.uid !== uid) {
    return <div className="hw-page">{back}<p className="hw-lead">This lesson is not available.</p></div>;
  }

  const topic = Number.isInteger(lesson.topicIndex) ? weeklyContent[lesson.topicIndex] : null;
  const { status } = lesson;
  const link = lesson.link || '';

  return (
    <div className="hw-page">
      <header className="hw-head">
        {back}
        <div className="hw-titles">
          <h1 className="hw-title">{status === 'cancelled' ? 'Cancelled lesson' : `Lesson ${number}`}</h1>
          <p className="hw-topic">
            {lessonWhen(atMs(lesson))} · {PLATFORM_LABEL[lesson.platform] || 'Preply'}
            {status === 'planned' && lesson.movedCount > 0 && ' · new time'}
          </p>
        </div>
      </header>

      {status === 'cancelled' && (
        <p className="hw-lead">This lesson was cancelled. Your next lesson is on the Today screen.</p>
      )}

      {status === 'planned' && link && (
        <a className="cls-join cls-join--wide" href={link} target="_blank" rel="noopener noreferrer">
          Join the lesson <ExternalLink size={16} aria-hidden="true" />
        </a>
      )}

      {status === 'held' && (
        <Button full onClick={() => navigate(`/homework/${lesson.id}`)}>Open the homework</Button>
      )}

      {topic && status !== 'cancelled' && (
        <section className="hw-body">
          <p className="hw-lead">
            {status === 'held'
              ? <>This lesson was about <b>{plainTopic(topic.topic)}</b>.</>
              : <>Before the lesson: learn the words, say them out loud, and think about the questions. Your teacher will use this sheet in the lesson.</>}
          </p>
          <TopicCard topic={topic} kicker="Your lesson’s topic" onOpen={() => setSheetOpen(true)} />
        </section>
      )}

      {chapter && status !== 'cancelled' && (
        <section className="hw-body" aria-label="Julian's story">
          <h2 className="hw-sub">Julian’s story · Episode {number}</h2>
          <p className="hw-lead">
            {number > 1 ? 'Last time Julian had to choose. Listen first and find out what happened.' : 'Meet Julian. Listen first, then read the episode.'}
          </p>
          <StoryListening chapter={chapter} />
          <p className="hw-lead"><b>{chapter.title}</b>. Read it, or listen while you read. Tap a marked phrase for its meaning.</p>
          <StoryReading chapter={chapter} />
          <StoryQuestions chapter={chapter} />
          <StoryDilemma chapter={chapter} />
          {status === 'planned' && <p className="hw-lead">Think about both sides. You will talk about this in the lesson.</p>}
        </section>
      )}

      <DailyTopicModal open={sheetOpen} onClose={() => setSheetOpen(false)} user={user} topicIndex={lesson.topicIndex} />
    </div>
  );
}
