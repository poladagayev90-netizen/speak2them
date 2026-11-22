import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, BadgeCheck, CheckCircle2, Clock, Users } from 'lucide-react';
import { db } from '../firebase';
import { isAdminUser } from '../constants';
import './PartnerDashboard.css';

// /partner — SpeakLab Verified Partner status view (Phase 2 data model).
// Strict privacy invariant: shows ONLY referred learners' firstName +
// joinedPackage (Yes / Not yet). Never phone, email, package size, or amount.
// The owed/paid record reflects manual admin card transfers (never in-app currency).

const fmtDate = (ms) => {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const fmtAzn = (n) => {
  const v = Number(n) || 0;
  return (Math.round(v * 100) / 100).toFixed(Number.isInteger(v) ? 0 : 2);
};

export default function PartnerDashboard({ user }) {
  const navigate = useNavigate();
  const allowed = user?.partnerVerified === true || isAdminUser(user);
  const [ledger, setLedger] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [payoutEnabled, setPayoutEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allowed || !user?.uid) {
      setLoading(false);
      return undefined;
    }
    let gotLedger = false;
    let gotRefs = false;
    const done = () => { if (gotLedger && gotRefs) setLoading(false); };

    const u1 = onSnapshot(doc(db, 'partnerLedger', user.uid), (snap) => {
      setLedger(snap.exists() ? (snap.data() || {}) : {});
      gotLedger = true;
      done();
    }, () => { gotLedger = true; done(); });

    const u2 = onSnapshot(collection(db, 'partnerLedger', user.uid, 'referrals'), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (Number(b.callAtMs) || 0) - (Number(a.callAtMs) || 0));
      setReferrals(list);
      gotRefs = true;
      done();
    }, () => { gotRefs = true; done(); });

    const u3 = onSnapshot(doc(db, 'appConfig', 'partners'), (snap) => {
      setPayoutEnabled(snap.exists() && snap.get('payoutEnabled') === true);
    }, () => setPayoutEnabled(false));

    return () => { u1(); u2(); u3(); };
  }, [allowed, user?.uid]);

  if (!allowed) {
    return (
      <div className="pt-page">
        <header className="pt-top">
          <button type="button" className="pt-back" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft size={22} />
          </button>
          <h2 className="pt-top-title">Verified Partner</h2>
        </header>
        <section className="pt-card">
          <p className="pt-empty">This page is only open to SpeakLab Verified Partners.</p>
        </section>
      </div>
    );
  }

  const totalCalls = referrals.length;
  const joinedCount = referrals.filter((r) => r.joinedPackage === true).length;
  const earned = Number(ledger?.totalEarnedAzn) || 0;
  const paid = Number(ledger?.totalPaidAzn) || 0;
  const owed = Number(ledger?.balanceAzn) || 0;
  const showLedgerAmounts = payoutEnabled || earned > 0 || paid > 0 || owed > 0;

  return (
    <div className="pt-page">
      <header className="pt-top">
        <button type="button" className="pt-back" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <h2 className="pt-top-title">Verified Partner</h2>
      </header>

      <section className="pt-card pt-hero">
        <div className="pt-badge">
          <BadgeCheck size={16} strokeWidth={2.2} aria-hidden="true" />
          <span>SpeakLab Verified Partner</span>
        </div>
        <p className="pt-hero-sub">
          Newcomers whose first 5+ minute practice was with you. Only their first name and whether they joined a package are shown.
        </p>
        <div className="pt-stats">
          <div>
            <span className="pt-stat-val">{totalCalls}</span>
            <span className="pt-stat-lbl">Welcomed</span>
          </div>
          <div>
            <span className="pt-stat-val">{joinedCount}</span>
            <span className="pt-stat-lbl">Joined a package</span>
          </div>
        </div>
      </section>

      <section className="pt-card">
        <h3 className="pt-sec-title">Payout record</h3>
        {showLedgerAmounts ? (
          <>
            <div className="pt-ledger-grid">
              <div>
                <span className="pt-stat-val">{fmtAzn(owed)} <small>AZN</small></span>
                <span className="pt-stat-lbl">Owed</span>
              </div>
              <div>
                <span className="pt-stat-val">{fmtAzn(paid)} <small>AZN</small></span>
                <span className="pt-stat-lbl">Paid</span>
              </div>
              <div>
                <span className="pt-stat-val">{fmtAzn(earned)} <small>AZN</small></span>
                <span className="pt-stat-lbl">Total</span>
              </div>
            </div>
            <p className="pt-note">
              Transfers are sent manually to your card by the SpeakLab admin. This is an accounting record of what is owed and what has been paid.
            </p>
          </>
        ) : (
          <p className="pt-note">
            Payouts are not turned on yet. Your first-call introductions are already being tracked transparently below.
          </p>
        )}
      </section>

      <section className="pt-card">
        <div className="pt-sec-head">
          <h3 className="pt-sec-title">
            <Users size={16} strokeWidth={2} aria-hidden="true" /> Newcomers you welcomed
          </h3>
          <span className="pt-sec-count">{totalCalls}</span>
        </div>

        {loading ? (
          <p className="pt-empty">Loading…</p>
        ) : referrals.length === 0 ? (
          <p className="pt-empty">No first-call introductions recorded yet. Calls of 5+ minutes appear here automatically.</p>
        ) : (
          <ul className="pt-list">
            {referrals.map((r) => (
              <li key={r.id} className="pt-row">
                <div className="pt-row-left">
                  <span className="pt-name">{r.firstName || 'Learner'}</span>
                  {r.callAtMs > 0 && <span className="pt-date">First call · {fmtDate(r.callAtMs)}</span>}
                </div>
                <span className={`pt-status${r.joinedPackage ? ' is-joined' : ''}`}>
                  {r.joinedPackage ? (
                    <>
                      <CheckCircle2 size={14} strokeWidth={2.2} aria-hidden="true" />
                      Joined
                    </>
                  ) : (
                    <>
                      <Clock size={14} strokeWidth={2} aria-hidden="true" />
                      Not yet
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
