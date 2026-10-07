import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { isAdminUser } from '../constants';
import { totalPracticeMinutes } from '../utils/practiceStats';
import { ChevronLeft, BellRing, Check, User } from 'lucide-react';
import { nudgeStudent, NUDGE_RESULT_TEXT, removeStudent } from '../utils/teacher';
import { getPresence, lastSeenLabel } from '../utils/presence';
import { fetchPresenceDays, hoursLabel } from '../utils/presenceLog';
import '../components/ui/ui.css';
import Progress from './Progress';
import StudentLessons from '../components/tutor/StudentLessons';

const TABS = [
  { id: 'progress', label: 'Progress' },
  { id: 'lessons', label: 'Lessons' },
  { id: 'activity', label: 'Activity' },
];

// Müəllimin şagird səhifəsi — funnel-in ƏSAS dəyəri: şagirdin hər zənginin
// AI analizinə müəllim birə-bir baxa bilir (rules: callAnalysis oxunuşu
// users/{student}.teacherId == müəllim şərti ilə açılıb; şagird razılığı
// claimTeacherCode-da alınıb).
//
// Three tabs (Polad 2026-10-07: a teacher opening a student saw lesson
// management first and, further down, the OLD report list): Progress — the
// learner's own Lab, read-only, the same screen they see; Lessons — package,
// timetable, held → homework; Activity — when they were last in the app and
// the hours they had it open over two weeks.
export default function TeacherStudent({ user }) {
  const navigate = useNavigate();
  const { studentId } = useParams();
  const [student, setStudent] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('progress');
  // 'sending' | a NUDGE_RESULT_TEXT key | free-text error.
  const [nudge, setNudge] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');

  useEffect(() => {
    setStudent(null); setLoadError('');
    return onSnapshot(doc(db, 'users', studentId), (snap) => {
      setStudent(snap.exists() ? snap.data() : null);
    }, () => setLoadError('Could not load this student. Please reload to try again.'));
  }, [studentId]);

  const admin = isAdminUser(user);
  const linked = student?.teacherId === user.uid;
  const canSee = linked || admin;
  const totalMinutes = totalPracticeMinutes(student || {});
  const sessions = (Number(student?.callCount) || 0) + (Number(student?.aiPracticeSessions) || 0);
  const streak = Number(student?.streak) || 0;
  const now = Date.now();
  const presence = getPresence(student, now);
  const seenMs = student?.lastSeen?.toMillis?.() || 0;

  const panel = {
    background: 'var(--bg-secondary)', borderRadius: '16px', padding: '16px',
  };

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="home-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <button
            onClick={() => navigate('/teacher')}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', display: 'flex', cursor: 'pointer', padding: 0 }}
            aria-label="Back"
          >
            <ChevronLeft size={22} />
          </button>
          <User size={20} strokeWidth={1.75} aria-hidden="true" />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student?.name || 'Student'}</span>
        </div>
        {student && (
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: presence !== 'offline' ? 'var(--accent)' : 'var(--text-secondary)', flexShrink: 0 }}>
            {presence === 'busy' ? 'In a call' : presence === 'online' ? 'Online now' : `Seen ${lastSeenLabel(seenMs, now)}`}
          </span>
        )}
      </div>

      {/* PC-də mərkəzlənmiş dar sütun, telefonda tam en. */}
      <div className="home-body" style={{ paddingBottom: '90px', maxWidth: '760px', margin: '0 auto', width: '100%' }}>
        {loadError && <p role="alert">{loadError}</p>}

        <div className="ui-seg" role="tablist" aria-label="Student" style={{ marginBottom: 'var(--s-4)' }}>
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
              className={`ui-seg-btn ${tab === t.id ? 'is-on' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'progress' && (
          <>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: '8px', marginBottom: '14px',
            }}>
              {[
                { label: 'Minutes', value: totalMinutes },
                { label: 'Sessions', value: sessions },
                { label: 'Streak', value: streak > 0 ? `${streak} days` : '—' },
                { label: 'Level', value: student?.level ? String(student.level).split(/[\s–-]/)[0] : '—' },
              ].map((tile) => (
                <div key={tile.label} style={{ ...panel, textAlign: 'center', padding: '10px 4px', minWidth: 0 }}>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>{tile.value}</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.2 }}>{tile.label}</div>
                </div>
              ))}
            </div>

            {/* Chasing a student was a WhatsApp job. One tap, one push, and the
                server refuses it if they have already practised today — so this
                cannot turn into nagging someone who did the work. */}
            <button
              type="button"
              onClick={async () => {
                if (nudge === 'sending') return;
                setNudge('sending');
                const res = await nudgeStudent(studentId);
                setNudge(res.ok ? (res.data?.reason || 'sent') : (res.errorText || 'Could not send'));
              }}
              disabled={!!nudge && nudge !== 'sending'}
              style={{
                ...panel, marginBottom: '18px', width: '100%', padding: '12px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                cursor: nudge ? 'default' : 'pointer', fontFamily: 'inherit',
                border: `1px solid ${nudge ? 'var(--border)' : 'var(--accent-ring)'}`,
                background: nudge ? 'var(--bg-card)' : 'var(--accent-soft)',
                color: nudge ? 'var(--text-secondary)' : 'var(--accent)',
                fontSize: '14px', fontWeight: 700,
              }}
            >
              {nudge === 'sending' ? 'Sending…'
                : nudge
                  ? <><Check size={16} strokeWidth={2.5} aria-hidden="true" /> {NUDGE_RESULT_TEXT[nudge] || nudge}</>
                  : <><BellRing size={16} strokeWidth={2} aria-hidden="true" /> Remind them to practise today</>}
            </button>

            {student === null ? <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
              : canSee ? <Progress user={user} learnerUid={studentId} />
                : (
                  <p style={{ color: 'var(--text-secondary)' }}>
                    This student is not linked to you, so their analyses are not available.
                  </p>
                )}
          </>
        )}

        {/* Individual lessons: package, timetable, held → homework. */}
        {tab === 'lessons' && (canSee
          ? <StudentLessons uid={studentId} name={student?.name || ''} viewerUid={user.uid} viewerIsAdmin={admin} canWriteStory={admin || user.teacherVerified === true} />
          : <p style={{ color: 'var(--text-secondary)' }}>This student is not linked to you.</p>)}

        {tab === 'activity' && <StudentActivity uid={studentId} canSee={canSee} presence={presence} seenMs={seenMs} />}

        {linked && (
          <section style={{ ...panel, marginTop: 24 }} aria-label="Class membership">
            {confirmRemove ? <>
              <p style={{ fontWeight: 700 }}>Remove {student.name || 'this student'} from your class?</p>
              <p style={{ margin: '8px 0 14px', fontSize: 13, color: 'var(--text-secondary)' }}>Their account, practice history and messages will stay. You will lose access to their analyses. They can join a teacher again with a new invitation.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" disabled={removing} onClick={async () => {
                  if (removing) return;
                  setRemoving(true); setRemoveError('');
                  const result = await removeStudent(studentId);
                  if (result.ok) navigate('/teacher', { replace: true });
                  else { setRemoveError(result.errorText); setRemoving(false); }
                }} style={{ padding: '10px 14px', borderRadius: 10, border: 0, background: 'var(--danger-solid)', color: 'var(--ink-on-danger)', cursor: 'pointer' }}>{removing ? 'Removing…' : 'Confirm removal'}</button>
                <button type="button" disabled={removing} onClick={() => { setConfirmRemove(false); setRemoveError(''); }} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer' }}>Cancel</button>
              </div>
              {removeError && <p role="alert" style={{ marginTop: 10, color: 'var(--danger)' }}>{removeError}</p>}
            </> : <button type="button" onClick={() => setConfirmRemove(true)} style={{ background: 'none', border: 0, color: 'var(--danger)', fontWeight: 700, cursor: 'pointer' }}>Remove from class</button>}
          </section>
        )}
      </div>
    </div>
  );
}

// When the student was in the app over the last two weeks (presenceDays,
// recorded from 7 Oct 2026). Hours are Baku time, like every time in the app.
function StudentActivity({ uid, canSee, presence, seenMs }) {
  const [days, setDays] = useState(null);
  useEffect(() => {
    if (!canSee) return undefined;
    let alive = true;
    setDays(null);
    fetchPresenceDays(uid, 14).then((d) => { if (alive) setDays(d); }).catch(() => { if (alive) setDays([]); });
    return () => { alive = false; };
  }, [uid, canSee]);
  if (!canSee) return <p style={{ color: 'var(--text-secondary)' }}>This student is not linked to you.</p>;
  const active = (days || []).filter((d) => d.hours.length > 0);
  const fmt = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  return (
    <section className="ts-activity" aria-label="Activity">
      <p className="ts-activity-now">
        {presence === 'busy' ? 'In a call right now' : presence === 'online' ? 'In the app right now'
          : `Last seen ${lastSeenLabel(seenMs)}`}
      </p>
      {days === null ? <p className="ts-activity-sub">Loading…</p> : (
        <>
          <p className="ts-activity-sub">In the app on {active.length} of the last 14 days · hours in Baku time</p>
          <ul className="ts-activity-list">
            {days.map((d) => (
              <li key={d.date} className={d.hours.length ? '' : 'is-off'}>
                <span>{fmt(d.date)}</span>
                <b>{d.hours.length ? hoursLabel(d.hours) : '—'}</b>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
