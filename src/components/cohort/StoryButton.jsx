import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { BookOpen } from 'lucide-react';
import { db } from '../../firebase';
import { authedFetch } from '../../api';
import { FUNCTIONS_BASE } from '../../constants';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';
// cohort.css before the story styles, the same order every other importer has
// (CSS chunks must agree on it or the build refuses).
import './cohort.css';
import StoryEpisode from '../story/StoryEpisode';

const STATUS_LABEL = { generating: 'Writing…', draft: 'To review', approved: 'Ready', failed: 'Failed' };

// Episode n of the Julian story at one level, for the admin or a verified
// teacher: write it (the server tells beat n of the bible), read the draft with
// its audio, then approve — or rewrite. Every student of the level reads the
// approved episode before their n-th lesson, so it is written once.
export default function StoryButton({ level, n }) {
  const [chapter, setChapter] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = `${level}_${n}`;

  // An episode that does not exist yet is unreadable under the rules (they
  // look at its status), so an error simply means "not written".
  useEffect(() => onSnapshot(
    doc(db, 'storyChapters', id),
    (snap) => setChapter(snap.exists() ? snap.data() : null),
    () => setChapter(null)
  ), [id]);

  const call = async (action) => {
    setBusy(true); setError('');
    try {
      const res = await authedFetch(`${FUNCTIONS_BASE}/teacherStory`, {
        method: 'POST', body: JSON.stringify({ level, n, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({
          busy: 'This episode is already being written.',
          already_approved: 'This episode is already approved.',
          rate_limited: 'Too many episodes this hour. Try again later.',
          forbidden: 'Only a verified teacher can write the story.',
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
        Episode {n} · {STATUS_LABEL[status] || 'Write'}
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`Episode ${n} · ${level}${chapter?.title && hasDraft ? ` · ${chapter.title}` : ''}`}
        footer={status === 'approved' ? null : (
          <div className="cc-story-foot">
            {hasDraft && (
              <Button variant="secondary" disabled={writing} onClick={() => call('generate')}>Rewrite</Button>
            )}
            {hasDraft
              ? <Button disabled={writing} onClick={() => call('approve')}>Approve for {level}</Button>
              : <Button full disabled={writing} onClick={() => call('generate')}>{writing ? 'Writing… about a minute' : `Write episode ${n}`}</Button>}
          </div>
        )}
      >
        <p className="cc-story-topic">Shared by every {level} student, read before their lesson {n}.</p>
        {error && <p className="cc-error" role="alert">{error}</p>}
        {status === 'failed' && !writing && <p className="cc-error">The last try failed. Write it again.</p>}
        {writing && !hasDraft && <p className="cc-story-wait">Julian's next episode is being written and recorded. You can close this; it keeps going.</p>}
        {hasDraft && <StoryEpisode chapter={chapter} teacher />}
        {status === 'approved' && <p className="cc-story-ok">Approved — {level} students see it before lesson {n}.</p>}
      </Sheet>
    </>
  );
}
