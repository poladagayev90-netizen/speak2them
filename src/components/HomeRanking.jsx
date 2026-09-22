import React, { useMemo } from 'react';
import { Crown, Trophy, Mic, Users, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RankingCard from './RankingCard';
import TutorBadge from './TutorBadge';
import AvatarImage from './ui/AvatarImage';
import { Button, EmptyState } from './ui';
import { sortUsersForRanking, weeklyMinutesOf, getUserKey } from '../utils/ranking';
import { totalPracticeMinutes } from '../utils/practiceStats';
import './Ranking.css';

function PodiumCard({ user, rank, isCurrentUser, displayMinutes }) {
  // A gentler staircase than before (was 120/90/70 in a 240px well, which left
  // a large dead gap under the shortest column). The steps still read as first,
  // second and third; they just stop dominating the screen.
  const heights = { 1: 64, 2: 46, 3: 34 };
  const navigate = useNavigate();
  const initial = user.name?.charAt(0).toUpperCase();

  return (
    <div
      className={`ranking-podium-slot rank-${rank}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/user/${getUserKey(user)}`); } }}
      onClick={() => navigate(`/user/${getUserKey(user)}`)}
    >
      <div className="ranking-podium-avatar">
        {/* The initial sits UNDER the photo rather than being replaced by
            it — see AvatarImage for the failure this avoids. */}
        <span className="ranking-podium-initial" aria-hidden="true">{initial}</span>
        <AvatarImage src={user.photo} />
        {rank === 1 && (
          <Crown className="ranking-crown" size={18} strokeWidth={2.25} aria-hidden="true" />
        )}
      </div>
      <p className="ranking-podium-name">
        {user.name}{isCurrentUser && ' (you)'}{user.teacherVerified && <TutorBadge />}
      </p>
      <p className="ranking-podium-minutes"><strong>{displayMinutes}</strong> min</p>
      {/* The bar carries the placing, so the podium says which step is which. */}
      <div className="ranking-podium-bar" style={{ height: heights[rank] }}>
        <span className="ranking-podium-place">{rank}</span>
      </div>
    </div>
  );
}

// Only people who actually spoke are ranked.
//
// With a small community most of the roster has 0 minutes in any given week,
// and ranking them anyway turned the page into a wall of "0 min" rows under a
// "YOUR POSITION #67" card — it read as a place nobody uses. Now the board is
// the people who practised, the pulse line counts them, and a learner with no
// minutes yet gets the one thing that puts them on it instead of a big number.
export default function HomeRanking({ users, currentUserId, mode = 'all' }) {
  const navigate = useNavigate();
  const weekly = mode === 'weekly';
  const minutesOf = (u) => (weekly ? weeklyMinutesOf(u) : totalPracticeMinutes(u));

  const board = useMemo(
    () => sortUsersForRanking(users, mode).filter((u) => minutesOf(u) > 0),
    // minutesOf only depends on mode, which is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users, mode],
  );
  const myIndex = board.findIndex((u) => getUserKey(u) === currentUserId);
  const me = myIndex === -1 ? null : board[myIndex];
  const totalMinutes = Math.round(board.reduce((sum, u) => sum + minutesOf(u), 0));

  const goPractise = () => navigate('/practice');
  const goPartner = () => navigate('/live');

  if (board.length === 0) {
    return (
      <EmptyState
        icon={<Trophy size={26} strokeWidth={1.75} />}
        title={weekly ? 'A fresh week' : 'No minutes yet'}
        text={weekly
          ? 'Nobody has spoken yet this week. Your first call or AInur session puts you at the top.'
          : 'Your first call or AInur session puts you on the board.'}
      >
        <Button variant="ai" icon={<Mic size={16} strokeWidth={2} />} onClick={goPractise}>Practise with AInur</Button>
        <Button variant="secondary" icon={<Users size={16} strokeWidth={2} />} onClick={goPartner}>Find a partner</Button>
      </EmptyState>
    );
  }

  // The next person up, and how far away they are: a goal for this week that
  // is always within reach, which a rank number on its own never is.
  const above = myIndex > 0 ? board[myIndex - 1] : null;
  const gap = above ? Math.max(1, Math.ceil(minutesOf(above) - minutesOf(me))) : 0;

  const topThree = board.length >= 3 ? board.slice(0, 3) : [];
  const rest = board.length >= 3 ? board.slice(3) : board;

  return (
    <div className="ranking-board">
      <p className="ranking-pulse">
        <TrendingUp size={15} strokeWidth={2} aria-hidden="true" />
        <span>
          <strong>{board.length}</strong> {board.length === 1 ? 'learner' : 'learners'} {weekly ? 'practised this week' : 'on the board'}
          {' · '}<strong>{totalMinutes}</strong> min {weekly ? 'together' : 'in total'}
        </span>
      </p>

      {me ? (
        <div className="ranking-you-card">
          <div className="ranking-you-rank">
            <span className="ranking-you-label">Your spot</span>
            <span className="ranking-you-number">#{myIndex + 1}<small> of {board.length}</small></span>
          </div>
          <div className="ranking-you-detail">
            <strong>{minutesOf(me)} min</strong>
            <span>{above
              ? `${gap} min more to pass ${above.name || 'the next learner'}`
              : (weekly ? 'You are leading this week' : 'You are leading')}</span>
          </div>
        </div>
      ) : (
        <div className="ranking-you-card is-new">
          <p className="ranking-you-title">{weekly ? 'You are not on this week’s board yet' : 'You are not on the board yet'}</p>
          <p className="ranking-you-text">One call, or a few minutes with AInur, puts you on it.</p>
          <div className="ranking-you-actions">
            <Button variant="ai" size="sm" icon={<Mic size={15} strokeWidth={2} />} onClick={goPractise}>Practise with AInur</Button>
            <Button variant="secondary" size="sm" icon={<Users size={15} strokeWidth={2} />} onClick={goPartner}>Find a partner</Button>
          </div>
        </div>
      )}

      {topThree.length === 3 && (
        <section className="ranking-leaders" aria-label="Top three">
          <div className="ranking-podium">
            {[topThree[1], topThree[0], topThree[2]].map((u) => {
              const rank = board.indexOf(u) + 1;
              return (
                <PodiumCard
                  key={getUserKey(u)}
                  user={u}
                  rank={rank}
                  isCurrentUser={getUserKey(u) === currentUserId}
                  displayMinutes={minutesOf(u)}
                />
              );
            })}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <div className="ranking-list">
          {rest.map((u) => (
            <RankingCard
              key={getUserKey(u)}
              user={u}
              rank={board.indexOf(u) + 1}
              isCurrentUser={getUserKey(u) === currentUserId}
              displayMinutes={minutesOf(u)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
