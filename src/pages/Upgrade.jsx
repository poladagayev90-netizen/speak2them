import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { BadgeUnlockModal } from '../components/BadgeSystem';
import { checkNewBadges } from '../badges/checker';
import { applyBadgeRewardsToData } from '../badges/rewards';

const PLANS = [
  {
    id: 'pack_200',
    name: 'Başlanğıc',
    mins: '200 dəqiqə',
    price: 3.49,
    priceLabel: '3.49 ₼',
    icon: '🔋',
    color: '#185FA5',
    features: ['200 dəqiqə fərdi zəng', 'AInur ilə limitsiz praktika', 'Səviyyəyə görə match'],
  },
  {
    id: 'pack_300',
    name: 'Aktiv',
    mins: '300 dəqiqə',
    price: 4.99,
    priceLabel: '4.99 ₼',
    icon: '🔥',
    color: '#7c6ff7',
    popular: true,
    features: ['300 dəqiqə fərdi zəng', 'AInur ilə limitsiz praktika', 'Priority queue', 'Profil badge'],
  },
  {
    id: 'pack_500',
    name: 'İntensiv',
    mins: '500 dəqiqə',
    price: 7.99,
    priceLabel: '7.99 ₼',
    icon: '🚀',
    color: '#22c55e',
    features: ['500 dəqiqə fərdi zəng', 'AInur ilə limitsiz praktika', 'Priority queue', 'Profil badge', 'Sürətli dəstək'],
  },
];

const COMPARE = [
  { feature: 'Zəng dəqiqəsi', values: ['200', '300', '500'] },
  { feature: 'AInur (Süni intellekt)', values: [true, true, true] },
  { feature: 'Priority queue', values: [false, true, true] },
  { feature: 'Profil badge', values: [false, true, true] },
  { feature: 'Sürətli dəstək', values: [false, false, true] },
];

export default function Upgrade({ user }) {
  const [selected, setSelected] = useState('pack_300');
  const [newBadge, setNewBadge] = useState(null);
  const [newBadgeReward, setNewBadgeReward] = useState('');
  const [, setBadgeQueue] = useState([]);
  const [premiumDiscount, setPremiumDiscount] = useState(user?.premiumDiscountPercent || 0);
  const navigate = useNavigate();
  const plan = PLANS.find(p => p.id === selected);

  useEffect(() => {
    if (!user?.uid) return;
    let active = true;

    const grantExplorerBadge = async () => {
      let unlock = null;
      let nextDiscount = user?.premiumDiscountPercent || 0;

      try {
        await runTransaction(db, async (transaction) => {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await transaction.get(userRef);
          const userData = userSnap.data() || {};
          const updatedStats = { ...userData, hasVisitedPremium: true, visitedPremium: true };
          const newBadges = checkNewBadges(updatedStats);
          const rewardResult = applyBadgeRewardsToData(updatedStats, newBadges);
          nextDiscount = rewardResult.updates.premiumDiscountPercent || userData.premiumDiscountPercent || 0;

          transaction.set(userRef, {
            hasVisitedPremium: true,
            visitedPremium: true,
            premiumVisitedAt: serverTimestamp(),
            ...(newBadges.length > 0 ? rewardResult.updates : {}),
            ...(newBadges.length > 0 ? { badgeUpdatedAt: serverTimestamp() } : {}),
          }, { merge: true });

          if (newBadges.length > 0) {
            unlock = newBadges.map((badgeId, badgeIndex) => ({
              badge: badgeId,
              rewardMessage: rewardResult.rewardMessages[badgeIndex] || '',
            }));
          }
        });

        if (active && unlock?.length) {
          const [firstUnlock, ...remainingUnlocks] = unlock;
          setNewBadge(firstUnlock.badge);
          setNewBadgeReward(firstUnlock.rewardMessage);
          setBadgeQueue(remainingUnlocks);
        }

        if (active) {
          setPremiumDiscount(nextDiscount);
        }
      } catch (e) {
        console.error('Explorer badge error:', e);
      }
    };

    grantExplorerBadge();

    return () => {
      active = false;
    };
  }, [user?.uid, user?.premiumDiscountPercent]);

  const handleContinue = () => {
    if (!plan) return;
    const msg = `Salam! mən ${user?.name || 'istifadəçi'} (ID: ${user?.uid}). SpeakLab tətbiqində ${plan.name} (${plan.mins}) paketini almaq istəyirəm.`;
    const whatsappUrl = `https://wa.me/994513549195?text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a', color: '#fff', fontFamily: 'inherit', paddingBottom: 40 }}>
      <BadgeUnlockModal
        badge={newBadge}
        rewardMessage={newBadgeReward}
        onClose={() => {
          setBadgeQueue((queue) => {
            const [nextUnlock, ...rest] = queue;
            if (nextUnlock) {
              setNewBadge(nextUnlock.badge);
              setNewBadgeReward(nextUnlock.rewardMessage);
              return rest;
            }

            setNewBadge(null);
            setNewBadgeReward('');
            return [];
          });
        }}
      />

      {/* Header */}
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#7c6ff7', fontSize: 15, cursor: 'pointer', fontWeight: 600 }}>← Geri</button>
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '24px 20px 16px' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🎙️</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>Dəqiqə Paketləri (Beta)</h2>
        <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Tətbiqimiz beta versiyadadır. Sizə uyğun dəqiqə paketini seçib praktikaya başlayın.</p>
      </div>

      {premiumDiscount > 0 && (
        <div style={{
          margin: '0 16px 14px',
          background: '#22c55e18',
          border: '1px solid #22c55e55',
          color: '#bbf7d0',
          borderRadius: 14,
          padding: '12px 14px',
          fontSize: 13,
          fontWeight: 700,
          textAlign: 'center',
        }}>
          Explorer endirimi aktivdir: Paketlərə {premiumDiscount}% endirim
        </div>
      )}

      {/* Plans */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PLANS.map(p => (
          <div
            key={p.id}
            onClick={() => setSelected(p.id)}
            style={{
              background: '#1e1e30',
              border: selected === p.id ? `2px solid ${p.color}` : '1px solid #2e2e50',
              borderRadius: 16,
              padding: '14px 16px',
              cursor: 'pointer',
              position: 'relative',
              transition: 'border-color .15s',
            }}
          >
            {p.popular && (
              <div style={{
                position: 'absolute', top: -1, right: 14,
                background: '#7c6ff722', border: '1px solid #7c6ff755',
                color: '#7c6ff7', fontSize: 10, fontWeight: 700,
                padding: '3px 10px', borderRadius: '0 0 8px 8px', letterSpacing: '1px',
              }}>ƏN POPULYAR</div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Radio */}
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: `2px solid ${selected === p.id ? p.color : '#3e3e60'}`,
                  background: selected === p.id ? p.color : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {selected === p.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                </div>

                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${p.color}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>{p.icon}</div>

                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{p.mins}</div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: p.id === 'free' ? '#888' : '#fff' }}>{p.priceLabel}</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #2e2e50', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {p.features.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: f.startsWith('—') ? '#555' : '#aaa' }}>
                  <span style={{ color: f.startsWith('—') ? '#3e3e50' : '#22c55e', fontSize: 14 }}>
                    {f.startsWith('—') ? '✕' : '✓'}
                  </span>
                  {f.startsWith('—') ? f.slice(2) : f}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ padding: '16px 16px 0' }}>
        <button onClick={handleContinue} style={{
          width: '100%', padding: 14,
          background: `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)`,
          border: 'none', borderRadius: 14,
          color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
        }}>
          {plan.name} paketini al — {plan.priceLabel}
        </button>
        <p style={{ textAlign: 'center', fontSize: 11, color: '#555', margin: '10px 0 0' }}>
          Təsdiqləmə prosesi WhatsApp vasitəsilə həyata keçirilir
        </p>
      </div>

      {/* Compare table */}
      <div style={{ padding: '24px 16px 0' }}>
        <p style={{ fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 12 }}>Plan müqayisəsi</p>
        <div style={{ background: '#1e1e30', borderRadius: 14, overflow: 'hidden', border: '1px solid #2e2e50' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2e2e50' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#666', fontWeight: 600 }}>Xüsusiyyət</th>
                {PLANS.map(p => (
                  <th key={p.id} style={{ padding: '10px 6px', textAlign: 'center', color: selected === p.id ? p.color : '#555', fontWeight: 600 }}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < COMPARE.length - 1 ? '1px solid #2e2e5033' : 'none' }}>
                  <td style={{ padding: '9px 12px', color: '#aaa' }}>{row.feature}</td>
                  {row.values.map((v, j) => (
                    <td key={j} style={{ padding: '9px 6px', textAlign: 'center' }}>
                      {typeof v === 'boolean'
                        ? <span style={{ color: v ? '#22c55e' : '#3e3e50', fontSize: 14 }}>{v ? '✓' : '—'}</span>
                        : <span style={{ color: '#888' }}>{v}</span>
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
