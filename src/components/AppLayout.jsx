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
      const isPWA = window.matchMedia('(display-mode: standalone)').matches;
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

  return (
    <div className={`app-layout ${forceMobile ? 'force-mobile' : ''}`}>
      {/* Desktop Sidebar (Settings) - Hidden on mobile by default CSS, and now via JS */}
      {!forceMobile && (
        <div className="desktop-sidebar">
          <SettingsPanel open={true} onClose={() => {}} isDesktop={true} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="main-content">
        <SettingsButton onClick={() => setSettingsOpen(true)} />
        {children}
        <BottomNav user={user} onOpenSettings={() => setSettingsOpen(true)} />
        <InstallPrompt />
      </div>

      {/* Mobile Settings Drawer - Overlays on mobile */}
      {forceMobile && (
        <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} isDesktop={false} />
      )}
    </div>
  );
}
