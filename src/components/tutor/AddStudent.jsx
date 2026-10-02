import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { ChevronRight, Search, UserPlus } from 'lucide-react';
import { db } from '../../firebase';
import { ADMIN_UID, FUNCTIONS_BASE } from '../../constants';
import { authedFetch } from '../../api';
// No ui primitives here: this sits on the dashboard after TeacherWeek, and
// importing ui.css after cohort.css breaks the CSS chunk order in the build.
import '../cohort/cohort.css';

// Admin only: add a learner to your own individual lessons without the
// teacher code. Picking someone opens their page; "Start lessons" there links
// them to the admin (teacherLesson "start"), so they then sit in the roster
// below like any student who used the code. Other teachers keep the code /
// invite, which is the learner's own consent.
export default function AddStudent() {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState(null);
  const [emails, setEmails] = useState({});
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!open || people) return undefined;
    let alive = true;
    getDocs(query(collection(db, 'users'), limit(2000)))
      .then((snap) => alive && setPeople(snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.id !== ADMIN_UID && u.role !== 'teacher')))
      .catch((e) => { console.error('[AddStudent]', e); if (alive) setPeople([]); });
    authedFetch(`${FUNCTIONS_BASE}/adminUserEmails`, { method: 'POST' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => { if (alive && body && body.emails) setEmails(body.emails); })
      .catch(() => {});
    return () => { alive = false; };
  }, [open, people]);

  if (!open) {
    return (
      <button type="button" className="as-open" onClick={() => setOpen(true)}>
        <UserPlus size={18} aria-hidden="true" /> Add a student
      </button>
    );
  }

  const q = search.trim().toLowerCase();
  const shown = q.length < 2 ? [] : (people || [])
    .filter((u) => `${u.name || ''} ${emails[u.id] || ''}`.toLowerCase().includes(q))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .slice(0, 20);

  return (
    <section className="tl" aria-label="Add a student">
      <div className="tl-head">
        <h2 className="tl-title">Add a student</h2>
        <button type="button" className="tl-more" onClick={() => setOpen(false)}>Close</button>
      </div>
      <p className="cc-hint">Find the learner, then press “Start lessons” on their page. No code needed.</p>
      <label className="as-search">
        <Search size={16} aria-hidden="true" />
        <input type="search" autoFocus placeholder="Name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      {people === null && <p className="cc-hint">Loading…</p>}
      {people && q.length >= 2 && shown.length === 0 && <p className="cc-hint">Nobody matches.</p>}
      <ol className="cc-list">
        {shown.map((u) => (
          <li key={u.id}>
            <button type="button" className="tw-row as-row" onClick={() => navigate(`/teacher/student/${u.id}`)}>
              <span className="tw-name">{u.name || 'No name'}</span>
              <span className="tw-topic">
                {[u.level, emails[u.id], u.teacherId === ADMIN_UID ? 'already your student' : u.teacherId ? 'has another teacher' : null].filter(Boolean).join(' · ')}
              </span>
              <ChevronRight size={18} aria-hidden="true" className="as-chev" />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
