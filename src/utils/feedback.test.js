import { buildFeedbackDoc, canSendFeedback, feedbackTypeLabel, FEEDBACK_TEXT_MAX, SCREENSHOT_MAX_CHARS } from './feedback';

const base = { uid: 'u1', type: 'idea', text: '  More topics please  ', appVersion: '1.26', platform: 'android', route: '/profile' };

test('builds the doc the rules expect', () => {
  expect(buildFeedbackDoc(base)).toEqual({
    uid: 'u1', type: 'idea', text: 'More topics please', appVersion: '1.26',
    platform: 'android', route: '/profile', status: 'new',
  });
});

test('unknown type and platform fall back', () => {
  const d = buildFeedbackDoc({ ...base, type: 'spam', platform: 'pc' });
  expect(d.type).toBe('other');
  expect(d.platform).toBe('web');
});

test('caps the text and the user agent', () => {
  const d = buildFeedbackDoc({ ...base, text: 'x'.repeat(5000), userAgent: 'y'.repeat(900) });
  expect(d.text).toHaveLength(FEEDBACK_TEXT_MAX);
  expect(d.userAgent).toHaveLength(300);
});

test('keeps only a JPEG data URL that fits', () => {
  const ok = 'data:image/jpeg;base64,AAAA';
  expect(buildFeedbackDoc({ ...base, screenshot: ok }).screenshot).toBe(ok);
  expect(buildFeedbackDoc({ ...base, screenshot: 'javascript:alert(1)' }).screenshot).toBeUndefined();
  expect(buildFeedbackDoc({ ...base, screenshot: ok + 'A'.repeat(SCREENSHOT_MAX_CHARS) }).screenshot).toBeUndefined();
});

test('needs a few real characters to send', () => {
  expect(canSendFeedback('  ')).toBe(false);
  expect(canSendFeedback('ok!')).toBe(true);
});

test('labels', () => {
  expect(feedbackTypeLabel('problem')).toBe('Problem');
  expect(feedbackTypeLabel('nope')).toBe('Other');
});
