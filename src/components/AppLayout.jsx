import React, { useState, useEffect } from 'react';
import BottomNav from './BottomNav';
import InstallGate from './InstallGate';
import { useLocation } from 'react-router-dom';

export default function AppLayout({ children, user }) {
  const [forceMobile, setForceMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator?.standalone === true;
      const manual = localStorage.getItem('manualMobileMode') === 'true';
      return isMobile || isPWA || manual;
    }
    return false;
  });
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

      const mobileMode = isMobile || isPWA || manualMobileMode;
      setForceMobile(mobileMode);

      // Update app height to prevent mobile browser URL bar scroll issues
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
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
  // A ONE-WAY DOOR, until now. "Force mobile view" lives in the desktop
  // sidebar, and turning it on removes the desktop layout — which is where the
  // switch was. The only way back was to clear the site's storage by hand, so a
  // laptop stayed stuck with a phone layout stretched across a 1920px screen.
  // On a wide window the way out is offered where the layout actually is.
  const stuckOnDesktop = manualMobileMode && typeof window !== 'undefined' && window.innerWidth > 768;

  if (forceMobile) {
    // No SettingsPanel here: nothing ever opened it (setSettingsOpen(true) was
    // never called), so it sat closed and unreachable — which is why the theme
    // switch appeared to be missing. On mobile it lives in the Profile page,
    // where users expect settings to be.
    return (
      <div className="mobile-layout" style={{ paddingTop: 'var(--safe-area-top, 0px)', paddingBottom: 'var(--safe-area-bottom, 0px)' }}>
        <div className="main-content">
          {stuckOnDesktop && (
            <button type="button" className="layout-escape" onClick={toggleManualMobileMode}>
              Desktop view
            </button>
          )}
          {children}
          <BottomNav user={user} />
          <InstallGate />
        </div>
      </div>
    );
  }

  // -------------------------
  // 2. DESKTOP LAYOUT
  // -------------------------
  // NO SIDEBAR. It was a permanent 300px panel holding two switches — dark
  // mode and "force mobile view" — which is a third of a laptop screen spent on
  // settings nobody changes twice, while the content it pushed aside is what
  // the lesson is taught from. Both switches now live in Profile, where every
  // other setting already was.
  return (
    <div className="desktop-layout">
      <main className="main-content">
        {children}
        {/* Desktop-da əvvəllər HEÇ BİR naviqasiya yox idi (sidebar yalnız
            Settings-dir) — müəllim PC-də Dashboard-a keçə bilmirdi. Eyni alt
            nav burada da göstərilir; tab dəsti rola görə özü uyğunlaşır. */}
        <BottomNav user={user} />
      </main>
    </div>
  );
}
