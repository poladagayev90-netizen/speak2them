import React from 'react';
import { Settings } from 'lucide-react';

export default function SettingsButton({ onClick }) {
  return (
    <button
      type="button"
      className="settings-button"
      onClick={onClick}
      aria-label="Open settings"
      title="Settings"
    >
      <Settings size={22} strokeWidth={2.3} />
    </button>
  );
}
