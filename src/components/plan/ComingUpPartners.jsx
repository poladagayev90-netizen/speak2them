import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Clock } from 'lucide-react';
import { subscribeToMyBookings } from '../../hooks/useMyPlan';
import { upcomingBookings, peerOf, comingUpLabel } from '../../utils/planState';
import './plan.css';

// "Coming up" on Partners: everyone you have a practice booked with, each one
// message away — and the time one more tap away.
//
// Partners lists chats, and a chat appears only after the first real call
// (functions/postCallChat.js), so a partner booked for Thursday whom you have
// never talked to was nowhere on this page. A learner wanting to move that
// practice found only the partner on Today's card (Polad 2026-10-07: "she can
// only write to the partner on the card, the first one").
export default function ComingUpPartners({ uid }) {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  useEffect(() => subscribeToMyBookings(uid, setBookings), [uid]);
  const now = Date.now();
  const coming = upcomingBookings(bookings, now);
  if (!coming.length) return null;
  return (
    <section className="pl-card pl-cu" aria-label="Coming up">
      <p className="ui-section-label" style={{ margin: 0 }}>Coming up</p>
      <ul className="pl-cu-list">
        {coming.map((b) => {
          const { peerUid, peerName, peerLevel } = peerOf(b, uid);
          return (
            <li key={b.id} className="pl-cu-row">
              <span className="pl-ticket-avatar" aria-hidden="true">{String(peerName || '?').charAt(0).toUpperCase()}</span>
              <span className="pl-cu-main">
                <b>{peerName}</b>{peerLevel && <span className="pl-level">{String(peerLevel).slice(0, 2)}</span>}
                <span className="pl-cu-when">{comingUpLabel(b.startMs, now)}</span>
              </span>
              <span className="pl-cu-actions">
                <button type="button" className="pl-cu-btn" onClick={() => navigate(`/chat/${peerUid}`)} aria-label={`Message ${peerName}`}>
                  <MessageCircle size={18} aria-hidden="true" />
                </button>
                <button type="button" className="pl-cu-btn" onClick={() => navigate('/plan', { state: { openBooking: b.id, openTime: true } })} aria-label={`Change the time with ${peerName}`}>
                  <Clock size={18} aria-hidden="true" />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
