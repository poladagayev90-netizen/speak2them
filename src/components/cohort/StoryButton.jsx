import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { BookOpen } from 'lucide-react';
import { db } from '../../firebase';
import { authedFetch } from '../../api';
import { FUNCTIONS_BASE } from '../../constants';
import { weeklyContent } from '../../data/weeklyContent';
import { localMeaning } from '../../utils/feedbackLanguage';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';
import StoryEpisode from '../story/StoryEpisode';
import './cohort.css';

const STATUS_LABEL = { generating: 'Writing…', draft: 'To review', approved: 'Story ready', failed: 'Failed' };

// One lesson's episode of the Julian story, for the teacher: write it (the
// server tells beat n of the bible inside this lesson's topic), read the draft
// with its audio, then approve — or rewrite. Learners see it only once approved.
export default function StoryButton({ cohortId, lesson }) {
  const [chapter, setChapter] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = `${cohortId}_${lesson.n}`;

  // A chapter that does not exist yet is unreadable under the rules (they look
  // at its cohortId), so an error simply means "not written".
  useEffect(() => onSnapshot(
    doc(db, 'storyChapters', id),
    (snap) => setChapter(snap.exists() ? snap.data() : null),
    () => setChapter(null)
  ), [id]);

  const topic = Number.isInteger(lesson.topicIndex) ? weeklyContent[lesson.topicIndex] : null;
  if (!topic) return null;

  const call = async (action) => {
    setBusy(true); setError('');
    const words = [
      ...(topic.vocabulary || []).map((v) => ({ word: v.word, meaning: localMeaning(v, 'az') })),
      ...(topic.idioms || []).map((v) => ({ word: v.phrase, meaning: localMeaning(v, 'az') })),
    ];
    try {
      const res = await authedFetch(`${FUNCTIONS_BASE}/teacherStory`, {
        method: 'POST',
        body: JSON.stringify({ cohortId, n: lesson.n, action, topic: { title: topic.topic, words } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({
          busy: 'This episode is already being written.',
          already_approved: 'This episode is already approved.',
          rate_limited: 'Too many episodes this hour. Try again later.',
        }[data.error] || 'Could not write the episode. Try again.');
      }
    } catch {
      setError('Could not reach the server. Check the connection.');
    }
    setBusy(false);
  };

  const status = chapter?.status || null;
  const writing = busy || status === 'generating';
  const hasDraft = status === 'draft' || status === 'approved';

  return (
    <>
      <button type="button" className={`cc-story${status ? ` cc-story--${status}` : ''}`} onClick={() => setOpen(true)}>
        <BookOpen size={14} aria-hidden="true" />
        {STATUS_LABEL[status] || 'Story'}
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`Episode ${lesson.n}${chapter?.title && hasDraft ? ` · ${chapter.title}` : ''}`}
        footer={status === 'approved' ? null : (
          <div className="cc-story-foot">
            {hasDraft && (
              <Button variant="secondary" disabled={writing} onClick={() => call('generate')}>Rewrite</Button>
            )}
            {hasDraft
              ? <Button disabled={writing} onClick={() => call('approve')}>Approve for the class</Button>
              : <Button full disabled={writing} onClick={() => call('generate')}>{writing ? 'Writing… about a minute' : `Write episode ${lesson.n}`}</Button>}
          </div>
        )}
      >
        <p className="cc-story-topic">Topic: {topic.topic}{chapter?.level ? ` · ${chapter.level}` : ''}</p>
        {error && <p className="cc-error" role="alert">{error}</p>}
        {status === 'failed' && !writing && <p className="cc-error">The last try failed. Write it again.</p>}
        {writing && !hasDraft && <p className="cc-story-wait">Julian's next episode is being written and recorded. You can close this; it keeps going.</p>}
        {hasDraft && <StoryEpisode chapter={chapter} teacher />}
        {status === 'approved' && <p className="cc-story-ok">Approved — the class sees it with this lesson's homework.</p>}
      </Sheet>
    </>
  );
}
