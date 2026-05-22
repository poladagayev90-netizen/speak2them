import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function Chats({ user }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'chats'), where('participants', 'array-contains', user.uid)),
      async (snap) => {
        const chatList = [];
        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          const peerId = data.participants?.find(p => p !== user.uid);
          if (!peerId) continue;

          const userSnap = await getDocs(
            query(collection(db, 'users'), where('uid', '==', peerId))
          );
          const peerData = userSnap.docs[0]?.data();

          chatList.push({
            chatId: docSnap.id,
            peerId,
            peerName: peerData?.name || 'User',
            peerPhoto: peerData?.photo || '',
            lastMessage: data.lastMessage || '',
            updatedAt: data.updatedAt,
          });
        }
        chatList.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
        setChats(chatList);
        setLoading(false);
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