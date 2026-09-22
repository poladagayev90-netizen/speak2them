import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CalendarDays, Flame } from 'lucide-react';
import { parseSlotId, hourLabel } from '../utils/practiceSlots';
import { needsIntro } from '../utils/intro';
import Card from './ui/Card';
import Button from './ui/Button';
import './ui/ui.css';

// One quiet, contextual prompt in the page flow.
//
// This replaces LabBuddy, a cartoon flask fixed at z-index 1200 that walked
// around the corner of the home screen and opened a speech bubble ON TOP of the
// content underneath. The nudges themselves were good — book a time, your call
// is in twenty minutes, your streak is at risk — but a floating character that
// covers what you were reading is a usability cost, not charm.
//
// At most one shows at a time, and it is dismissible: a prompt you cannot
// silence stops being a prompt and becomes furniture.
//
// Each line opens with an emoji, as CONTENT rather than as an icon (icons are
// lucide, always). One screen of same-weight sentences is a wall; a single
// character at the head of the rotating line is what tells you at a glance
// which of the three this one is.
function pickNudge(user, mine) {
  const uc = mine?.upcomingCall;
  if (uc) {
    const parsed = parseSlotId(uc.slotId);
    const startMs = Number(uc.startMs) || parsed?.startMs || 0;
    const mins = Math.round((startMs - Date.now()) / 60000);
    // Only worth saying when it is close enough to act on.
    if (mins > 0 && mins <= 90) {
      return {
        id: 'call-soon',
        icon: Clock,
        text: `Your ${hourLabel(parsed?.date || '', parsed?.hour ?? 0)} call starts in ${mins} ${mins === 1 ? 'minute' : 'minutes'}.`,
      };
    }
    return null;
  }

  // Not while the intro is still to do: the slot board is locked until then
  // (Live shows the intro card in its place), so "pick a time" led to a door
  // that would not open.
  if (!mine?.slotIds?.length && !needsIntro(user)) {
    return {
      id: 'pick-time',
      icon: CalendarDays,
      text: 'Pick a time you are free and we will match you with someone.',
      // openBoard: "Pick a time" landing on a COLLAPSED board meant the button
      // did not do what it said. Live reads this and opens the calendar.
      action: { label: 'Pick a time', to: '/live', state: { openBoard: true } },
    };
  }

  const streak = Number(user?.streak) || 0;
  if (streak > 0 && user?.lastCallDate !== new Date().toDateString()) {
    return {
      id: 'streak',
      icon: Flame,
      text: `You are on a ${streak}-day streak. You have not spoken today.`,
      action: { label: 'Find a partner', to: '/live' },
    };
  }

  return null;
}

export default function TodayNudge({ user, mine }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState('');

  const nudge = pickNudge(user, mine);
  if (!nudge || dismissed === nudge.id) return null;
  const Icon = nudge.icon;

  return (
    <Card padding="md" style={{ marginBottom: 'var(--s-3)' }}>
      {/* The icon is a lucide glyph in the same soft tile the other Home cards
          use. It was an emoji at the start of the sentence (⏱ 🗓️ 🔥), which
          each platform draws in its own colours. */}
      <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'flex-start' }}>
        {Icon && (
          <span aria-hidden="true" style={{
            display: 'grid', placeItems: 'center', flexShrink: 0,
            width: 36, height: 36, borderRadius: 'var(--r-md)',
            background: 'var(--accent-soft)', color: 'var(--accent)',
          }}>
            <Icon size={18} strokeWidth={2} />
          </span>
        )}
        <p style={{
          margin: 0,
          fontSize: 'var(--fs-sm)',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          lineHeight: 'var(--lh-body)',
          alignSelf: 'center',
        }}>
          {nudge.text}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 'var(--s-2)', marginTop: 'var(--s-3)' }}>
        {nudge.action && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(nudge.action.to, { state: nudge.action.state })}
          >
            {nudge.action.label}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setDismissed(nudge.id)}>
          Dismiss
        </Button>
      </div>
    </Card>
  );
}
