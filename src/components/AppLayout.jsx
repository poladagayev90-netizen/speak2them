import React, { useState, useEffect } from 'react';
import BottomNav from './BottomNav';
import SettingsPanel from './SettingsPanel';
import InstallPrompt from './InstallPrompt';
import { useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

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
      
      // Update app height to prevent mobile browser URL bar scroll issues
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
      
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
  // -------------------------
  const isNative = Capacitor.isNativePlatform();
  if (forceMobile) {
    return (
      <div className="mobile-layout" style={{ paddingTop: isNative ? '38px' : '0' }}>
        <div className="main-content">
          {children}
          <BottomNav user={user} />
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
