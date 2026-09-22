import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Users, Video, Smartphone, CalendarDays, MessageCircle } from 'lucide-react';
import { auth } from '../firebase';
import { whatsappLink } from '../constants';
import { Button } from '../components/ui';
import {
  subscribeToTeamSlots, subscribeToMyIntro, bookIntro, cancelIntro, introTimeLabel, localDayKey,
} from '../utils/intro';
import './Onboarding.css';
import './IntroBooking.css';

// Arrange the 15-minute intro call with the SpeakLab team.
//
// It comes straight after onboarding, in the same full-screen layer, so it
// reads as the last step of joining rather than as an ad. It is never a dead
// end: "Explore the app first" is always there, and the rest of the app works
// while the call is pending — only live partner practice waits for it.
//
// WHATSAPP IS THE FIRST STEP, for now. The slot board works, but nobody was
// arranging anything through it: the team has to open times in advance, and
// somebody who has just signed up wants to ask a question before they commit
// to a time. So the first thing here is a message to the team's business
// WhatsApp with the learner's name and level already written, and the time is
// agreed there like any other appointment. Published times still appear
// underneath for anyone who would rather just pick one, and everything behind
// them — reminders, the admin's outcomes, introDoneAt — is untouched.
export default function IntroBooking({ user }) {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid || user?.uid;
  const [slots, setSlots] = useState(null);
  const [booking, setBooking] = useState(undefined);
  const [picked, setPicked] = useState('');
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => subscribeToTeamSlots(setSlots), []);
  useEffect(() => subscribeToMyIntro(uid, setBooking), [uid]);

  const groups = useMemo(() => {
    const m = new Map();
    for (const s of slots || []) {
      const k = localDayKey(s.startMs);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(s);
    }
    return [...m.values()];
  }, [slots]);

  const done = !!user?.introDoneAt || booking?.status === 'done';
  const booked = booking?.status === 'booked' && Number(booking.startMs) > Date.now() - 30 * 60000;
  const showPicker = !done && (!booked || changing);

  const confirm = async () => {
    setBusy(true);
    setError('');
    const res = await bookIntro(picked);
    setBusy(false);
    if (!res.ok) { setError(res.errorText); return; }
    setPicked('');
    setChanging(false);
  };

  const cancel = async () => {
    setBusy(true);
    setError('');
    const res = await cancelIntro();
    setBusy(false);
    if (!res.ok) setError(res.errorText);
  };

  const loading = slots === null || booking === undefined;

  // Written for the team to read at a glance: who this is, what level they
  // said, and what they are asking for. Their name saves the first two
  // messages of every conversation.
  const waText = `Salam! Mən ${user?.name || 'SpeakLab istifadəçisiyəm'}`
    + `${user?.level ? ` (${user.level})` : ''}. SpeakLab-da tanışlıq zəngi üçün vaxt təyin etmək istəyirəm.`;
  const openWhatsApp = () => window.open(whatsappLink(waText), '_blank', 'noopener');

  return (
    <div className="ob-page">
      <header className="ob-top">
        <button type="button" className="ob-back" onClick={() => navigate('/')} aria-label="Back to the app">
          <ArrowLeft size={20} />
        </button>
        <span className="in-top-title">Meet the team</span>
      </header>

      <main className="ob-slide ob-slide--fwd">
        {loading ? <div className="ob-loading" aria-busy="true" /> : (
          <section className="ob-q">
            <span className="ob-q-icon" aria-hidden="true">{done ? <Check size={20} /> : <Users size={20} />}</span>

            {done && (
              <>
                <h1 className="ob-title">You have met the team</h1>
                <p className="ob-sub">Live practice with partners is open. See you there!</p>
              </>
            )}

            {!done && booked && !changing && (
              <>
                <h1 className="ob-title">Your intro call is booked</h1>
                <p className="ob-sub">A short, friendly conversation with the SpeakLab team: your goals, your level, and a practice plan that fits your week.</p>
                <BookedCard booking={booking} />
                {error && <p className="ob-error" role="alert">{error}</p>}
                <div className="in-row">
                  <Button variant="secondary" onClick={() => setChanging(true)} disabled={busy}>Change time</Button>
                  <Button variant="ghost" onClick={cancel} disabled={busy}>{busy ? 'Cancelling…' : 'Cancel booking'}</Button>
                </div>
              </>
            )}

            {showPicker && (
              <>
                <h1 className="ob-title">{changing ? 'Pick a new time' : 'Meet the SpeakLab team'}</h1>
                <p className="ob-sub">
                  A 15-minute call before your first live practice. We get to know you, and you
                  leave with a practice plan built around your week. Times are shown in your own time.
                </p>
                <ul className="in-points">
                  <li><CalendarDays size={16} /> Everything else in the app is open now</li>
                  <li><Users size={16} /> Live partner practice opens after the call</li>
                </ul>

                {/* The way in. A message, not a commitment — they can ask
                    first and agree a time in the same thread. Only when there
                    ARE open times: with none, the footer button is already
                    "Write to us on WhatsApp", and the page offered the same
                    action twice, one above the other. */}
                {groups.length > 0 && (
                  <button type="button" className="in-wa" onClick={openWhatsApp}>
                    <MessageCircle size={20} aria-hidden="true" />
                    <span>
                      <b>Write to us on WhatsApp</b>
                      <small>We answer, and we agree a time that suits you</small>
                    </span>
                  </button>
                )}

                {groups.length > 0 && <p className="in-or">or pick one of our open times</p>}

                {groups.map((g) => (
                  <div key={localDayKey(g[0].startMs)} className="in-day">
                    <h2 className="in-day-title">{introTimeLabel(g[0].startMs).day}</h2>
                    <div className="in-times" role="radiogroup" aria-label={introTimeLabel(g[0].startMs).day}>
                      {g.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          role="radio"
                          aria-checked={picked === s.id}
                          className={`in-time ${picked === s.id ? 'is-on' : ''}`}
                          onClick={() => setPicked(s.id)}
                        >
                          {introTimeLabel(s.startMs, s.durationMin).time.split('–')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {error && <p className="ob-error" role="alert">{error}</p>}
              </>
            )}
          </section>
        )}
      </main>

      <footer className="ob-foot">
        {showPicker && !loading ? (
          <>
            {/* Nothing published to book? Then the button that fills the
                footer has to be the one that actually leads somewhere. */}
            {groups.length === 0 ? (
              <Button size="lg" full onClick={openWhatsApp} icon={<MessageCircle size={20} />}>
                Write to us on WhatsApp
              </Button>
            ) : (
              <Button size="lg" full onClick={confirm} disabled={!picked || busy} icon={<Check size={20} />}>
                {busy ? 'Booking…' : 'Book this time'}
              </Button>
            )}
            <button
              type="button"
              className="ob-link in-later"
              onClick={() => (changing ? setChanging(false) : navigate('/'))}
            >
              {changing ? 'Keep my current time' : 'Explore the app first'}
            </button>
          </>
        ) : (
          <Button size="lg" full onClick={() => navigate(done ? '/live' : '/')}>
            {done ? 'Go to live practice' : 'Continue to the app'}
          </Button>
        )}
      </footer>
    </div>
  );
}

function BookedCard({ booking }) {
  const { day, time } = introTimeLabel(Number(booking.startMs), booking.durationMin);
  const hasLink = /^https?:\/\//.test(booking.meetUrl || '');
  return (
    <div className="in-booked">
      <p className="in-booked-day">{day}</p>
      <p className="in-booked-time">{time}</p>
      {booking.hostName && <p className="in-booked-host">with {booking.hostName}</p>}
      {hasLink ? (
        <a className="in-booked-how" href={booking.meetUrl} target="_blank" rel="noopener noreferrer">
          <Video size={16} /> Join the video call at this time
        </a>
      ) : (
        <p className="in-booked-how"><Smartphone size={16} /> We will call you here in the app — keep notifications on.</p>
      )}
    </div>
  );
}
