import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Shuffle, X, Search, Users } from 'lucide-react';
import useLiveLobby from '../hooks/useLiveLobby';
import FlaskSearchOverlay from '../components/FlaskSearchOverlay';
import PracticeBoard from '../components/PracticeBoard';
import UpcomingCallCard from '../components/UpcomingCallCard';
import SlotChangeBanner from '../components/SlotChangeBanner';
import UserCard from '../components/UserCard';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import '../components/ui/ui.css';

const LEVELS = ['All', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// Everything about talking to a real person, on its own tab.
//
// This all used to sit on the home screen underneath a grid of grey "Passed"
// time slots, so the first thing a new account saw was "there is nothing here".
// Home now leads with something you can do alone; this page is where you come
// when you want a person, and it can be as dense as it needs to be.
export default function Live({ user }) {
  const {
    onlineUsers, allUsers, blockedIds, activeSearchers,
    levelFilter, setLevelFilter,
    searching, startSearch, cancelSearch,
    mine, slotChange, setSlotChange,
    slotToast, cancelBusy, cancelUpcoming, joinCallNow,
    boardOpenSignal, openBoard,
  } = useLiveLobby(user);

  const [tab, setTab] = useState('online');

  // Arriving from "Pick a time" — open the calendar and scroll to it, rather
  // than dropping the learner at the top of a page where the thing they asked
  // for is two screens down and collapsed.
  const location = useLocation();
  const boardRef = useRef(null);
  useEffect(() => {
    if (!location.state?.openBoard) return;
    openBoard();
    const id = setTimeout(() => {
      boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => clearTimeout(id);
    // openBoard is recreated every render (it is an inline arrow in the hook),
    // so it is deliberately not a dependency -- it would re-fire the scroll on
    // every heartbeat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, location.state?.openBoard]);

  const browsable = allUsers.filter((u) => u.uid !== user.uid && u.id !== user.uid);
  const baseList = (tab === 'online' ? onlineUsers : browsable)
    .filter((u) => !blockedIds.has(u.uid || u.id));
  const displayUsers = levelFilter === 'All' ? baseList : baseList.filter((u) => u.level === levelFilter);

  return (
    <div style={{ padding: 'var(--s-4)', paddingBottom: '120px' }}>
      <h1 style={{
        margin: '0 0 var(--s-4)', fontSize: 'var(--fs-h1)', fontWeight: 700,
        color: 'var(--text-primary)', lineHeight: 'var(--lh-tight)',
      }}>
        Talk to someone
      </h1>

      <SlotChangeBanner request={slotChange} onDone={() => setSlotChange(null)} />

      {/* A confirmed appointment is the single most important thing on this
          page, so it sits above the search button. */}
      <UpcomingCallCard
        call={mine?.upcomingCall}
        busy={cancelBusy}
        onJoin={joinCallNow}
        onCancel={cancelUpcoming}
      />

      {/* Names are deliberately NOT shown. Knowing who is waiting invites
          cherry-picking: a lower-level learner sees a higher one and backs out,
          and being passed over is worse. You join the POOL, not a person. */}
      {activeSearchers.length > 0 && !searching && (
        <Card tone="peer" padding="md" style={{ marginBottom: 'var(--s-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
            <Search size={22} strokeWidth={1.75} style={{ color: 'var(--peer)', flexShrink: 0 }} />
            <p style={{
              flex: 1, margin: 0, fontSize: 'var(--fs-sm)',
              color: 'var(--text-primary)', lineHeight: 'var(--lh-body)',
            }}>
              👋 <b>{activeSearchers.length}</b>
              {activeSearchers.length === 1 ? ' person is' : ' people are'} looking for a partner
              right now — join and you will connect immediately.
            </p>
            <Button variant="primary" size="sm" onClick={startSearch}>Join now</Button>
          </div>
        </Card>
      )}

      <button
        id="tour-find-partner"
        onClick={searching ? cancelSearch : startSearch}
        className={searching ? 'btn-random searching' : 'btn-random'}
        style={{
          background: searching ? 'var(--danger-solid)' : undefined,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        }}
      >
        {searching
          ? <><X size={20} /> Searching… (cancel)</>
          : <><Shuffle size={20} /> Find a random partner</>}
      </button>

      <FlaskSearchOverlay
        visible={searching}
        title="Finding a partner…"
        subtitle="Looking for a match — the call starts automatically once we find one"
        onCancel={cancelSearch}
        cancelLabel="Stop searching"
      />

      {slotToast && (
        <Card padding="md" style={{ marginTop: 'var(--s-3)', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
            {slotToast}
          </p>
        </Card>
      )}

      <div ref={boardRef} style={{ marginTop: 'var(--s-4)', scrollMarginTop: 'var(--s-4)' }}>
        <PracticeBoard mine={mine} openSignal={boardOpenSignal} />
      </div>

      <p className="ui-section-label" style={{ marginTop: 'var(--s-6)' }}>
        <Users size={12} strokeWidth={2} style={{ verticalAlign: '-1px', marginRight: 4 }} />
        People
      </p>

      <div style={{ display: 'flex', gap: 'var(--s-2)', marginBottom: 'var(--s-3)' }}>
        <Button
          variant={tab === 'online' ? 'primary' : 'secondary'} size="sm"
          onClick={() => setTab('online')}
        >
          Online ({onlineUsers.length})
        </Button>
        <Button
          variant={tab === 'all' ? 'primary' : 'secondary'} size="sm"
          onClick={() => setTab('all')}
        >
          All ({browsable.length})
        </Button>
      </div>

      {/* Horizontal scroll rather than a wrap: seven levels wrapping to two
          rows pushed the list itself below the fold on a small phone. */}
      <div
        id="tour-filters"
        className="filter-chip-wrapper"
        style={{
          display: 'flex', overflowX: 'auto', gap: 'var(--s-2)',
          paddingBottom: '4px', marginBottom: 'var(--s-3)',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
        }}
      >
        {LEVELS.map((l) => (
          <Button
            key={l}
            variant={levelFilter === l ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setLevelFilter(l)}
            style={{ flexShrink: 0 }}
          >
            {l}
          </Button>
        ))}
      </div>

      {displayUsers.length === 0 ? (
        <Card padding="lg" style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 'var(--lh-body)' }}>
            {tab === 'online'
              ? 'Nobody is online right now. Tap Find a random partner and we will notify you the moment someone joins.'
              : 'No one here yet.'}
          </p>
        </Card>
      ) : (
        displayUsers.map((u) => <UserCard key={u.id || u.uid} user={u} />)
      )}

      <style>{'.filter-chip-wrapper::-webkit-scrollbar { display: none; }'}</style>
    </div>
  );
}
