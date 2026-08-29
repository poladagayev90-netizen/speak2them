import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Clock, ChevronLeft, BellRing, Check, User } from 'lucide-react';
import { nudgeStudent, NUDGE_RESULT_TEXT } from '../utils/teacher';
import { AnalysisDetail } from './History';

// Müəllimin şagird səhifəsi — funnel-in ƏSAS dəyəri: şagirdin hər zənginin
// AI analizinə müəllim birə-bir baxa bilir (rules: callAnalysis oxunuşu
// users/{student}.teacherId == müəllim şərti ilə açılıb; şagird razılığı
// claimTeacherCode-da alınıb). Üstəlik ümumi dəqiqə/sessiya statistikası.
// Layout hər iki mühit üçün: maxWidth mərkəzləmə (PC) + dar ekranda sütun.
export default function TeacherStudent({ user }) {
  const navigate = useNavigate();
  const { studentId } = useParams();
  const [student, setStudent] = useState(null);
  const [analyses, setAnalyses] = useState(null); // null=yüklənir, []=boş
  const [selected, setSelected] = useState(null);
  const [denied, setDenied] = useState(false);
  // 'sending' | a NUDGE_RESULT_TEXT key | free-text error.
  const [nudge, setNudge] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', studentId));
        if (alive && snap.exists()) setStudent(snap.data());
      } catch { /* users hər signed-in üçün oxunandır; xəta = şəbəkə */ }
      try {
        const qs = await getDocs(query(
          collection(db, 'callAnalysis'),
          where('userId', '==', studentId),
          orderBy('timestamp', 'desc'),
          limit(30)
        ));
        if (alive) {
          setAnalyses(qs.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((d) => d.status !== 'queued' && d.status !== 'processing'));
        }
      } catch (e) {
        // permission-denied = bu şagird bu müəllimə bağlı deyil (rules kəsdi).
        if (alive) { setAnalyses([]); if (e.code === 'permission-denied') setDenied(true); }
      }
    })();
    return () => { alive = false; };
  }, [studentId]);

  if (selected) {
    return <AnalysisDetail analysis={selected} onClose={() => setSelected(null)} />;
  }

  const scoreTone = (s) => (s >= 80 ? 'success' : s >= 60 ? 'warning' : 'danger');
  const fmtDate = (sec) => (sec ? new Date(sec * 1000).toLocaleDateString() : '');
  // Practice with AInur was missing from both numbers, so a student who had
  // done nothing but practice showed "0 speaking minutes, 0 sessions" directly
  // above a list of their graded sessions. The call figures stay exactly as
  // they are — they are authoritative and come from call timestamps — and the
  // AInur seconds are added from the analyses this page has already loaded,
  // which the server measured from the turns themselves.
  const aiAnalyses = (analyses || []).filter((a) => a.source === 'ainur');
  const aiSeconds = aiAnalyses.reduce((n, a) => n + (Number(a.durationSeconds) || 0), 0);
  const totalMinutes = (Number(student?.totalMinutes) || 0) + Math.round(aiSeconds / 60);
  const sessions = (Number(student?.completedSessions) || 0) + aiAnalyses.length;
  const streak = Number(student?.streak) || 0;
  // Ortalama bal — yalnız balı olan analizlərdən.
  const scored = (analyses || []).filter((a) => Number.isFinite(a.overallScore));
  const avgScore = scored.length
    ? Math.round(scored.reduce((s, a) => s + a.overallScore, 0) / scored.length)
    : null;

  const panel = {
    background: 'var(--bg-secondary)', borderRadius: '16px', padding: '16px',
  };

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="home-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => navigate('/teacher')}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', display: 'flex', cursor: 'pointer', padding: 0 }}
            aria-label="Back"
          >
            <ChevronLeft size={22} />
          </button>
          <User size={20} strokeWidth={1.75} aria-hidden="true" /> {student?.name || 'Student'}
        </div>
      </div>

      {/* PC-də mərkəzlənmiş dar sütun, telefonda tam en. */}
      <div className="home-body" style={{ paddingBottom: '90px', maxWidth: '760px', margin: '0 auto', width: '100%' }}>

        {/* Stat kartları */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px', marginBottom: '18px',
        }}>
          {[
            { label: 'Speaking minutes', value: totalMinutes, icon: '' },
            { label: 'Sessions', value: sessions, icon: '' },
            { label: 'Streak', value: streak > 0 ? `🔥${streak}` : '—', icon: '' },
            { label: 'Average score', value: avgScore ?? '—', icon: '' },
          ].map((tile) => (
            <div key={tile.label} style={{ ...panel, textAlign: 'center', padding: '14px 8px' }}>
              <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>
                {tile.icon && `${tile.icon} `}{tile.value}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '4px' }}>{tile.label}</div>
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
            ...panel, marginBottom: '18px', width: '100%',
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

        {student?.level && (
          <div style={{ ...panel, marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{'English level'}</span>
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>{student.level}</span>
          </div>
        )}

        <div style={{ fontSize: '15px', fontWeight: 800, margin: '4px 2px 10px', color: 'var(--text-primary)' }}>
          {'AI analyses'}
        </div>

        {analyses === null ? (
          <div className="empty-state" style={{ padding: '30px 20px', textAlign: 'center' }}>
            <div className="empty-icon"></div>
            <p style={{ color: 'var(--text-secondary)' }}>{'Loading...'}</p>
          </div>
        ) : denied ? (
          <div className="empty-state" style={{ padding: '30px 20px', textAlign: 'center' }}>
            <div className="empty-icon"></div>
            <p style={{ color: 'var(--text-secondary)' }}>
              {'This student is not linked to you, so their analyses are not available.'}
            </p>
          </div>
        ) : analyses.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px 20px', textAlign: 'center' }}>
            <div className="empty-icon"></div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>{'No analyses yet.'}</p>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
              {'An analysis appears here a few minutes after your student finishes their first call.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {analyses.map((a) => (
              <div
                key={a.id}
                onClick={() => setSelected(a)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') setSelected(a); }}
                style={{
                  ...panel, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>
                    {a.peerName ? `Call with ${a.peerName}` : 'Call'}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} />
                    {a.durationSeconds ? `${Math.floor(a.durationSeconds / 60)}m ${a.durationSeconds % 60}s` : '—'}
                    {a.timestamp?.seconds ? ` • ${fmtDate(a.timestamp.seconds)}` : ''}
                  </div>
                </div>
                {Number.isFinite(a.overallScore) ? (
                  <div style={{
                    background: `var(--${scoreTone(a.overallScore)}-bg)`,
                    color: `var(--${scoreTone(a.overallScore)}-fg)`,
                    padding: '8px 12px', borderRadius: '12px',
                    fontWeight: 800, fontSize: '17px', flexShrink: 0,
                  }}>
                    {a.overallScore}
                  </div>
                ) : a.error ? (
                  <div style={{ color: 'var(--danger)', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>Error</div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
