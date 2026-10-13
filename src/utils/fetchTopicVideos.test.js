import { appVideosForTopic, callVideosForTopic, isAppClip, videosForTopic } from './fetchTopicVideos';
import { describeVideos } from '../data/describeVideos';

const licensed = describeVideos.filter((v) => v.licensed === true);
const appIds = new Set(describeVideos.filter(isAppClip).map((v) => v.id));

test('the app gets six Play-build clips a topic, the same every time', () => {
  for (let day = 1; day <= 60; day += 1) {
    const a = appVideosForTopic(day);
    expect(a).toHaveLength(6);
    expect(a.every((v) => appIds.has(v.id))).toBe(true);
    expect(new Set(a.map((v) => v.id)).size).toBe(6);
    expect(appVideosForTopic(day).map((v) => v.id)).toEqual(a.map((v) => v.id));
  }
});

test('only Pexels / CC0 clips are marked licensed', () => {
  expect(licensed.every((v) => !/video_2026|_robot|instagram/i.test(v.src))).toBe(true);
});

test('a clip with a recognisable person never reaches the Play build', () => {
  // Polad, 2026-10-13: e.g. the woman falling into the snow may be recognised.
  ['snow-slip', 'horse-carrot-stick', 'garden-guitar', 'cat-steals-fish', 'pool-fall']
    .forEach((id) => expect(appIds.has(id)).toBe(false));
});

test('the web keeps its six-clip topics', () => {
  expect(videosForTopic(1)).toHaveLength(6);
});

test('a call reads the deck from the call doc, not from the device', () => {
  expect(callVideosForTopic(5, 'app').map((v) => v.id)).toEqual(appVideosForTopic(5).map((v) => v.id));
  expect(callVideosForTopic(5, 'full').map((v) => v.id)).toEqual(videosForTopic(5).map((v) => v.id));
  expect(callVideosForTopic(5, undefined).map((v) => v.id)).toEqual(videosForTopic(5).map((v) => v.id));
});
