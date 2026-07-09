import React, { useEffect, useState } from 'react';
import { getMessaging, isSupported } from 'firebase/messaging';
import { Bell, X } from 'lucide-react';
import { enableNotifications } from '../firebase';
import app from '../firebase';

// Keeps getMessaging from throwing on browsers where it half-exists.
async function messagingSupported() {
  try {
    if (!(await isSupported())) return false;
    getMessaging(app);
    return true;
  } catch {
    return false;
  }
}

const DISMISS_KEY = 'notifPromptDismissed';

// A dismissible opt-in banner. Notification permission must be requested from a
// user gesture (a tap) — required on iOS/installed PWAs and best practice
// everywhere — so the actual request lives behind this button, never on load.
// Getting installed is InstallGate's job; this only handles enabling
// notifications once the app can actually receive them.
export default function NotificationPrompt({ user }) {
  const [mode, setMode] = useState('hidden'); // 'hidden' | 'ask'
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.uid) return;
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
      // No Web Notifications here (e.g. an iOS browser tab) — InstallGate nudges
      // those users to install first, so there is nothing to ask yet.
      if (typeof Notification === 'undefined') return;
      if (Notification.permission !== 'default') return;
      if (!(await messagingSupported())) return;
      if (cancelled) return;
      setMode('ask');
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setMode('hidden');
  };

  const handleEnable = async () => {
    if (busy) return;
    setBusy(true);
    const status = await enableNotifications(user.uid);
    setBusy(false);
    // Granted or hard-denied: either way there's nothing more to ask.
    if (status !== 'default') {
      localStorage.setItem(DISMISS_KEY, '1');
      setMode('hidden');
    }
  };

  if (mode === 'hidden') return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--bg-secondary)', border: '1px solid var(--accent-soft)',
      borderRadius: 14, padding: '12px 14px', marginBottom: 12,
    }}>
      <div style={{
        flexShrink: 0, width: 34, height: 34, borderRadius: 10,
        background: 'var(--accent-soft)', color: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Bell size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}>
          Bildirişləri aç
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.4 }}>
          Sessiya və analiz hazır olanda xəbərdar olmaq üçün icazə ver.
        </div>
      </div>
      <button
        onClick={handleEnable}
        disabled={busy}
        style={{
          flexShrink: 0, border: 'none', borderRadius: 10,
          background: 'var(--accent)', color: 'var(--text-on-accent)',
          padding: '8px 12px', fontSize: 13, fontWeight: 800,
          cursor: busy ? 'default' : 'pointer', whiteSpace: 'nowrap',
        }}
      >
        {busy ? '...' : 'Aç'}
      </button>
      <button
        onClick={dismiss}
        aria-label="Bağla"
        style={{
          flexShrink: 0, border: 'none', background: 'none',
          color: 'var(--text-secondary)', cursor: 'pointer', padding: 4,
          display: 'flex', alignItems: 'center',
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
