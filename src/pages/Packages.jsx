import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, CalendarCheck, RotateCcw, PhoneCall, Check, MessageCircle } from 'lucide-react';
import { db } from '../firebase';
import usePackages from '../hooks/usePackages';
import HeroParade, { heroClockStyle } from '../components/plan/HeroFx';
import { FishSvg, OctopusSvg, MantaSvg, WhaleSvg } from '../components/plan/SeaCreatures';
import { isAdminUser } from '../utils/courseProgress';
import {
  fitsWeek, formatPrice, packageMessage, perPractice, perWeekOf,
} from '../utils/packages';
import { whatsappLink } from '../constants';
import '../components/plan/plan.css';
import './Packages.css';

// /packages — what a learner's planned practice runs on (functions/packages.js).
// Never opened by the app on its own: Profile shows the way in once the free
// month is over or a package is held (utils/packages.js showPlanEntry).
// Paying through Google Play comes later; until then "Get it" opens WhatsApp
// with the choice written out, and the admin sets the package up.

// One creature per size, growing with the package.
const CREATURES = [
  { Svg: FishSvg, width: 64, name: 'Fish' },
  { Svg: OctopusSvg, width: 44, name: 'Octopus' },
  { Svg: MantaSvg, width: 92, name: 'Manta' },
  { Svg: WhaleSvg, width: 128, name: 'Whale' },
];

const dateLabel = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Baku' });

// The admin sees every state of the page with ?preview=trial|none|package.
const PREVIEWS = {
  trial: { kind: 'trial', perWeek: 2, remaining: 1, used: 1, reserved: 0, returned: 0, trialEndsMs: Date.now() + 17 * 864e5 },
  none: { kind: 'none', remaining: 0 },
  package: {
    kind: 'package', size: 12, carriedIn: 2, total: 14, used: 5, reserved: 2, returned: 1, remaining: 7,
    periodStartMs: Date.now() - 12 * 864e5, periodEndMs: Date.now() + 18 * 864e5,
  },
};

function UseRing({ used, reserved, total }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const part = (n) => (total > 0 ? Math.min(1, n / total) : 0) * c;
  return (
    <svg className="pk-ring" viewBox="0 0 84 84" width="84" height="84" aria-hidden="true">
      <circle cx="42" cy="42" r={r} className="pk-ring-track" />
      <circle cx="42" cy="42" r={r} className="pk-ring-booked"
        strokeDasharray={`${part(used + reserved)} ${c}`} transform="rotate(-90 42 42)" />
      <circle cx="42" cy="42" r={r} className="pk-ring-used"
        strokeDasharray={`${part(used)} ${c}`} transform="rotate(-90 42 42)" />
      <text x="42" y="39" className="pk-ring-num">{used + reserved}</text>
      <text x="42" y="56" className="pk-ring-of">of {total}</text>
    </svg>
  );
}

function Hero({ view }) {
  const clock = useMemo(heroClockStyle, []);
  let kicker; let big; let unit; let line;
  if (view.kind === 'package') {
    kicker = `Your package · ${view.size} practices${view.carriedIn ? ` + ${view.carriedIn} carried over` : ''}`;
    big = view.remaining;
    unit = view.remaining === 1 ? 'practice left' : 'practices left';
    line = `Until ${dateLabel(view.periodEndMs)}. Every practice is with a real partner, planned into your week.`;
  } else if (view.kind === 'trial') {
    kicker = 'Your free month';
    big = view.remaining;
    unit = 'left this week';
    line = `${view.perWeek} planned practices a week until ${dateLabel(view.trialEndsMs)}.`;
  } else if (view.kind === 'unlimited') {
    kicker = 'Your plan';
    big = '∞';
    unit = 'unlimited practice';
    line = 'Planned practices are not counted for you.';
  } else {
    kicker = 'Your free month is over';
    big = null;
    unit = null;
    line = 'Pick a package and your planned practices carry on, with a partner at your level every week.';
  }
  const share = view.kind === 'package' && view.total
    ? Math.min(100, Math.round(((view.used + view.reserved) / view.total) * 100)) : null;
  return (
    <section className="pl-card pl-card--hero pk-hero" style={clock}>
      <HeroParade />
      <p className="pk-hero-kicker">{kicker}</p>
      {big !== null ? (
        <p className="pk-hero-big"><span className="pk-hero-num">{big}</span> <span className="pk-hero-unit">{unit}</span></p>
      ) : (
        <h1 className="pk-hero-title">Keep your week going</h1>
      )}
      <p className="pk-hero-line">{line}</p>
      {share !== null && (
        <div className="pk-hero-bar" role="img" aria-label={`${share}% of this package used or booked`}>
          <span style={{ width: `${share}%` }} />
        </div>
      )}
    </section>
  );
}

function ThisPeriod({ view }) {
  return (
    <section className="pk-card pk-period">
      <UseRing used={view.used} reserved={view.reserved} total={view.total} />
      <dl className="pk-period-stats">
        <div><dt>Held</dt><dd>{view.used}</dd></div>
        <div><dt>Booked</dt><dd>{view.reserved}</dd></div>
        <div className="pk-period-back">
          <dt>Came back</dt><dd>{view.returned}</dd>
        </div>
      </dl>
      {view.returned > 0 && (
        <p className="pk-period-note">
          <RotateCcw size={14} aria-hidden="true" />
          {view.returned === 1 ? 'One practice' : `${view.returned} practices`} came back: your partner didn’t come or nobody was found.
        </p>
      )}
    </section>
  );
}

export default function Packages({ user }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { config, view: liveView, loading } = usePackages(user);
  const isAdmin = isAdminUser(user);
  const view = (isAdmin && PREVIEWS[params.get('preview')]) || liveView;
  const [weeklyTarget, setWeeklyTarget] = useState(null);
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, 'onboarding', user.uid))
      .then((s) => setWeeklyTarget(s.exists() ? s.get('weeklyTarget') || null : null))
      .catch(() => {});
  }, [user?.uid]);

  const packages = config.packages;
  const fits = fitsWeek(packages, weeklyTarget || 2);
  const chosen = packages.find((p) => p.size === (picked || fits)) || packages[0];
  const isRenewal = view.kind === 'package';

  return (
    <div className="pk-page">
      <header className="pk-top">
        <button type="button" className="pk-back" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <h2 className="pk-top-title">Your plan</h2>
      </header>

      {loading && !params.get('preview') ? <div className="pk-skeleton" aria-hidden="true" /> : <Hero view={view} />}

      {view.kind === 'package' && <ThisPeriod view={view} />}

      {view.kind !== 'unlimited' && (
        <>
          <div className="pk-section-head">
            <h3>{isRenewal ? 'Add a package' : 'Packages'}</h3>
            <p>30 days of planned practice with real partners.{isRenewal ? ' What you have left moves over.' : ''}</p>
          </div>

          <div className="pk-grid" role="radiogroup" aria-label="Packages">
            {packages.map((p, i) => {
              const { Svg, width, name } = CREATURES[Math.min(i, CREATURES.length - 1)];
              const on = p.size === chosen.size;
              return (
                <button
                  key={p.size}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`pk-pack${on ? ' is-on' : ''}`}
                  onClick={() => setPicked(p.size)}
                >
                  {p.size === fits && <span className="pk-fits">Fits your week</span>}
                  <span className={`pk-creature pk-creature--${name.toLowerCase()}`} aria-hidden="true">
                    <span className="pk-creature-bob"><Svg width={width} eye="var(--pk-sea)" /></span>
                  </span>
                  <span className="pk-pack-size">{p.size}</span>
                  <span className="pk-pack-unit">practices · ≈ {perWeekOf(p.size)} a week</span>
                  <span className="pk-pack-price">
                    {formatPrice(p.price)} <small>{config.currency}</small>
                  </span>
                  <span className="pk-pack-per">{formatPrice(perPractice(p))} {config.currency} a practice</span>
                  <span className="pk-pack-check" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
                </button>
              );
            })}
          </div>

          <a
            className="pk-cta"
            href={whatsappLink(packageMessage({ name: user?.name, size: chosen.size, price: chosen.price, currency: config.currency }))}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={18} aria-hidden="true" />
            Get {chosen.size} practices · {formatPrice(chosen.price)} {config.currency}
          </a>
          <p className="pk-cta-note">The team sets it up for you on WhatsApp. Paying in the app through Google Play is coming.</p>
        </>
      )}

      <section className="pk-card pk-rules">
        <h3>How it counts</h3>
        <ul>
          <li>
            <span className="pk-rule-icon"><CalendarCheck size={18} aria-hidden="true" /></span>
            <span><b>One booked practice, one from your package.</b> Cancel up to 2 hours before and it comes straight back.</span>
          </li>
          <li>
            <span className="pk-rule-icon"><RotateCcw size={18} aria-hidden="true" /></span>
            <span><b>If we let you down, it’s yours again.</b> Your partner didn’t come, or nobody was found — the practice comes back, and up to {config.carryMax ?? 4} move into your next month.</span>
          </li>
          <li>
            <span className="pk-rule-icon"><PhoneCall size={18} aria-hidden="true" /></span>
            <span><b>Calls with friends and AInur are always free.</b> A package is only for the practices we plan for you.</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
