import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Check, Copy, Download, ExternalLink, MoreHorizontal } from 'lucide-react';
import { chromeIntentUrl, isInAppBrowser, PLAY_STORE_URL } from '../../utils/installGuide';
import './OpenInBrowser.css';

const PLAY_FROM_INAPP = `${PLAY_STORE_URL}&referrer=utm_source%3Dinapp%26utm_medium%3Dsign_up`;

// True in an Instagram / Facebook / TikTok in-app browser — never in our own
// Capacitor app, whose Android webview UA also says «wv».
export function useInAppBrowser() {
  const [inApp] = useState(() => !Capacitor.isNativePlatform() && isInAppBrowser(navigator.userAgent));
  return inApp;
}

// Stands in for the Google button on Login / Register inside an in-app
// browser, where Google refuses to sign anyone in (utils/installGuide.js).
// Android: one tap hands the page to Chrome, or the Play app. iOS: Instagram
// lets no link out, so it names the ⋯ menu item and offers to copy the link.
// Email sign-up is the form right below, and works here.
export default function OpenInBrowser({ t }) {
  const [copied, setCopied] = useState(false);
  const android = /Android/i.test(navigator.userAgent);
  const href = window.location.href;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy link:', href);
    }
  };

  return (
    <section className="oib" aria-labelledby="oib-title">
      <p id="oib-title" className="oib-title">{t('gate.inapp.title')}</p>
      <p className="oib-sub">{t('inapp.sub')}</p>
      {android ? (
        <div className="oib-actions">
          <a className="oib-btn oib-btn--main" href={chromeIntentUrl(href)}>
            <ExternalLink size={16} aria-hidden="true" /> {t('inapp.chrome')}
          </a>
          <a className="oib-btn" href={PLAY_FROM_INAPP} target="_blank" rel="noopener noreferrer">
            <Download size={16} aria-hidden="true" /> {t('inapp.play')}
          </a>
        </div>
      ) : (
        <>
          <p className="oib-step">
            <span className="oib-glyph" aria-hidden="true"><MoreHorizontal size={16} /></span>
            {t('inapp.ios')}
          </p>
          <div className="oib-actions">
            <button type="button" className="oib-btn" onClick={copy}>
              {copied ? <><Check size={16} aria-hidden="true" /> {t('gate.copied')}</> : <><Copy size={16} aria-hidden="true" /> {t('gate.copy')}</>}
            </button>
          </div>
        </>
      )}
      <p className="oib-email">{t('inapp.email')}</p>
    </section>
  );
}
