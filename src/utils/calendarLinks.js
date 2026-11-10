// «Add to calendar» for a booked practice: a Google Calendar link and an .ics
// file with an alarm 15 min before. A calendar alarm is the one reminder that
// does not depend on push working in this browser (2026-11-10: learners kept
// forgetting booked calls; web push is unreliable, iOS tabs have none).
//
// Times are absolute (UTC, "Z"), so every calendar shows the call in its own
// zone — no Baku arithmetic here.

// The booking window is two hours; the call itself is about half an hour.
export const CALL_EVENT_MS = 30 * 60 * 1000;
export const APP_URL = 'https://speaklab-app.vercel.app/';

// 20261112T100000Z
export function icsStamp(ms) {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function eventFor(booking, peerName) {
  const startMs = Number(booking.startMs);
  const who = peerName ? ` with ${peerName}` : '';
  return {
    id: booking.id || booking.slotId || String(startMs),
    startMs,
    endMs: startMs + CALL_EVENT_MS,
    title: `SpeakLab practice${who}`,
    details: `Your English practice call${who}. Open SpeakLab to join: ${APP_URL}`,
  };
}

export function googleCalendarUrl(ev) {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${icsStamp(ev.startMs)}/${icsStamp(ev.endMs)}`,
    details: ev.details,
    location: APP_URL,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

// RFC 5545 text escaping.
const icsText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export function icsContent(ev, nowMs = Date.now()) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SpeakLab//Practice//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // Stable per booking: importing the file twice updates one event.
    `UID:${ev.id}@speaklab`,
    `DTSTAMP:${icsStamp(nowMs)}`,
    `DTSTART:${icsStamp(ev.startMs)}`,
    `DTEND:${icsStamp(ev.endMs)}`,
    `SUMMARY:${icsText(ev.title)}`,
    `DESCRIPTION:${icsText(ev.details)}`,
    `URL:${APP_URL}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(ev.title)}`,
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
