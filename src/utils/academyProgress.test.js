import {
  chapterKey,
  resolveAcademyLang,
  mergeProgressState,
  resumeAt,
  seriesProgress,
  courseAction,
  nextSeriesAfter,
} from './academyProgress';
import { academyShareUrl, academyChapterUrl } from './academyLink';

const SAMPLE_CATALOGUE = {
  series: [
    {
      id: 'T02',
      langs: {
        az: {
          title: 'Tələbə Bələdçisi',
          chapters: [
            { id: 'ch1', title: '1', dur: 34 },
            { id: 'ch2', title: '2', dur: 42 },
          ],
        },
      },
    },
    {
      id: 'T03',
      langs: {
        az: {
          title: 'Zəng Otağı',
          chapters: [
            { id: 'ch1', title: '1', dur: 39 },
          ],
        },
      },
    },
  ],
};

describe('academyProgress pure helpers', () => {
  test('resolveAcademyLang respects priority and falls back to az', () => {
    expect(resolveAcademyLang({ urlLang: 'tr', storedLang: 'az', guideLanguage: 'az' })).toBe('tr');
    expect(resolveAcademyLang({ storedLang: 'tr', guideLanguage: 'az' })).toBe('tr');
    expect(resolveAcademyLang({ guideLanguage: 'tr' })).toBe('tr');
    expect(resolveAcademyLang({ guideLanguage: 'ru', preferredLanguage: 'tr' })).toBe('tr');
    expect(resolveAcademyLang({ guideLanguage: 'en' })).toBe('az');
  });

  test('mergeProgressState is monotonic for done and keeps newest position', () => {
    const merged = mergeProgressState(
      { openedAt: 200, chapters: { T02_ch1: { done: true, pos: 34, at: 100 } }, last: 'T02_ch1' },
      { openedAt: 100, chapters: { T02_ch1: { done: false, pos: 12, at: 250 }, T02_ch2: { done: false, pos: 15, at: 300 } }, last: 'T02_ch2' },
    );
    expect(merged.openedAt).toBe(100);
    expect(merged.chapters.T02_ch1.done).toBe(true);
    expect(merged.chapters.T02_ch1.pos).toBe(12);
    expect(merged.chapters.T02_ch2.pos).toBe(15);
    expect(merged.last).toBe('T02_ch2');
  });

  test('resumeAt skips near-start, near-end, and done chapters', () => {
    const chapters = {
      [chapterKey('T02', 'ch1')]: { done: false, pos: 1.5, at: 1 },
      [chapterKey('T02', 'ch2')]: { done: false, pos: 18, at: 1 },
      [chapterKey('T02', 'ch3')]: { done: false, pos: 38, at: 1 },
      [chapterKey('T02', 'ch4')]: { done: true, pos: 20, at: 1 },
    };
    expect(resumeAt(chapters, 'T02', 'ch1', 40)).toBe(0);
    expect(resumeAt(chapters, 'T02', 'ch2', 40)).toBe(18);
    expect(resumeAt(chapters, 'T02', 'ch3', 40)).toBe(0);
    expect(resumeAt(chapters, 'T02', 'ch4', 40)).toBe(0);
  });

  test('seriesProgress, courseAction, and nextSeriesAfter compute progression', () => {
    const s1 = SAMPLE_CATALOGUE.series[0];
    expect(seriesProgress(s1, 'az', {})).toEqual({ done: 0, total: 2, percent: 0 });
    expect(courseAction(s1, 'az', {})).toEqual({ kind: 'start', ch: 'ch1' });

    const partial = { T02_ch1: { done: true, pos: 34, at: 1 } };
    expect(seriesProgress(s1, 'az', partial)).toEqual({ done: 1, total: 2, percent: 50 });
    expect(courseAction(s1, 'az', partial)).toEqual({ kind: 'cont', ch: 'ch2' });

    const allDone = { T02_ch1: { done: true }, T02_ch2: { done: true } };
    expect(courseAction(s1, 'az', allDone)).toEqual({ kind: 'again', ch: 'ch1' });
    expect(nextSeriesAfter(SAMPLE_CATALOGUE, s1, 'az', allDone)?.id).toBe('T03');
    expect(nextSeriesAfter(SAMPLE_CATALOGUE, s1, 'az', { ...allDone, T03_ch1: { done: true } })).toBeNull();
  });

  test('academyShareUrl & academyChapterUrl produce public speaklab.me links', () => {
    expect(academyShareUrl('T02', null, 'az')).toBe('https://speaklab.me/academy/?c=T02&lang=az');
    expect(academyChapterUrl('T02', 'ch3', 'tr')).toBe('https://speaklab.me/academy/?c=T02&ch=ch3&lang=tr');
    expect(academyChapterUrl('T02', 'ch1', 'ru')).toBe('https://speaklab.me/academy/?c=T02&ch=ch1&lang=az');
  });
});
