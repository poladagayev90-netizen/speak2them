import React, { useState } from 'react';
import BottomNav from './BottomNav';
import SettingsPanel from './SettingsPanel';
import SettingsButton from './SettingsButton';
import InstallPrompt from './InstallPrompt';
import { useLocation } from 'react-router-dom';

export default function AppLayout({ children, user }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const location = useLocation();

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  if (!user || isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="app-layout">
      {/* Desktop Sidebar (Settings) - Hidden on mobile by default CSS */}
      <div className="desktop-sidebar">
        <SettingsPanel open={true} onClose={() => {}} isDesktop={true} />
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        <SettingsButton onClick={() => setSettingsOpen(true)} />
        {children}
        <BottomNav user={user} onOpenSettings={() => setSettingsOpen(true)} />
        <InstallPrompt />
      </div>

      {/* Mobile Settings Drawer - Overlays on mobile */}
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} isDesktop={false} />
    </div>
  );
}
