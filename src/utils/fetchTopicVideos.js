import { describeVideos, topicVideos } from '../data/describeVideos';

// How many clips one topic is worth. Six is the number the activity was
// designed around: at ~20 s a clip plus two people describing it, six clips is
// roughly the length of one call activity, and it is short enough that a pair
// who open the stage twice in a week do not run out.
export const VIDEOS_PER_TOPIC = 6;

// The clip list for a topic. Deterministic on purpose — this is the same rule
// the picture stage lives by: both peers compute the list from the pinned day
// index alone, so the same index is the same clip on both phones. Nothing is
// fetched, nothing is random, there is no per-peer fallback branch.
//
// Until the curated per-topic sets exist (topicVideos), every topic gets its
// own WINDOW over the shared library instead of the whole library: topic 1 gets
// clips 1-6, topic 2 gets 7-12 and so on, wrapping around. With 16 clips the
// windows still overlap between distant topics — unavoidable, and better than
// showing every topic the same first six — but inside one topic no clip repeats
// and the order never changes between the two sides of a call.
export function videosForTopic(day, count = VIDEOS_PER_TOPIC) {
  const curated = topicVideos[day];
  if (Array.isArray(curated) && curated.length > 0) return curated;

  const deck = describeVideos;
  if (!deck.length) return [];
  const take = Math.min(count, deck.length);
  const offset = (((Number(day) || 1) - 1) * take) % deck.length;
  return Array.from({ length: take }, (_, i) => deck[(offset + i) % deck.length]);
}

export default videosForTopic;
