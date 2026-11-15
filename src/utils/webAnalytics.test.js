import { analyticsUrl, utmOf } from './webAnalytics';

test('keeps only utm_* and hides id-like path segments', () => {
  expect(analyticsUrl('https://speaklab-app.vercel.app/chat/Xy12abCDef34GhIJkl56?invite=1&utm_source=instagram&UTM_Campaign=nov'))
    .toBe('https://speaklab-app.vercel.app/chat/:id?utm_source=instagram&utm_campaign=nov');
  expect(analyticsUrl('https://x.app/call/call_a_b')).toBe('https://x.app/call/:id');
  expect(analyticsUrl('https://x.app/admin?tab=matching')).toBe('https://x.app/admin');
  expect(analyticsUrl('https://x.app/')).toBe('https://x.app/');
  expect(analyticsUrl('not a url')).toBe('not a url');
});

test('the first view gets the landing utm back after a redirect dropped it', () => {
  const landing = utmOf('https://x.app/?utm_source=instagram&utm_campaign=ad1&fbclid=zz');
  expect(analyticsUrl('https://x.app/register', landing)).toBe('https://x.app/register?utm_source=instagram&utm_campaign=ad1');
  expect(analyticsUrl('https://x.app/register?utm_source=tiktok', landing)).toBe('https://x.app/register?utm_source=tiktok');
});
