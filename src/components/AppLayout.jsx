import React, { useState, useEffect } from 'react';
import BottomNav from './BottomNav';
import SettingsPanel from './SettingsPanel';
import SettingsButton from './SettingsButton';
import InstallPrompt from './InstallPrompt';
import { useLocation } from 'react-router-dom';

export default function AppLayout({ children, user }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [forceMobile, setForceMobile] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkLayout = () => {
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      // Improve PWA check to cover iOS navigator.standalone
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      const isTelegram = document.body.classList.contains('is-telegram');
      
      const mobileMode = isMobile || isPWA || isTelegram;
      setForceMobile(mobileMode);
      
      // Close settings if switching to mobile
      if (mobileMode) {
        setSettingsOpen(false);
      }
    };
    
    checkLayout();
    window.addEventListener('resize', checkLayout);
    return () => window.removeEventListener('resize', checkLayout);
  }, []);

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  if (!user || isAuthPage) {
    return <>{children}</>;
  }

  // -------------------------
  // 1. MOBILE / PWA LAYOUT
  // -------------------------
  if (forceMobile) {
    return (
      <div className="mobile-layout">
        <div className="main-content">
          <SettingsButton onClick={() => setSettingsOpen(true)} />
          {children}
          <BottomNav user={user} onOpenSettings={() => setSettingsOpen(true)} />
          <InstallPrompt />
        </div>
        <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} isDesktop={false} />
      </div>
    );
  }

  // -------------------------
  // 2. DESKTOP LAYOUT
  // -------------------------
  return (
    <div className="desktop-layout">
      <div className="desktop-sidebar">
        <SettingsPanel open={true} onClose={() => {}} isDesktop={true} />
      </div>

      <div className="main-content">
        {children}
        {/* On desktop, settings sidebar is always visible, no bottom nav, no settings button overlay */}
        <InstallPrompt />
      </div>
    </div>
  );
}
