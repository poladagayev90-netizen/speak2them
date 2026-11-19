import React, { useEffect, useState } from 'react';
import { PODCAST_LEVELS, levelEpisode, podcastLevelFor } from '../../utils/topicMaterials';
import { loadPodcastLevels } from '../../utils/topicMaterialsLoader';
import PodcastEpisode from './PodcastEpisode';

// The learner's pick, kept per device across topics (a convenience: nothing
// depends on it, and private mode just starts from the profile level again).
// A pick that is no longer a level (a «B2» saved before B2 was dropped) is ignored.
const KEY = 'sl.podcastLevel';
const readPick = () => {
  try {
    const v = localStorage.getItem(KEY);
    return PODCAST_LEVELS.includes(v) ? v : null;
  } catch (_) { return null; }
};
const savePick = (v) => {
  try { localStorage.setItem(KEY, v); } catch (_) { /* private mode */ }
};

// The Listen tab: the A1/A2/B1 switch (the Read tab's switch) above the
// episode. It opens on the level the learner picked last, else the profile
// level, else B1. A level this topic doesn't have plays the live B1 episode —
// the pick itself stays, so the next topic that has it opens there.
export default function PodcastLevels({ podcast, topic, userLevel }) {
  const [levels, setLevels] = useState(null);
  const [pick, setPick] = useState(() => readPick() || podcastLevelFor(userLevel));

  useEffect(() => {
    let alive = true;
    setLevels(null);
    if (topic?.day) loadPodcastLevels(topic.day).then((l) => { if (alive) setLevels(l); }).catch(() => {});
    return () => { alive = false; };
  }, [topic?.day]);

  const { episode, level, available } = levelEpisode(podcast, levels, pick);
  if (!episode) return null;
  const choose = (l) => { setPick(l); savePick(l); };

  return (
    <div className="mt-pod-levels">
      {available.length > 1 && (
        <div className="mt-levels" role="tablist" aria-label="Level">
          {available.map((l) => (
            <button key={l} type="button" role="tab" aria-selected={l === level}
              className={`mt-level${l === level ? ' is-on' : ''}`} onClick={() => choose(l)}>{l}</button>
          ))}
        </div>
      )}
      {/* key: a new level is a new episode — its player, step and scroll start over. */}
      <PodcastEpisode key={`${level}-${episode.audio}`} podcast={episode} topic={topic} />
    </div>
  );
}
