import { buildPracticeLink, readPeerFromPath } from './invite';

test('the link always points at the web app', () => {
  expect(buildPracticeLink('abc123XYZ', 'https://speaklab-app.vercel.app')).toBe('https://speaklab-app.vercel.app/p/abc123XYZ');
  expect(buildPracticeLink('abc123XYZ', 'http://localhost')).toBe('https://speaklab-app.vercel.app/p/abc123XYZ');
  expect(buildPracticeLink('abc123XYZ', 'capacitor://localhost')).toBe('https://speaklab-app.vercel.app/p/abc123XYZ');
});

test('only a well-formed /p/<uid> is read', () => {
  expect(readPeerFromPath('/p/abc123XYZ')).toBe('abc123XYZ');
  expect(readPeerFromPath('/p/abc123XYZ/')).toBe('abc123XYZ');
  expect(readPeerFromPath('/p/../admin')).toBe('');
  expect(readPeerFromPath('/p/a b')).toBe('');
  expect(readPeerFromPath('/chat/abc123XYZ')).toBe('');
});
