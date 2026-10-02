import { licensedVideosForTopic, videosForTopic } from './fetchTopicVideos';
import { describeVideos } from '../data/describeVideos';

const licensed = describeVideos.filter((v) => v.licensed === true);

test('the app gets three licensed clips a topic, the same every time', () => {
  expect(licensed.length).toBeGreaterThanOrEqual(3);
  const a = licensedVideosForTopic(7);
  expect(a).toHaveLength(3);
  expect(a.every((v) => v.licensed === true)).toBe(true);
  expect(licensedVideosForTopic(7).map((v) => v.id)).toEqual(a.map((v) => v.id));
});

test('neighbouring topics show different licensed clips', () => {
  const ids = (d) => licensedVideosForTopic(d).map((v) => v.id);
  expect(ids(1).some((id) => ids(2).includes(id))).toBe(false);
});

test('only Pexels / CC0 clips are marked licensed', () => {
  expect(licensed.every((v) => !/video_2026|_robot|instagram/i.test(v.src))).toBe(true);
});

test('the web keeps its six-clip topics', () => {
  expect(videosForTopic(1)).toHaveLength(6);
});
