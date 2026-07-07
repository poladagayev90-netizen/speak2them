import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, onSnapshot, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function Chats({ user }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const userCacheRef = useRef({});

  useEffect(() => {
    const unsub = onSnapshot(
      query(
        collection(db, 'chats'),
        where('participants', 'array-contains', user.uid),
        orderBy('updatedAt', 'desc'),
        limit(30)
      ),
      async (snap) => {
        try {
          const promises = snap.docs.map(async (docSnap) => {
            const data = docSnap.data();
            const peerId = data.participants?.find(p => p !== user.uid);
            if (!peerId) return null;

            let peerData = userCacheRef.current[peerId];
            if (!peerData) {
              try {
                const userSnap = await getDocs(
                  query(collection(db, 'users'), where('uid', '==', peerId))
                );
                peerData = userSnap.docs[0]?.data() || null;
                userCacheRef.current[peerId] = peerData || { name: 'Unknown' };
              } catch (err) {
                console.error("Error fetching peer:", err);
                peerData = { name: 'Unknown' };
              }
            }

            return {
              chatId: docSnap.id,
              peerId,
              peerName: peerData?.name || 'User',
              peerPhoto: peerData?.photo || '',
              lastMessage: data.lastMessage || '',
              updatedAt: data.updatedAt,
            };
          });

          const chatList = (await Promise.all(promises)).filter(Boolean);
          chatList.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
          
          setChats(chatList);
        } catch (error) {
          console.error("Error in chats snapshot:", error);
        } finally {
          setLoading(false);
        }
      }
    );
    return unsub;
  }, [user]);

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="home-logo">💬 Chats</div>
      </div>
      <div className="home-body" style={{ paddingBottom: '90px' }}>
        {loading ? (
          <div className="empty-state"><p>Loading...</p></div>
        ) : chats.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <p>No chats yet.</p>
            <p>Start a conversation!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {chats.map(chat => (
              <div key={chat.chatId} onClick={() => navigate(`/chat/${chat.peerId}`)} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px 16px', cursor: 'pointer',
                borderBottom: '1px solid #2e2e5033',
                transition: 'background 0.2s',
              }}>
                <div className="user-avatar" style={{ width: '48px', height: '48px', minWidth: '48px', fontSize: '20px' }}>
                  {chat.peerPhoto
                    ? <img src={chat.peerPhoto} alt={chat.peerName} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                    : chat.peerName?.charAt(0).toUpperCase()
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: '15px' }}>{chat.peerName}</p>
                  <p style={{ fontSize: '13px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {chat.lastMessage || 'No messages yet'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}