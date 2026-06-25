import React, { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check dismissal
    if (localStorage.getItem('installDismissed')) return;

    // Increment visit count
    const visits = parseInt(localStorage.getItem('appVisits') || '0', 10) + 1;
    localStorage.setItem('appVisits', visits.toString());

    const handler = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      if (visits >= 2) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('installDismissed', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: '80px', // Above bottom nav usually
      left: '16px',
      right: '16px',
      backgroundColor: '#1e1e30',
      border: '1px solid #7c6ff7',
      borderRadius: '16px',
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      zIndex: 9998,
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      animation: 'slideUp 0.3s ease-out'
    }}>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, color: '#fff', fontSize: '14px', fontWeight: '500' }}>
          Add to Home Screen for native experience
        </p>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button 
          onClick={handleInstall}
          style={{
            backgroundColor: '#7c6ff7',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Install
        </button>
        <button 
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '20px',
            padding: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
