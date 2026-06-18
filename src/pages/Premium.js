import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, runTransaction, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { authedFetch } from '../api';
import { FUNCTIONS_BASE } from '../constants';
import { BadgeUnlockModal } from '../components/BadgeSystem';
import { checkNewBadges } from '../badges/checker';
import { applyBadgeRewardsToData } from '../badges/rewards';

const CARD_NUMBER = '4169 7388 XXXX XXXX'; // öz kart nömrəni yaz
const CARD_NAME = 'Polad Agayev';
const PRICE = '3 AZN / ay';
const BOT_LINK = 'https://t.me/Speak2them_bot';
const NOTIFY_URL = `${FUNCTIONS_BASE}/notifyPremiumRequest`;

const features = [
  { icon: '⚡', title: 'Faster Matches', desc: 'Priority queue — daha tez partnyor tapırsan' },
  { icon: '♾️', title: 'Unlimited Calls', desc: 'Limitsiz zəng müddəti' },
  { icon: '🎯', title: 'Advanced Filters', desc: 'Hədəf və mövzuya görə filter' },
  { icon: '👁️', title: 'See Who Viewed', desc: 'Profili kim baxdı gör' },
  { icon: '🚀', title: 'Profile Boost', desc: '10 dəq top-da görün' },
  { icon: '📚', title: 'Expanded Topics', desc: 'Əlavə söhbət mövzuları' },
];

export default function Premium({ user }) {
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [newBadge, setNewBadge] = useState(null);
  const [newBadgeReward, setNewBadgeReward] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.uid) return;
    let active = true;

    const grantExplorerBadge = async () => {
      let unlock = null;

      try {
        await runTransaction(db, async (transaction) => {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await transaction.get(userRef);
          const userData = userSnap.data() || {};
          const updatedStats = { ...userData, hasVisitedPremium: true };
          const newBadges = checkNewBadges(updatedStats, userData.badges || []);
          const rewardResult = applyBadgeRewardsToData(updatedStats, newBadges);

          transaction.set(userRef, {
            hasVisitedPremium: true,
            premiumVisitedAt: serverTimestamp(),
            ...(newBadges.length > 0 ? rewardResult.updates : {}),
            ...(newBadges.length > 0 ? { badgeUpdatedAt: serverTimestamp() } : {}),
          }, { merge: true });

          if (newBadges.length > 0) {
            unlock = {
              badge: newBadges[0],
              rewardMessage: rewardResult.rewardMessages.join(', '),
            };
          }
        });

        if (active && unlock) {
          setNewBadge(unlock.badge);
          setNewBadgeReward(unlock.rewardMessage);
        }
      } catch (e) {
        console.error('Explorer badge error:', e);
      }
    };

    grantExplorerBadge();

    return () => {
      active = false;
    };
  }, [user?.uid]);

  const handleCopy = () => {
    navigator.clipboard.writeText(CARD_NUMBER.replace(/\s/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNotify = async () => {
    setError('');
    try {
      // Firestore-a premium sorğusu yaz
      await setDoc(doc(db, 'premiumRequests', user.uid), {
        uid: user.uid,
        name: user.displayName || user.name || 'User',
        email: user.email || '',
        telegramId: user.telegramId || '',
        requestedAt: serverTimestamp(),
        status: 'pending',
      });

      // Admin-ə bot vasitəsilə xəbər ver
      await authedFetch(NOTIFY_URL, {
        method: 'POST',
        body: JSON.stringify({
          userName: user.displayName || user.name || 'User',
          userEmail: user.email || '',
          userId: user.uid,
        }),
      }).catch(() => {});

      setSent(true);
    } catch (e) {
      console.error('Failed to send premium request:', e);
      setError(e.message || 'Premium request could not be sent.');
    }
  };

  if (user?.isPremium) {
    return (
      <div className="profile-page">
        <BadgeUnlockModal
          badge={newBadge}
          rewardMessage={newBadgeReward}
          onClose={() => {
            setNewBadge(null);
            setNewBadgeReward('');
          }}
        />
        <div className="profile-header">
          <button className="btn-back" onClick={() => navigate('/')}>← Back</button>
          <h2>Premium</h2>
        </div>
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>👑</div>
          <h2 style={{ color: '#f59e0b', marginBottom: '8px' }}>Siz Premium üzvüsünüz!</h2>
          <p style={{ color: '#888' }}>Bütün premium xüsusiyyətlər aktivdir.</p>
          <button className="btn-primary" style={{ marginTop: '32px' }} onClick={() => navigate('/')}>
            Ana səhifəyə qayıt
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <BadgeUnlockModal
        badge={newBadge}
        rewardMessage={newBadgeReward}
        onClose={() => {
          setNewBadge(null);
          setNewBadgeReward('');
        }}
      />
      <div className="profile-header">
        <button className="btn-back" onClick={() => navigate('/')}>← Back</button>
        <h2>Premium</h2>
      </div>

      <div style={{ padding: '0 16px 40px' }}>
        {error && (
          <div style={{
            background: '#ef444422',
            border: '1px solid #ef444455',
            color: '#fecaca',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '16px',
            fontSize: '13px',
          }}>
            {error}
          </div>
        )}

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #f59e0b22, #d9770622)',
          border: '1px solid #f59e0b44',
          borderRadius: '20px', padding: '24px', textAlign: 'center', marginBottom: '24px',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>👑</div>
          <h2 style={{ color: '#f59e0b', marginBottom: '4px', fontSize: '22px' }}>Speak2Them Premium</h2>
          <p style={{ color: '#888', fontSize: '14px', marginBottom: '16px' }}>
            Daha sürətli match, daha keyfiyyətli söhbət
          </p>
          <div style={{
            background: '#f59e0b', color: '#1a1000',
            borderRadius: '12px', padding: '10px 24px',
            display: 'inline-block', fontWeight: 800, fontSize: '20px',
          }}>
            {PRICE}
          </div>
        </div>

        {/* Features */}
        <div style={{ marginBottom: '24px' }}>
          {features.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: '14px',
              background: '#1e1e30', borderRadius: '14px',
              padding: '14px 16px', marginBottom: '10px',
              border: '1px solid #2e2e50',
            }}>
              <span style={{ fontSize: '24px', minWidth: '32px' }}>{f.icon}</span>
              <div>
                <p style={{ fontWeight: 700, marginBottom: '2px', color: '#fff' }}>{f.title}</p>
                <p style={{ fontSize: '13px', color: '#888' }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Payment */}
        <div style={{
          background: '#1e1e30', border: '1px solid #2e2e50',
          borderRadius: '20px', padding: '20px', marginBottom: '16px',
        }}>
          <p style={{ fontWeight: 700, marginBottom: '16px', fontSize: '16px' }}>
            💳 Ödəniş məlumatları
          </p>

          <div style={{
            background: '#0f0f1a', borderRadius: '12px',
            padding: '16px', marginBottom: '16px',
          }}>
            <p style={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}>Kart nömrəsi</p>
            <p style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '2px', color: '#f59e0b' }}>
              {CARD_NUMBER}
            </p>
            <p style={{ color: '#888', fontSize: '12px', marginTop: '8px' }}>Ad: {CARD_NAME}</p>
            <p style={{ color: '#888', fontSize: '12px' }}>Məbləğ: {PRICE}</p>
          </div>

          <button
            onClick={handleCopy}
            style={{
              width: '100%', padding: '14px',
              background: copied ? '#22c55e' : '#2e2e50',
              color: 'white', border: 'none', borderRadius: '12px',
              fontSize: '15px', fontWeight: 700, cursor: 'pointer',
              marginBottom: '12px', transition: 'background 0.3s',
            }}
          >
            {copied ? '✅ Kopyalandı!' : '📋 Kart nömrəsini kopyala'}
          </button>

          <div style={{
            background: '#0f0f1a', borderRadius: '12px',
            padding: '14px', marginBottom: '16px',
          }}>
            <p style={{ fontSize: '13px', color: '#aaa', lineHeight: '1.6' }}>
              1. Kart nömrəsini kopyala<br />
              2. Öz bank appından <strong style={{ color: '#fff' }}>{PRICE}</strong> köçür<br />
              3. Skrinşotu <strong style={{ color: '#7c6ff7' }}>@Speak2them_bot</strong>-a göndər<br />
              4. 24 saat ərzində Premium aktivləşdiriləcək
            </p>
          </div>

          {!sent ? (
            <button
              onClick={handleNotify}
              style={{
                width: '100%', padding: '14px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#1a1000', border: 'none', borderRadius: '12px',
                fontSize: '15px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              ✅ Köçürdüm, bildiriş göndər
            </button>
          ) : (
            <div style={{
              background: '#22c55e22', border: '1px solid #22c55e44',
              borderRadius: '12px', padding: '14px', textAlign: 'center',
            }}>
              <p style={{ color: '#22c55e', fontWeight: 700 }}>✅ Bildiriş göndərildi!</p>
              <p style={{ color: '#888', fontSize: '13px', marginTop: '4px' }}>
                Skrinşotu @Speak2them_bot-a göndərdikdən sonra 24 saat ərzində aktivləşdiriləcək.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={() => window.Telegram?.WebApp?.openTelegramLink(BOT_LINK)}
          style={{
            width: '100%', padding: '14px',
            background: '#2e2e50', color: 'white',
            border: '1px solid #7c6ff755', borderRadius: '12px',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          💬 @Speak2them_bot-a skrinşot göndər
        </button>
      </div>
    </div>
  );
}
