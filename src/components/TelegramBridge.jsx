import React from 'react';
import { tg } from '../telegram';

export function useIsTelegram() {
  return typeof window !== 'undefined' && 
         window.Telegram?.WebApp?.platform && 
         window.Telegram?.WebApp?.platform !== 'unknown' && 
         window.Telegram?.WebApp?.initData !== '';
}

export function TelegramBridge({ isOpen, onClose }) {
  if (!isOpen) return null;

  const handleOpenBrowser = () => {
    tg.openLink('https://speak2them.vercel.app');
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'flex-end',
      zIndex: 9999
    }}>
      <div style={{
        width: '100%',
        backgroundColor: '#1e1e30',
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
        padding: '24px',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        animation: 'slideUp 0.3s ease-out'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>📱</div>
          <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#fff' }}>Better call quality available</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
            Open in browser for HD audio and full-screen experience
          </p>
        </div>

        <button 
          onClick={handleOpenBrowser}
          className="btn-primary"
          style={{ width: '100%', marginBottom: '12px' }}
        >
          Open in Browser
        </button>
        
        <button 
          onClick={onClose}
          style={{
            width: '100%',
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            padding: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Continue in Telegram
        </button>
      </div>
    </div>
  );
}
