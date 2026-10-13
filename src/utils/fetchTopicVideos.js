import { Capacitor } from '@capacitor/core';
import { describeVideos } from '../data/describeVideos';
import { topicVideos } from '../data/topicVideos';
import { isAdminUser } from '../constants';

// Web shows every clip. The Android app shows only the clips allowed in the
// Play build — `licensed: true` (Pexels / CC0) or `playOk: true` (see the
// ANDROID note in describeVideos.js) — and ships only their files
// (scripts/strip-native-videos.js).
// VIDEOS_ENABLED still gates every video entry point; it is on everywhere now.
//
// The in-call Video stage (2026-10-13) runs everywhere: both phones must show
// the same clip at the same index, so the call doc's videoStage carries the
// DECK — 'app' as soon as either side is in the Android app (the only clips
// both have), 'full' between two web users. See callVideosForTopic.
// APKs older than this have no CALL_VIDEO_CAP, so Chat.jsx still hides the
// button from a web user whose partner runs one.
export const NATIVE = Capacitor.isNativePlatform();
export const VIDEOS_ENABLED = true;
export const CALL_VIDEOS_ENABLED = true;
export const CALL_VIDEO_CAP = 'licensedVideo';

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
  if (NATIVE || !user) return false;
  return user.role === 'teacher' || user.teacherVerified === true || isAdminUser(user);
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

// The Android app's list for a topic, six like the web: the topic's own
// clips that are allowed in the Play build first, then a window over the
// allowed deck that moves six clips per topic fills the rest. Deterministic,
// so a web phone and an Android phone in one call build the same list.
export const isAppClip = (v) => v.licensed === true || v.playOk === true;
const APP_DECK = describeVideos.filter(isAppClip);
export function appVideosForTopic(day, count = VIDEOS_PER_TOPIC, deck = APP_DECK) {
  if (!deck.length) return [];
  const allowed = new Set(deck.map((v) => v.id));
  const picked = (topicVideos[day] || []).filter((id) => allowed.has(id)).map((id) => byId.get(id));
  const take = Math.min(count, deck.length);
  const offset = (((Math.max(1, Number(day) || 1) - 1) * take) % deck.length);
  for (let i = 0; picked.length < take && i < deck.length; i += 1) {
    const v = deck[(offset + i) % deck.length];
    if (!picked.includes(v)) picked.push(v);
  }
  return picked.slice(0, take);
}

export function videosForTopic(day, count = VIDEOS_PER_TOPIC) {
  if (NATIVE) return appVideosForTopic(day, count);
  const curated = (topicVideos[day] || []).map((id) => byId.get(id)).filter(Boolean);
  if (curated.length > 0) return curated.slice(0, count);

  const deck = describeVideos;
  if (!deck.length) return [];
  const take = Math.min(count, deck.length);
  const offset = (((Number(day) || 1) - 1) * take) % deck.length;
  return Array.from({ length: take }, (_, i) => deck[(offset + i) % deck.length]);
}

// The in-call list: the deck is decided once, in the call doc, by whoever
// starts the stage — never per device, or a web phone and an Android phone
// would index into different lists.
export function callVideosForTopic(day, deck) {
  if (deck === 'app') return appVideosForTopic(day);
  return videosForTopic(day);
}

export default videosForTopic;
