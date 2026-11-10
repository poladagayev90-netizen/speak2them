import { icsStamp, eventFor, googleCalendarUrl, icsContent, CALL_EVENT_MS } from './calendarLinks';

const START = Date.UTC(2026, 10, 12, 14, 0); // 18:00 Baku

test('stamps are UTC basic format', () => {
  expect(icsStamp(START)).toBe('20261112T140000Z');
});

test('event names the partner and lasts half an hour', () => {
  const ev = eventFor({ id: 'b1', startMs: START }, 'Aysel');
  expect(ev.title).toBe('SpeakLab practice with Aysel');
  expect(ev.endMs - ev.startMs).toBe(CALL_EVENT_MS);
  expect(eventFor({ startMs: START }, '').title).toBe('SpeakLab practice');
});

test('Google link carries the UTC range', () => {
  const url = googleCalendarUrl(eventFor({ id: 'b1', startMs: START }, 'Aysel'));
  expect(url.startsWith('https://calendar.google.com/calendar/render?')).toBe(true);
  expect(new URL(url).searchParams.get('dates')).toBe('20261112T140000Z/20261112T143000Z');
});

test('.ics has a stable UID and a 15-minute alarm', () => {
  const ics = icsContent(eventFor({ id: 'b1', startMs: START }, 'Ali, Jr.'), START - 1000);
  expect(ics).toContain('UID:b1@speaklab');
  expect(ics).toContain('DTSTART:20261112T140000Z');
  expect(ics).toContain('BEGIN:VALARM\r\nACTION:DISPLAY');
  expect(ics).toContain('TRIGGER:-PT15M');
  expect(ics).toContain('SUMMARY:SpeakLab practice with Ali\\, Jr.');
});
