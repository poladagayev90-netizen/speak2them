import { pickShareMethod, SHARE_URL } from './shareApp';

describe('pickShareMethod', () => {
  test('Android app with the Share plugin uses the native sheet', () => {
    expect(pickShareMethod({ native: true, pluginAvailable: true, hasWebShare: false })).toBe('native');
  });
  test('an older AAB without the plugin copies (the WebView has no navigator.share)', () => {
    expect(pickShareMethod({ native: true, pluginAvailable: false, hasWebShare: false })).toBe('copy');
  });
  test('a browser with Web Share uses it', () => {
    expect(pickShareMethod({ native: false, pluginAvailable: false, hasWebShare: true })).toBe('webshare');
  });
  test('a browser without Web Share copies the link', () => {
    expect(pickShareMethod({ native: false, pluginAvailable: false, hasWebShare: false })).toBe('copy');
  });
});

test('the share link carries the share UTM tags', () => {
  const u = new URL(SHARE_URL);
  expect(u.searchParams.get('utm_source')).toBe('share');
  expect(u.searchParams.get('utm_medium')).toBe('app');
});
