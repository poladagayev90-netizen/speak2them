import { Capacitor } from '@capacitor/core';
import { describeVideos } from '../data/describeVideos';
import { topicVideos } from '../data/topicVideos';
import { ADMIN_UID } from '../constants';

// The clips are web-only (decided 2026-09-23): they are not licensed for the
// Play Store build, so the Android app neither shows the video activity nor
// ships the files (scripts/strip-native-videos.js removes them from the APK).
// Every video entry point checks this one flag.
export const VIDEOS_ENABLED = !Capacitor.isNativePlatform();

// Who may open the whole deck (/teacher/videos) instead of a topic's six.
// A teacher running a lesson needs to pick the clip that fits the student in
// front of them, not the six the rotation handed out today.
//
// `role === 'teacher'` is the user's own choice at registration, and that is
// enough here: the clips are public files under /videos, so this gate decides
// what the interface offers, not what anyone can fetch. Nothing is granted by
// it — if the library ever unlocks something that matters, gate it on the
// rules-protected `teacherVerified` instead.
export function canBrowseAllVideos(user) {
  if (!VIDEOS_ENABLED || !user) return false;
  return user.role === 'teacher' || user.teacherVerified === true || user.uid === ADMIN_UID;
}

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
// topicVideos holds the assignment (scripts/assign_topic_videos.js): six clip
// ids per topic, spread so that no clip repeats inside a topic and none carries
// over into the next one. A topic missing from that map — a clip id renamed, a
// new topic added before the script is re-run — falls back to a window over the
// deck rather than an empty screen.
const byId = new Map(describeVideos.map((v) => [v.id, v]));

export function videosForTopic(day, count = VIDEOS_PER_TOPIC) {
  const curated = (topicVideos[day] || []).map((id) => byId.get(id)).filter(Boolean);
  if (curated.length > 0) return curated.slice(0, count);

  const deck = describeVideos;
  if (!deck.length) return [];
  const take = Math.min(count, deck.length);
  const offset = (((Number(day) || 1) - 1) * take) % deck.length;
  return Array.from({ length: take }, (_, i) => deck[(offset + i) % deck.length]);
}

export default videosForTopic;
