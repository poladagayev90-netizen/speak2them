import React, { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  Share, SquarePlus, Check, Menu, MoreHorizontal, MoreVertical, Download, Smartphone,
  ExternalLink, Copy, Globe, MessageCircle, ArrowDown, ArrowUp, ChevronDown, Bell, Phone,
} from 'lucide-react';
import { whatsappLink } from '../constants';
import { detectBrowser, guideFor, PICKABLE } from '../utils/installGuide';
import './InstallGate.css';

const BYPASS_KEY = 'installGateBypass';
const ICONS = { Share, SquarePlus, Check, Menu, MoreHorizontal, MoreVertical, Download, Smartphone, ExternalLink, Copy, Globe };

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

// Full-screen guide shown to mobile users who have not installed the PWA.
// Installing is what makes push (calls, practice reminders) work — on iOS a
// browser tab can never receive push. Soft gate: an escape and a help path
// mean nobody is ever locked out.
//
// The steps are per browser (utils/installGuide.js): each one hides «Add to
// Home Screen» in a different menu, so the gate names that browser's own
// buttons, points at where its button is, and lets the person pick another
// browser when the guess is wrong.
export default function InstallGate() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [copied, setCopied] = useState(false);
  const [picking, setPicking] = useState(false);
  const ua = navigator.userAgent;
  const detected = useMemo(() => detectBrowser(ua, {
    platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints,
  }), [ua]);
  const [browser, setBrowser] = useState(detected);

  useEffect(() => {
    // The Capacitor native app renders the same web build but is already an
    // installed app — it must never see the "install me" gate.
    if (Capacitor.isNativePlatform()) return;
    if (isStandalone() || detected === 'desktop') return;
    if (sessionStorage.getItem(BYPASS_KEY) === '1') return;
    setVisible(true);

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => setVisible(false);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [detected]);

  if (!visible) return null;

  const guide = guideFor(browser, ua);
  const isIOS = browser.startsWith('ios-');
  const options = isIOS ? PICKABLE.ios : (browser === 'inapp' ? [] : PICKABLE.android);
  const showCopy = browser === 'inapp' || guide.needsSafari;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === 'accepted') setVisible(false);
  };

  const handleBypass = () => {
    try { sessionStorage.setItem(BYPASS_KEY, '1'); } catch { /* private mode */ }
    setVisible(false);
  };

  const openHelp = () => {
    const msg = `Hi! I need help adding the SpeakLab app to my home screen (${guide.name}).`;
    window.open(whatsappLink(msg), '_blank');
  };

  const appUrl = window.location.origin;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy link:', appUrl);
    }
  };

  const Pointer = guide.where === 'top-right' ? ArrowUp : ArrowDown;

  return (
    <div className="ig" role="dialog" aria-modal="true" aria-labelledby="ig-title">
      <div className="ig-inner">
        <img className="ig-icon" src="/logo192.png" alt="" width="64" height="64" />
        <h2 id="ig-title" className="ig-title">
          {browser === 'inapp' ? 'Open SpeakLab in your browser' : 'Add SpeakLab to your home screen'}
        </h2>
        <p className="ig-sub">It opens full screen like an app, and your partner&apos;s calls and practice reminders reach you.</p>

        <ul className="ig-perks" aria-label="What you get">
          <li><Phone size={14} aria-hidden="true" /> Calls ring</li>
          <li><Bell size={14} aria-hidden="true" /> Reminders</li>
          <li><Smartphone size={14} aria-hidden="true" /> Full screen</li>
        </ul>

        {deferredPrompt && (
          <button type="button" className="ig-primary" onClick={handleInstall}>
            <Download size={18} aria-hidden="true" /> Install SpeakLab
          </button>
        )}

        <section className="ig-card" aria-label={`Steps for ${guide.name}`}>
          <div className="ig-card-head">
            <span>{deferredPrompt ? 'Or by hand' : 'In'} <b>{guide.name}</b></span>
            {options.length > 1 && (
              <button type="button" className="ig-switch" aria-expanded={picking} onClick={() => setPicking((v) => !v)}>
                Other browser <ChevronDown size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          {picking && (
            <div className="ig-picker" role="listbox" aria-label="Your browser">
              {options.map((b) => (
                <button key={b} type="button" role="option" aria-selected={b === browser}
                  className={`ig-pick ${b === browser ? 'is-on' : ''}`}
                  onClick={() => { setBrowser(b); setPicking(false); }}>
                  {guideFor(b).name}
                </button>
              ))}
            </div>
          )}
          <ol className="ig-steps">
            {guide.steps.map((s, i) => {
              const Icon = ICONS[s.icon] || SquarePlus;
              return (
                <li key={s.text} className="ig-step">
                  <span className="ig-num" aria-hidden="true">{i + 1}</span>
                  <div className="ig-step-body">
                    <p className="ig-step-text">{s.text}</p>
                    {s.hint && <p className="ig-step-hint">{s.hint}</p>}
                  </div>
                  <span className="ig-glyph" aria-hidden="true"><Icon size={18} /></span>
                </li>
              );
            })}
          </ol>
          {showCopy && (
            <button type="button" className="ig-primary ig-primary--soft" onClick={copyLink}>
              {copied ? <><Check size={16} aria-hidden="true" /> Copied</> : <><Copy size={16} aria-hidden="true" /> Copy the link</>}
            </button>
          )}
          <p className="ig-after">Then open SpeakLab from your home screen and allow notifications.</p>
        </section>

        <button type="button" className="ig-secondary" onClick={openHelp}>
          <MessageCircle size={16} aria-hidden="true" /> Need help? Write to us
        </button>
        <button type="button" className="ig-skip" onClick={handleBypass}>Continue in the browser</button>
      </div>

      {/* Points at where this browser keeps its button. */}
      {!deferredPrompt && (
        <span className={`ig-pointer ig-pointer--${guide.where}`} aria-hidden="true"><Pointer size={22} /></span>
      )}
    </div>
  );
}
