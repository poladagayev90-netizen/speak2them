import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { describeVideos } from '../data/describeVideos';
import { videosForTopic } from '../utils/fetchTopicVideos';
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
export default function TopicVideos({ day, showLibrary = false }) {
  const navigate = useNavigate();
  const clips = videosForTopic(day);

  return (
    <ClipViewer
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
  );
}
