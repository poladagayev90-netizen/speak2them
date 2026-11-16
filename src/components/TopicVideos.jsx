import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, ListChecks } from 'lucide-react';
import { describeVideos } from '../data/describeVideos';
import { videosForTopic } from '../utils/fetchTopicVideos';
import { subscribeToClipPicks, pickedClips } from '../utils/teacherClipPicks';
import ClipViewer from './ClipViewer';
import { Button } from './ui';

// The topic's six clips, inside the topic sheet. It is the same deck, in the
// same order, as the in-call Video activity (videosForTopic) — the teacher
// shows a clip here, the pair then describes that same clip to each other.
//
// `showLibrary` (teachers, see canBrowseAllVideos) adds a way out to the whole
// deck. It sits after the questions, below the fold, because the clip and the
// words must stay one screenful on a shared phone screen; the teacher panel is
// the main door to the library.
//
// A teacher may also choose the topic's clips ahead of the lesson
// (teacherClipPicks): their picks replace the six HERE only — one quiet line
// above the clip says which list is showing and opens the picker.
export default function TopicVideos({ day, showLibrary = false, uid = null }) {
  const navigate = useNavigate();
  const [picks, setPicks] = useState(null);

  useEffect(() => {
    if (!showLibrary || !uid) return undefined;
    return subscribeToClipPicks(uid, setPicks);
  }, [showLibrary, uid]);

  const mine = showLibrary ? pickedClips(picks, day) : [];
  const clips = mine.length ? mine : videosForTopic(day);

  // .tv-wrap: the bar takes its line and ClipViewer keeps a definite height
  // for its one-screenful layout (.dt-section--video is height: 100%).
  return (
    <div className="tv-wrap">
      {showLibrary && uid && (
        <div className="tv-picks-bar">
          <span className="tv-picks-label">
            {mine.length ? `Your ${mine.length} clip${mine.length === 1 ? '' : 's'} for this topic` : "The topic's clips"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            icon={<ListChecks size={16} aria-hidden="true" />}
            onClick={() => navigate(`/teacher/videos?pick=${day}`, { state: { fromSheet: true } })}
          >
            {mine.length ? 'Change' : 'Choose clips'}
          </Button>
        </div>
      )}
      <ClipViewer
        key={clips.map((c) => c.id).join('|')}
        clips={clips}
        footer={showLibrary ? (
          <Button
            variant="secondary"
            full
            icon={<LayoutGrid size={18} aria-hidden="true" />}
            onClick={() => navigate('/teacher/videos')}
            style={{ marginTop: 'var(--s-4)' }}
          >
            Browse all {describeVideos.length} clips
          </Button>
        ) : null}
      />
    </div>
  );
}
