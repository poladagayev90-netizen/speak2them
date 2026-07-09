import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Bell, Share, Plus, MoreVertical, MessageCircle, Copy, Check, ExternalLink } from 'lucide-react';

const BYPASS_KEY = 'installGateBypass';
const SUPPORT_WHATSAPP = 'https://wa.me/994513549195';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

// In-app browsers (Instagram, Facebook, TikTok, WeChat, Android WebView, …)
// cannot install a PWA — the user must first reopen the link in a real browser.
const isInAppBrowser = () =>
  /FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|musical_ly|BytedanceWebview|Snapchat|MicroMessenger|; wv\)/i.test(navigator.userAgent);

const isIOS = () =>
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  // iPadOS 13+ reports as "Mac"; a touch-capable Mac is really an iPad.
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const isAndroid = () => /Android/i.test(navigator.userAgent);

const isMobile = () => isAndroid() || isIOS();

// Add-to-Home-Screen on iOS only works in Safari, not Chrome/Firefox/Edge iOS.
const isIOSNonSafari = () => isIOS() && /CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);

// Full-screen warning shown to mobile users who have not installed the PWA.
// Installing is what makes push (session reminders) work — especially on iOS,
// where a browser tab can never receive push. Soft gate: an escape and a help
// path mean nobody is ever locked out.
export default function InstallGate() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // The Capacitor native app renders the same web build but is already an
    // installed app — it must never see the "install me" gate.
    if (Capacitor.isNativePlatform()) return;
    if (isStandalone() || !isMobile()) return;
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
  }, []);

  if (!visible) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === 'accepted') setVisible(false);
  };

  const handleBypass = () => {
    sessionStorage.setItem(BYPASS_KEY, '1');
    setVisible(false);
  };

  const openHelp = () => {
    const msg = 'Salam! SpeakLab tətbiqini əsas ekrana əlavə etməkdə kömək lazımdır.';
    window.open(`${SUPPORT_WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const appUrl = window.location.origin;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Linki kopyala:', appUrl);
    }
  };

  const ios = isIOS();
  const inApp = isInAppBrowser();

  const step = (icon, text) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
      <div style={{
        flexShrink: 0, width: 36, height: 36, borderRadius: 10,
        background: 'rgba(124,111,247,0.15)', color: '#7c6ff7',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <span style={{ color: '#e7e7f5', fontSize: 14, lineHeight: 1.4 }}>{text}</span>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'linear-gradient(160deg, #14121f, #0b0a14)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '28px 22px',
      overflowY: 'auto',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18, margin: '0 auto 18px',
          background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34,
        }}>
          ⚠️
        </div>

        <h2 style={{ color: '#fff', fontSize: 21, fontWeight: 800, textAlign: 'center', margin: '0 0 10px' }}>
          {inApp ? 'Brauzerdə aç' : 'Tətbiqi əsas ekrana əlavə et'}
        </h2>
        <p style={{ color: '#a9a9c4', fontSize: 14, lineHeight: 1.5, textAlign: 'center', margin: '0 0 22px' }}>
          {inApp ? (
            <>
              Bu tətbiqi burada quraşdırmaq mümkün deyil. Linki
              {' '}<b style={{ color: '#fff' }}>Safari</b> və ya <b style={{ color: '#fff' }}>Chrome</b> brauzerində açıb
              əsas ekrana əlavə et — yoxsa <b style={{ color: '#f59e0b' }}>bildirişlər gəlməyəcək</b>.
            </>
          ) : (
            <>
              SpeakLab-ı tam istifadə etmək və sessiya bildirişlərini almaq üçün tətbiqi əsas ekrana əlavə etməlisən.
              Əks halda <b style={{ color: '#f59e0b' }}>bildirişlər gəlməyəcək</b> və sessiyaları qaçıracaqsan.
            </>
          )}
        </p>

        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(124,111,247,0.25)',
          borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {inApp ? (
            <>
              {step(<MoreVertical size={18} />, 'Yuxarı küncdəki ⋯ menyusunu aç')}
              {step(<ExternalLink size={18} />, '“Brauzerdə aç” (Open in browser) seç')}
              {step(<Plus size={18} />, 'Brauzerdə əsas ekrana əlavə et')}
              <button
                onClick={copyLink}
                style={{
                  marginTop: 4, border: 'none', borderRadius: 12, padding: '13px',
                  background: 'linear-gradient(135deg, #7c6ff7, #6355e0)', color: '#fff',
                  fontSize: 15, fontWeight: 800, cursor: 'pointer', width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {copied ? <><Check size={16} /> Kopyalandı</> : <><Copy size={16} /> Linki kopyala</>}
              </button>
            </>
          ) : ios ? (
            <>
              {isIOSNonSafari() && (
                <p style={{ color: '#f59e0b', fontSize: 13, margin: 0, fontWeight: 600 }}>
                  Bu səhifəni əvvəlcə <b>Safari</b> brauzerində aç.
                </p>
              )}
              {step(<Share size={18} />, 'Aşağıdakı Paylaş (Share) düyməsinə toxun')}
              {step(<Plus size={18} />, '“Ana ekrana əlavə et” (Add to Home Screen) seç')}
              {step(<Bell size={18} />, 'Tətbiqi əsas ekrandan aç və bildirişlərə icazə ver')}
            </>
          ) : deferredPrompt ? (
            <>
              <p style={{ color: '#a9a9c4', fontSize: 13, margin: 0, textAlign: 'center' }}>
                Bir toxunuşla quraşdır:
              </p>
              <button
                onClick={handleInstall}
                style={{
                  border: 'none', borderRadius: 12, padding: '14px',
                  background: 'linear-gradient(135deg, #7c6ff7, #6355e0)', color: '#fff',
                  fontSize: 16, fontWeight: 800, cursor: 'pointer', width: '100%',
                }}
              >
                Quraşdır
              </button>
            </>
          ) : (
            <>
              {step(<MoreVertical size={18} />, 'Brauzerin ⋮ menyusunu aç')}
              {step(<Plus size={18} />, '“Tətbiqi quraşdır” və ya “Ana ekrana əlavə et” seç')}
              {step(<Bell size={18} />, 'Tətbiqi əsas ekrandan aç və bildirişlərə icazə ver')}
            </>
          )}
        </div>

        <button
          onClick={openHelp}
          style={{
            marginTop: 16, width: '100%', border: '1px solid rgba(255,255,255,0.15)',
            background: 'transparent', color: '#e7e7f5', borderRadius: 12, padding: '12px',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <MessageCircle size={16} /> Kömək lazımdır?
        </button>

        <button
          onClick={handleBypass}
          style={{
            marginTop: 12, width: '100%', border: 'none', background: 'none',
            color: '#6b6b85', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Hələlik davam et
        </button>
      </div>
    </div>
  );
}
