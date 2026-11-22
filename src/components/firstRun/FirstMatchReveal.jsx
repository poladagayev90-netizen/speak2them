import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import {
  Bot, CalendarDays, Check, CheckCircle2, Clock, RefreshCw, Sparkles, UserCheck,
} from 'lucide-react';
import { db } from '../../firebase';
import { Button } from '../ui';
// ui.css (via Button) BEFORE AddToCalendar (plan.css) — CSS chunk order invariant.
import AddToCalendar from '../plan/AddToCalendar';
import Logo from '../Logo';
import useFirstRunCopy from '../../hooks/useFirstRunCopy';
import { requestInstantMatch } from '../../utils/instantMatch';
import { formatSlotLocal } from '../../utils/adminMessages';
import { deviceTimeZone } from '../../utils/appLanguage';
import './FirstMatchReveal.css';

const SCAN_STEPS = [
  { key: 'fm.step1', Icon: CalendarDays },
  { key: 'fm.step2', Icon: Sparkles },
  { key: 'fm.step3', Icon: UserCheck },
];

// Full-screen first-match reveal right after onboarding (replaces the forced
// /intro WhatsApp wall). Runs a crisp 3-beat Plum analysis sequence while
// matchNewcomerNow books the learner's first call, then renders the booking
// directly from the function response (never waiting for users.upcomingCall).
export default function FirstMatchReveal({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, t } = useFirstRunCopy(user?.guideLanguage);
  const [timeZone, setTimeZone] = useState(location.state?.timeZone || deviceTimeZone() || 'Asia/Baku');
  const [scanStep, setScanStep] = useState(0);
  const [phase, setPhase] = useState('scanning'); // scanning | booked | pick | fallback
  const [booking, setBooking] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [showOther, setShowOther] = useState(false);
  const [pickingSlot, setPickingSlot] = useState('');
  const [pickError, setPickError] = useState('');
  const runIdRef = useRef(0);

  // Load saved timezone from onboarding if the learner landed here directly (reload).
  useEffect(() => {
    if (location.state?.timeZone || !user?.uid) return undefined;
    let alive = true;
    getDoc(doc(db, 'onboarding', user.uid))
      .then((s) => { if (alive && s.exists() && s.get('timeZone')) setTimeZone(s.get('timeZone')); })
      .catch(() => {});
    return () => { alive = false; };
  }, [location.state?.timeZone, user?.uid]);

  const runAutoMatch = () => {
    const id = ++runIdRef.current;
    setPhase('scanning');
    setScanStep(0);
    setPickError('');
    setShowOther(false);

    const reduced = typeof window !== 'undefined'
      && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stepMs = reduced ? 150 : 800;
    const minWait = reduced ? 400 : 2400;

    const t1 = setTimeout(() => { if (runIdRef.current === id) setScanStep(1); }, stepMs);
    const t2 = setTimeout(() => { if (runIdRef.current === id) setScanStep(2); }, stepMs * 2);

    const waitMin = new Promise((resolve) => setTimeout(resolve, minWait));
    Promise.all([requestInstantMatch({ action: 'auto' }), waitMin]).then(([res]) => {
      if (runIdRef.current !== id) return;
      clearTimeout(t1);
      clearTimeout(t2);
      if (res.ok && res.status === 'booked' && res.booking) {
        setBooking(res.booking);
        setAlternatives(Array.isArray(res.alternatives) ? res.alternatives : []);
        setPhase('booked');
      } else if (res.ok && Array.isArray(res.alternatives) && res.alternatives.length > 0) {
        setBooking(null);
        setAlternatives(res.alternatives);
        setPhase('pick');
      } else {
        setBooking(null);
        setAlternatives([]);
        setPhase('fallback');
      }
    });

    return () => { clearTimeout(t1); clearTimeout(t2); };
  };

  useEffect(() => {
    const cleanup = runAutoMatch();
    return () => {
      runIdRef.current += 1;
      cleanup();
    };
    // Run once on mount for the signed-in user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const pickOption = async (opt) => {
    if (!opt || pickingSlot) return;
    setPickingSlot(opt.slotId);
    setPickError('');
    const res = await requestInstantMatch({ action: 'pick', slotId: opt.slotId, hostUid: opt.hostUid });
    setPickingSlot('');
    if (res.ok && res.status === 'booked' && res.booking) {
      setBooking(res.booking);
      setAlternatives(Array.isArray(res.alternatives) ? res.alternatives : []);
      setShowOther(false);
      setPhase('booked');
    } else {
      setPickError(t('ob.errSave'));
    }
  };

  const badgeLabel = (b) => (b?.isFounder ? t('fm.badgeTeam') : t('fm.badgePartner'));

  return (
    <div className="fm-page">
      <div className="fm-shell">
        <div className="fm-logo"><Logo width={136} /></div>

        {phase === 'scanning' && (
          <section className="fm-card fm-scan" aria-live="polite">
            <div className="fm-orbit" aria-hidden="true">
              <span className="fm-orbit-ring" />
              <span className="fm-orbit-core"><Sparkles size={26} strokeWidth={2} /></span>
            </div>
            <h1 className="fm-title">{t('fm.scanTitle')}</h1>
            <ol className="fm-steps">
              {SCAN_STEPS.map(({ key, Icon }, idx) => {
                const done = idx < scanStep;
                const active = idx === scanStep;
                return (
                  <li key={key} className={`fm-step${done ? ' is-done' : ''}${active ? ' is-active' : ''}`}>
                    <span className="fm-step-dot" aria-hidden="true">
                      {done ? <Check size={14} strokeWidth={3} /> : <Icon size={14} strokeWidth={2} />}
                    </span>
                    <span>{t(key)}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {phase === 'booked' && booking && (
          <section className="fm-card fm-reveal" aria-live="polite">
            <div className="fm-kicker">
              <CheckCircle2 size={16} strokeWidth={2.5} aria-hidden="true" />
              <span>{t('fm.kicker')}</span>
            </div>
            <h1 className="fm-title">{t('fm.title')}</h1>
            <p className="fm-sub">{t('fm.sub')}</p>

            <div className="fm-match-box">
              <div className="fm-avatar" aria-hidden="true">
                {(booking.hostName || 'P').slice(0, 1).toUpperCase()}
              </div>
              <div className="fm-match-info">
                <div className="fm-match-who">
                  <strong>{booking.hostName || 'Polad'}</strong>
                  <span className="fm-badge">{badgeLabel(booking)}</span>
                </div>
                <div className="fm-match-when">
                  <Clock size={15} strokeWidth={2} aria-hidden="true" />
                  <span>{formatSlotLocal(booking.slotId, timeZone, lang)}</span>
                </div>
                <div className="fm-match-note">{t('fm.freeNote')}</div>
              </div>
            </div>

            <div className="fm-cal-wrap">
              <AddToCalendar
                booking={{ id: booking.bookingId || booking.slotId, slotId: booking.slotId, startMs: booking.startMs }}
                peerName={booking.hostName || 'SpeakLab'}
              />
            </div>

            <div className="fm-actions">
              <Button full variant="primary" onClick={() => navigate('/', { replace: true })}>
                {t('fm.confirm')}
              </Button>
              {alternatives.length > 0 && (
                <Button full variant="secondary" onClick={() => setShowOther((v) => !v)}>
                  {showOther ? t('fm.hideTimes') : t('fm.otherTime')}
                </Button>
              )}
              <Button
                full
                variant="ghost"
                icon={<Bot size={16} aria-hidden="true" />}
                onClick={() => navigate('/warmup', { replace: true })}
              >
                {t('fm.warmup')}
              </Button>
            </div>

            {showOther && alternatives.length > 0 && (
              <div className="fm-alts" role="group" aria-label={t('fm.otherTime')}>
                {alternatives.map((opt) => (
                  <button
                    key={`${opt.hostUid}-${opt.slotId}`}
                    type="button"
                    className="fm-alt-btn"
                    disabled={!!pickingSlot}
                    onClick={() => pickOption(opt)}
                  >
                    <strong>{formatSlotLocal(opt.slotId, timeZone, lang)}</strong>
                    <span>{pickingSlot === opt.slotId ? t('fm.booking') : `${opt.hostName} · ${badgeLabel(opt)}`}</span>
                  </button>
                ))}
              </div>
            )}
            {pickError && <p className="fm-err" role="alert">{pickError}</p>}
          </section>
        )}

        {phase === 'pick' && (
          <section className="fm-card fm-reveal" aria-live="polite">
            <div className="fm-kicker">
              <CalendarDays size={16} strokeWidth={2.2} aria-hidden="true" />
              <span>{t('fm.pickKicker')}</span>
            </div>
            <h1 className="fm-title">{t('fm.pickTitle')}</h1>
            <p className="fm-sub">{t('fm.pickSub')}</p>
            <div className="fm-alts">
              {alternatives.map((opt) => (
                <button
                  key={`${opt.hostUid}-${opt.slotId}`}
                  type="button"
                  className="fm-alt-btn"
                  disabled={!!pickingSlot}
                  onClick={() => pickOption(opt)}
                >
                  <strong>{formatSlotLocal(opt.slotId, timeZone, lang)}</strong>
                  <span>{pickingSlot === opt.slotId ? t('fm.booking') : `${opt.hostName} · ${badgeLabel(opt)}`}</span>
                </button>
              ))}
            </div>
            {pickError && <p className="fm-err" role="alert">{pickError}</p>}
            <div className="fm-actions">
              <Button full variant="ghost" onClick={() => navigate('/plan', { replace: true })}>
                {t('fm.openPlan')}
              </Button>
            </div>
          </section>
        )}

        {phase === 'fallback' && (
          <section className="fm-card fm-reveal" aria-live="polite">
            <h1 className="fm-title">{t('fm.fallbackTitle')}</h1>
            <p className="fm-sub">{t('fm.fallbackSub')}</p>
            <div className="fm-actions">
              <Button full variant="primary" onClick={() => navigate('/plan', { replace: true })}>
                {t('fm.openPlan')}
              </Button>
              <Button full variant="secondary" icon={<RefreshCw size={16} aria-hidden="true" />} onClick={runAutoMatch}>
                {t('fm.retry')}
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
