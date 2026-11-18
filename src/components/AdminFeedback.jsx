import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { MessageSquare, Check, RotateCcw } from 'lucide-react';
import { db } from '../firebase';
import { Button } from './ui';
import { feedbackTypeLabel } from '../utils/feedback';
import './AdminApplicants.css';

const when = (ts) => {
  const d = ts?.toDate?.();
  if (!d) return '';
  return d.toLocaleString('en-GB', { timeZone: 'Asia/Baku', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// Admin → Feedback: what learners sent from Profile → Help & feedback
// (pages/Feedback.jsx), newest first. Admin-only by the rules. A message can
// be marked done (status) — nothing else about it changes.
export default function AdminFeedback({ users }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [openShot, setOpenShot] = useState(null);

  useEffect(() => onSnapshot(
    query(collection(db, 'feedback'), orderBy('createdAt', 'desc'), limit(60)),
    (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => { setError(e.message); setItems([]); },
  ), []);

  const nameOf = useMemo(() => {
    const m = new Map();
    (users || []).forEach((u) => m.set(u.uid || u.id, u.name || u.email || ''));
    return (uid) => m.get(uid) || 'Unknown learner';
  }, [users]);

  const setStatus = async (id, status) => {
    try { await updateDoc(doc(db, 'feedback', id), { status }); } catch (e) { setError(e.message); }
  };

  if (items === null) return <p className="aa-meta">Loading…</p>;
  const open = items.filter((f) => f.status !== 'done');
  const shown = showDone ? items : open;

  return (
    <section className="aa-panel">
      <h3 className="aa-h"><MessageSquare size={16} /> Feedback</h3>
      <p className="aa-meta">{open.length} open · {items.length - open.length} done. From Profile → Help &amp; feedback.</p>
      <div className="aa-filters">
        <button type="button" className={`aa-chip ${!showDone ? 'is-on' : ''}`} onClick={() => setShowDone(false)}>Open</button>
        <button type="button" className={`aa-chip ${showDone ? 'is-on' : ''}`} onClick={() => setShowDone(true)}>All</button>
      </div>
      {error && <p className="aa-error">{error}</p>}
      {shown.length === 0 && <p className="aa-meta">Nothing here yet.</p>}
      <ul className="adm-list">
        {shown.map((f) => (
          <li key={f.id} className="adm-user" style={{ alignItems: 'flex-start', opacity: f.status === 'done' ? 0.6 : 1 }}>
            <div className="adm-user-main">
              <p className="adm-user-name">
                <span className="aa-badge">{feedbackTypeLabel(f.type)}</span>
                {nameOf(f.uid)}
              </p>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{f.text}</p>
              <p className="adm-user-meta">
                <span>{when(f.createdAt)}</span>
                <span>{f.platform} · v{f.appVersion}</span>
                {f.route && <span>{f.route}</span>}
              </p>
              {typeof f.screenshot === 'string' && f.screenshot.startsWith('data:image/') && (
                openShot === f.id
                  ? <img src={f.screenshot} alt="Screenshot from the learner" onClick={() => setOpenShot(null)} style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', cursor: 'zoom-out' }} />
                  : <button type="button" className="aa-chip" style={{ justifySelf: 'start' }} onClick={() => setOpenShot(f.id)}>Show screenshot</button>
              )}
            </div>
            <div className="adm-user-actions">
              {f.status === 'done'
                ? <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={() => setStatus(f.id, 'new')}>Reopen</Button>
                : <Button size="sm" variant="secondary" icon={<Check size={14} />} onClick={() => setStatus(f.id, 'done')}>Done</Button>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
