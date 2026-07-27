import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Zəngə xəbərsiz gəlməyən istifadəçiyə bir dəfəlik nəzakətli xatırlatma.
//
// CƏZA YOXDUR — nə ban, nə bal düşməsi. İcma yeni formalaşır; qaçırılmış bir
// zəngə görə adamı bloklamaq onu tətbiqdən tamamilə uzaqlaşdırar. Mesaj
// ittiham etmir, xahiş edir: hədəf davranışı dəyişməkdir, cəzalandırmaq deyil.
//
// `slotNoticePending` qəsdən server-only DEYİL (bax firestore.rules) — bayrağı
// client təmizləyir. Ən pis hal: istifadəçi öz xatırlatmasını gizlədir, yəni
// təhlükəsizlik təsiri sıfırdır.
export default function SlotNoticeModal({ uid }) {
  const [closed, setClosed] = useState(false);
  if (closed) return null;

  const dismiss = async () => {
    setClosed(true);
    try {
      await setDoc(doc(db, 'users', uid), { slotNoticePending: false }, { merge: true });
    } catch (e) {
      console.error('[SlotNotice] dismiss failed', e);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 4000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(8, 8, 20, 0.72)', padding: '20px',
    }}>
      <div style={{
        width: '100%', maxWidth: '380px',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '18px', padding: '22px', textAlign: 'center',
      }}>
        <div style={{ fontSize: '38px', marginBottom: '10px' }}>🕊️</div>
        <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Son zənginizi qaçırdınız
        </div>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 18px' }}>
          Partnyorunuz sizi gözlədi. Zəhmət olmasa, icmamızın vaxtına hörmət
          edərək yalnız gələcəyinizə əmin olduğunuz saatları seçin.
        </p>
        <button
          type="button"
          onClick={dismiss}
          style={{
            width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-strong))',
            color: '#fff', fontSize: '15px', fontWeight: 800, cursor: 'pointer',
          }}
        >
          Anladım
        </button>
      </div>
    </div>
  );
}
