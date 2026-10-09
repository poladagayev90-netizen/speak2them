import { detectBrowser, guideFor, iosNeedsSafari, iosVersion } from './installGuide';

const UA = {
  iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iosChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1',
  iosChromeOld: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/110.0 Mobile/15E148 Safari/604.1',
  chrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36',
  firefox: 'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0',
  edge: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 EdgA/126.0',
  opera: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 OPR/83.0',
  instagram: 'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36 Instagram 330.0',
  ipadAsMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
};

test('detects each browser', () => {
  expect(detectBrowser(UA.iosSafari)).toBe('ios-safari');
  expect(detectBrowser(UA.iosChrome)).toBe('ios-chrome');
  expect(detectBrowser(UA.chrome)).toBe('android-chrome');
  expect(detectBrowser(UA.samsung)).toBe('samsung');
  expect(detectBrowser(UA.firefox)).toBe('android-firefox');
  expect(detectBrowser(UA.edge)).toBe('android-edge');
  expect(detectBrowser(UA.opera)).toBe('opera');
  expect(detectBrowser(UA.instagram)).toBe('inapp');
  expect(detectBrowser(UA.ipadAsMac, { platform: 'MacIntel', maxTouchPoints: 5 })).toBe('ios-safari');
  expect(detectBrowser(UA.ipadAsMac, { platform: 'MacIntel', maxTouchPoints: 0 })).toBe('desktop');
});

test('iOS before 16.4 sends other browsers to Safari', () => {
  expect(iosVersion(UA.iosChromeOld)).toBeCloseTo(15.07);
  expect(iosNeedsSafari(UA.iosChromeOld)).toBe(true);
  expect(iosNeedsSafari(UA.iosChrome)).toBe(false);
  expect(guideFor('ios-chrome', UA.iosChromeOld).needsSafari).toBe(true);
  expect(guideFor('ios-chrome', UA.iosChrome).needsSafari).toBeUndefined();
  expect(guideFor('ios-safari', UA.iosChromeOld).needsSafari).toBeUndefined();
});

test('every guide has steps and a button position', () => {
  for (const b of ['ios-safari', 'ios-chrome', 'samsung', 'android-chrome', 'inapp', 'unknown']) {
    const g = guideFor(b);
    expect(g.steps.length).toBeGreaterThan(1);
    expect(['top-right', 'bottom', 'bottom-right']).toContain(g.where);
  }
});
