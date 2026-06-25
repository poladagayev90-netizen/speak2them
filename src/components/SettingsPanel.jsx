import React from 'react';
import { Moon, Settings, Sun, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function SettingsPanel({ open, onClose, isDesktop, manualMobileMode, toggleManualMobileMode }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  if (isDesktop) {
    return (
      <aside className="settings-sidebar">
        <div className="settings-panel-header">
          <div className="settings-title">
            <Settings size={18} strokeWidth={2.2} />
            <span>Settings</span>
          </div>
        </div>
        <div className="settings-divider" />
        <div className="settings-content">
          <div className="settings-row" onClick={toggleTheme} style={{ cursor: 'pointer' }}>
            <div className="settings-row-label">
              {isDark ? <Moon size={18} strokeWidth={2.2} /> : <Sun size={18} strokeWidth={2.2} />}
              <span>Dark Mode</span>
            </div>
            <button
              type="button"
              className={`theme-switch ${isDark ? 'dark' : 'light'}`}
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              aria-pressed={isDark}
            >
              <span className="theme-switch-thumb"></span>
            </button>
          </div>

          <div className="settings-row" onClick={toggleManualMobileMode} style={{ cursor: 'pointer', marginTop: '8px' }}>
            <div className="settings-row-label">
              <Settings size={18} strokeWidth={2.2} />
              <span>Force Mobile View</span>
            </div>
            <button
              type="button"
              className={`theme-switch ${manualMobileMode ? 'dark' : 'light'}`}
              aria-label="Toggle Force Mobile View"
              aria-pressed={manualMobileMode}
            >
              <span className="theme-switch-thumb"></span>
            </button>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`settings-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-label="Close settings"
        tabIndex={open ? 0 : -1}
      />

      <aside className={`settings-panel ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="settings-panel-header">
          <div className="settings-title">
            <Settings size={18} strokeWidth={2.2} />
            <span>Settings</span>
          </div>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Close settings">
            <X size={20} />
          </button>
        </div>
        <div className="settings-divider" />

        <div className="settings-content">
          <div className="settings-row" onClick={toggleTheme} style={{ cursor: 'pointer' }}>
            <div className="settings-row-label">
              {isDark ? <Moon size={18} strokeWidth={2.2} /> : <Sun size={18} strokeWidth={2.2} />}
              <span>Dark Mode</span>
            </div>
            <button
              type="button"
              className={`theme-switch ${isDark ? 'dark' : 'light'}`}
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              aria-pressed={isDark}
            >
              <span className="theme-switch-thumb"></span>
            </button>
          </div>

          <div className="settings-row" onClick={toggleManualMobileMode} style={{ cursor: 'pointer', marginTop: '8px' }}>
            <div className="settings-row-label">
              <Settings size={18} strokeWidth={2.2} />
              <span>Force Mobile View</span>
            </div>
            <button
              type="button"
              className={`theme-switch ${manualMobileMode ? 'dark' : 'light'}`}
              aria-label="Toggle Force Mobile View"
              aria-pressed={manualMobileMode}
            >
              <span className="theme-switch-thumb"></span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
