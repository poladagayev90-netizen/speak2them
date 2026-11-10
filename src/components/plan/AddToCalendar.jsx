import React, { useState } from 'react';
import { CalendarPlus, Download, ExternalLink } from 'lucide-react';
import { eventFor, googleCalendarUrl, icsContent } from '../../utils/calendarLinks';
import { isNativePush } from '../../nativePush';
import './plan.css';

// «Add to calendar» on a booked practice (Today's next-practice card and each
// Plan ticket). Collapsed to one quiet link; opening it offers Google Calendar
// and an .ics file (Apple / Outlook / any calendar) with a 15-min alarm.
//
// The .ics download is web only: an Android WebView cannot save a blob, and
// the app there has reliable push anyway. Google Calendar opens in the browser.
export default function AddToCalendar({ booking, peerName }) {
  const [open, setOpen] = useState(false);
  const ev = eventFor(booking, peerName);

  const downloadIcs = () => {
    const blob = new Blob([icsContent(ev)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'speaklab-practice.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="pl-cal">
      <button type="button" className="pl-ticket-link" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <CalendarPlus size={15} aria-hidden="true" /> Add to calendar
      </button>
      {open && (
        <div className="pl-cal-options">
          <a className="pl-cal-option" href={googleCalendarUrl(ev)} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} aria-hidden="true" /> Google Calendar
          </a>
          {!isNativePush() && (
            <button type="button" className="pl-cal-option" onClick={downloadIcs}>
              <Download size={15} aria-hidden="true" /> Apple / Outlook (.ics)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
