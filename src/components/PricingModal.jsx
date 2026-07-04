import React from 'react';
import { ShieldCheck, Star, Zap } from 'lucide-react';

export default function PricingModal({ onClose }) {
  const handleUpgrade = (plan) => {
    alert(`Bu xüsusiyyət tezliklə aktiv olacaq! (Seçilən plan: ${plan})`);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-primary)', borderRadius: '24px', width: '100%', maxWidth: '400px',
        overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #6c63ff, #8b5cf6)', padding: '30px 20px',
          textAlign: 'center', color: 'white'
        }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Premium-a Keçid 🚀</h2>
          <p style={{ margin: '8px 0 0', fontSize: '14px', opacity: 0.9 }}>
            Limitsiz AI Analiz və Premium kurs rejimi ilə ingilis dilinizi zirvəyə daşıyın!
          </p>
        </div>

        {/* Plans */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '60vh', overflowY: 'auto' }}>
          
          {/* Pro Monthly */}
          <div style={{
            border: '2px solid #6c63ff', borderRadius: '16px', padding: '16px',
            background: 'var(--bg-secondary)', position: 'relative'
          }}>
            <div style={{
              position: 'absolute', top: '-12px', right: '16px', background: '#6c63ff',
              color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 700
            }}>ƏN ÇOX SEÇİLƏN</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>Pro Paket</h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Aylıq ödəniş</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>14.99 ₼</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>/ay</span>
              </div>
            </div>
            <ul style={{ padding: 0, margin: '0 0 16px 0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <Star size={16} color="#6c63ff" /> Limitsiz zəng və fəaliyyət
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <Zap size={16} color="#6c63ff" /> Limitsiz Whisper AI səs analizi
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <ShieldCheck size={16} color="#6c63ff" /> Full AI Kurs Rejimi və hesabatlar
              </li>
            </ul>
            <button onClick={() => handleUpgrade('Pro Monthly')} style={{
              width: '100%', padding: '12px', background: '#6c63ff', color: 'white',
              border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '15px', cursor: 'pointer'
            }}>Abunə Ol</button>
          </div>

          {/* Pro Yearly */}
          <div style={{
            border: '1px solid var(--border)', borderRadius: '16px', padding: '16px',
            background: 'var(--bg-secondary)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>Pro İllik</h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>1 illik ödəniş</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>99.99 ₼</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>/il</span>
              </div>
            </div>
            <button onClick={() => handleUpgrade('Pro Yearly')} style={{
              width: '100%', padding: '12px', background: 'transparent', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: '12px', fontWeight: 700, fontSize: '15px', cursor: 'pointer'
            }}>Seç və Sürətlə Öyrən</button>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: 'var(--text-secondary)',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer'
          }}>İndi yox, bəlkə sonra</button>
        </div>

      </div>
    </div>
  );
}
