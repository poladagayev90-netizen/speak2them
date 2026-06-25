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

  const [manualMobileMode, setManualMobileMode] = useState(() => {
    return localStorage.getItem('manualMobileMode') === 'true';
  });

  const toggleManualMobileMode = () => {
    const newVal = !manualMobileMode;
    setManualMobileMode(newVal);
    localStorage.setItem('manualMobileMode', newVal.toString());
  };

  useEffect(() => {
    // AGGRESSIVELY FORCE VIEWPORT META TAG
    // This prevents Android Desktop Site or weird caching from allowing the user to zoom out.
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover');
    
    // Explicitly lock body styles to prevent horizontal bleeding
    document.body.style.width = '100%';
    document.body.style.overflowX = 'hidden';

    const checkLayout = () => {
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      // Improve PWA check to cover iOS navigator.standalone
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      const isTelegram = document.body.classList.contains('is-telegram');
      
      const mobileMode = isMobile || isPWA || isTelegram || manualMobileMode;
      setForceMobile(mobileMode);
      
      // Close settings if switching to mobile
      if (mobileMode) {
        setSettingsOpen(false);
      }
    };
    
    checkLayout();
    window.addEventListener('resize', checkLayout);
    return () => window.removeEventListener('resize', checkLayout);
  }, [manualMobileMode]);

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
          {children}
          <BottomNav user={user} onOpenSettings={() => setSettingsOpen(true)} />
          <InstallPrompt />
        </div>
        <SettingsPanel 
          open={settingsOpen} 
          onClose={() => setSettingsOpen(false)} 
          isDesktop={false} 
          manualMobileMode={manualMobileMode}
          toggleManualMobileMode={toggleManualMobileMode}
        />
      </div>
    );
  }

  // -------------------------
  // 2. DESKTOP LAYOUT
  // -------------------------
  return (
    <div className="desktop-layout">
      <div className="desktop-sidebar">
        <SettingsPanel 
          open={true} 
          onClose={() => {}} 
          isDesktop={true} 
          manualMobileMode={manualMobileMode}
          toggleManualMobileMode={toggleManualMobileMode}
        />
      </div>

      <div className="main-content">
        {children}
        {/* On desktop, settings sidebar is always visible, no bottom nav, no settings button overlay */}
        <InstallPrompt />
      </div>
    </div>
  );
}
