import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function Chats({ user }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !user.uid) {
      console.error('[Chats] User data missing');
      setLoading(false);
      return;
    }

    const loadChats = async () => {
      try {
        console.log('[Chats] Loading chats for user:', user.uid);
        const chatsSnapshot = await getDocs(collection(db, 'chats'));
        console.log('[Chats] Found', chatsSnapshot.size, 'chat documents');
        const chatsList = [];

        for (const chatDoc of chatsSnapshot.docs) {
          try {
            const chatId = chatDoc.id;
            // Verify current user is participant
            if (!chatId.includes(user.uid)) {
              continue;
            }

            const uids = chatId.split('_');
            if (uids.length !== 2) {
              console.warn('[Chats] Invalid chatId format:', chatId);
              continue;
            }

            const peerId = uids[0] === user.uid ? uids[1] : uids[0];
            console.log('[Chats] Processing chat with peer:', peerId);

            const peerDoc = await getDoc(doc(db, 'users', peerId));
            if (!peerDoc.exists()) {
              console.warn('[Chats] Peer document not found:', peerId);
              continue;
            }

            const peerData = peerDoc.data();

            // Get last message
            let lastMessage = null;
            try {
              const messagesSnapshot = await getDocs(
                query(
                  collection(db, 'chats', chatId, 'messages'),
                  orderBy('createdAt', 'desc'),
                  limit(1)
                )
              );
              lastMessage = messagesSnapshot.empty ? null : messagesSnapshot.docs[0].data();
            } catch (msgErr) {
              console.warn('[Chats] Error loading messages for', chatId, msgErr);
            }

            chatsList.push({
              chatId,
              peerId,
              peerData,
              lastMessage,
              timestamp: lastMessage?.createdAt,
            });
          } catch (chatError) {
            console.error('[Chats] Error processing chat:', chatError);
            continue;
          }
        }

        // Sort by timestamp
        chatsList.sort((a, b) => {
          const aTime = a.timestamp?.toMillis?.() || 0;
          const bTime = b.timestamp?.toMillis?.() || 0;
          return bTime - aTime;
        });

        console.log('[Chats] Loaded', chatsList.length, 'chats');
        setChats(chatsList);
      } catch (error) {
        console.error('[Chats] Error loading chats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadChats();
  }, [user, user.uid]);

  const formatTime = (timestamp) => {
    try {
      if (!timestamp) return '';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch (e) {
      console.error('[Chats] Error formatting time:', e);
      return 'unknown';
    }
  };

  return (
    <div className="chats-page" style={{
      minHeight: '100vh',
      background: '#0f0f1a',
      paddingBottom: '80px',
    }}>
      <div className="chats-header" style={{
        padding: '20px',
        background: '#1e1e30',
        borderBottom: '1px solid #2e2e50',
      }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 700,
          margin: 0,
        }}>💬 Messages</h1>
      </div>

      <div className="chats-body" style={{
        padding: '16px',
      }}>
        {loading ? (
          <div className="empty-state" style={{
            marginTop: '40px',
            textAlign: 'center',
          }}>
            <div className="empty-icon" style={{
              fontSize: '48px',
              marginBottom: '12px',
            }}>⏳</div>
            <p style={{ color: '#888' }}>Loading chats...</p>
          </div>
        ) : chats.length === 0 ? (
          <div className="empty-state" style={{
            marginTop: '40px',
            textAlign: 'center',
          }}>
            <div className="empty-icon" style={{
              fontSize: '48px',
              marginBottom: '12px',
            }}>💬</div>
            <p style={{ color: '#888' }}>No chats yet. Start a conversation!</p>
          </div>
        ) : (
          <div className="chats-list">
            {chats.map((chat) => (
              <div
                key={chat.chatId}
                onClick={() => navigate(`/chat/${chat.peerId}`)}
                style={{
                  background: '#1e1e30',
                  border: '1px solid #2e2e50',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#7c6ff7';
                  e.currentTarget.style.background = '#2a2a3f';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#2e2e50';
                  e.currentTarget.style.background = '#1e1e30';
                }}
              >
                <div className="user-avatar" style={{
                  width: '50px',
                  height: '50px',
                  minWidth: '50px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #7c6ff7, #5b4de8)',
                  borderRadius: '50%',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '20px',
                  overflow: 'hidden',
                }}>
                  {chat.peerData.photo
                    ? <img src={chat.peerData.photo} alt={chat.peerData.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : chat.peerData.name?.charAt(0).toUpperCase()
                  }
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: '4px',
                  }}>
                    <p style={{
                      fontWeight: 700,
                      fontSize: '15px',
                      margin: 0,
                    }}>
                      {chat.peerData.name}
                    </p>
                    <span style={{
                      fontSize: '12px',
                      color: '#888',
                      marginLeft: '8px',
                    }}>
                      {formatTime(chat.timestamp)}
                    </span>
                  </div>
                  <p style={{
                    fontSize: '12px',
                    color: '#999',
                    margin: 0,
                    marginBottom: '4px',
                  }}>
                    {chat.peerData.level || 'English Speaker'}
                  </p>
                  {chat.lastMessage && (
                    <p style={{
                      fontSize: '13px',
                      color: '#aaa',
                      margin: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {chat.lastMessage.text}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
