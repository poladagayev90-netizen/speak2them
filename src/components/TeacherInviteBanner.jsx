import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { respondTeacherInvite } from '../utils/teacher';

// Müəllimin birbaşa göndərdiyi dəvət. Kod paylaşmaq həmişə işləmirdi (link
// mesajda itir, şagird kodu səhv yazır) — bu banner dəvəti şagirdin ÖZ
// ekranına gətirir, heç nə yazmaq lazım deyil.
//
// Razılıq AÇIQdır: qəbul düyməsinin üstündə müəllimin nə görəcəyi yazılır,
// qəbul özü razılıq sayılır (kod axınındakı checkbox ilə eyni hüquqi çəki).
export default function TeacherInviteBanner({ user }) {
  const [invite, setInvite] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    // Artıq müəllimi olan şagirdə dəvət göstərilmir.
    if (!user?.uid || user.teacherId) { setInvite(null); return undefined; }
    return onSnapshot(
      query(
        collection(db, 'teacherInvites'),
        where('studentUid', '==', user.uid),
        where('status', '==', 'pending'),
      ),
      (snap) => setInvite(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }),
      // Qayda/şəbəkə xətası bannerin ilişib qalmasına səbəb olmamalıdır.
      () => setInvite(null),
    );
  }, [user?.uid, user?.teacherId]);

  if (!invite || done) return null;

  const respond = async (accept) => {
    setBusy(true);
    setError('');
    const res = await respondTeacherInvite(invite.id, accept);
    if (!res.ok) {
      setError(res.errorText);
      setBusy(false);
      return;
    }
    setDone(accept ? 'accepted' : 'declined');
    setBusy(false);
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #7c6ff722, #5b4de822)',
      border: '1px solid #7c6ff755', borderRadius: '16px',
      padding: '16px', marginBottom: '16px',
    }}>
      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
        🎓 {invite.teacherName || 'Your teacher'} wants to add you as a student
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '12px' }}>
        If you accept, your teacher will be able to see your speaking progress and call analyses.
      </div>

      {error && <div className="error-box" style={{ marginBottom: '10px' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => respond(true)}
          style={{
            flex: 1, padding: '11px', borderRadius: '12px', border: 'none',
            background: busy ? 'var(--bg-card)' : 'linear-gradient(135deg, var(--accent), var(--accent-strong))',
            color: busy ? 'var(--text-muted)' : '#fff',
            fontSize: '14px', fontWeight: 800, cursor: busy ? 'default' : 'pointer',
          }}
        >
          {busy ? 'Sending...' : 'Accept'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => respond(false)}
          style={{
            padding: '11px 16px', borderRadius: '12px',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 700,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          Decline
        </button>
      </div>
    </div>
  );
}
