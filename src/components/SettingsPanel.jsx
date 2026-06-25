import React from 'react';
import { Moon, Settings, Sun, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function SettingsPanel({ open, onClose }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

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

        <div className="settings-row">
          <div className="settings-row-label">
            <Moon size={17} strokeWidth={2.2} />
            <span>Dark Mode</span>
          </div>
          <button
            type="button"
            className={`theme-switch ${isDark ? 'dark' : 'light'}`}
            onClick={toggleTheme}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            aria-pressed={isDark}
          >
            <span className="theme-switch-thumb">
              {isDark ? <Moon size={14} /> : <Sun size={14} />}
            </span>
          </button>
        </div>

        <div className="settings-divider" />
      </aside>
    </>
  );
}
