import { Capacitor } from '@capacitor/core';
import { describeVideos } from '../data/describeVideos';
import { topicVideos } from '../data/topicVideos';
import { isAdminUser } from '../constants';

// Web shows every clip. The Android app (Polad, 2026-10-02) shows only the
// clips licensed for the Play Store (`licensed: true`, Pexels / CC0), three
// per topic, and ships only their files (scripts/strip-native-videos.js).
// VIDEOS_ENABLED still gates every video entry point; it is on everywhere now.
//
// The in-call Video stage stays web-only (CALL_VIDEOS_ENABLED): both phones
// must show the same clip at the same index, and the two platforms no longer
// share a deck. Chat.jsx hides the button when the partner is in the app.
export const NATIVE = Capacitor.isNativePlatform();
export const VIDEOS_ENABLED = true;
export const CALL_VIDEOS_ENABLED = !NATIVE;
export const NATIVE_VIDEOS_PER_TOPIC = 3;

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

// The Android app's list for a topic: three licensed clips, a window over the
// licensed deck that moves three clips per topic, so neighbouring topics show
// different clips and the whole licensed set comes round in turn.
const LICENSED = describeVideos.filter((v) => v.licensed === true);
export function licensedVideosForTopic(day, count = NATIVE_VIDEOS_PER_TOPIC, deck = LICENSED) {
  if (!deck.length) return [];
  const take = Math.min(count, deck.length);
  const offset = (((Math.max(1, Number(day) || 1) - 1) * take) % deck.length);
  return Array.from({ length: take }, (_, i) => deck[(offset + i) % deck.length]);
}

export function videosForTopic(day, count = VIDEOS_PER_TOPIC) {
  if (NATIVE) return licensedVideosForTopic(day, Math.min(count, NATIVE_VIDEOS_PER_TOPIC));
  const curated = (topicVideos[day] || []).map((id) => byId.get(id)).filter(Boolean);
  if (curated.length > 0) return curated.slice(0, count);

  const deck = describeVideos;
  if (!deck.length) return [];
  const take = Math.min(count, deck.length);
  const offset = (((Number(day) || 1) - 1) * take) % deck.length;
  return Array.from({ length: take }, (_, i) => deck[(offset + i) % deck.length]);
}

export default videosForTopic;
