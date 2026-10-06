import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { Sheet } from './ui';
import { weeklyContent } from '../data/weeklyContent';
import { plainTopic } from '../utils/topicLabel';
import { upcomingTopics } from '../utils/topicQueue';
import { subscribeToSessionConfig } from '../utils/sessionSchedule';
import './CallTopicPicker.css';

// The call's topic, chosen together (Polad 2026-10-06: partners should be able
// to change the daily topic mid-call and see the next ones). The list is the
// topic the call is on, today's, then the coming days' in order (with the day
// each one arrives, so a pair can practise tomorrow's ahead), then the rest.
// Picking one writes `callTopic` to the call doc, so BOTH screens move — the
// vocabulary panel and every activity started afterwards read it.
export default function CallTopicPicker({ open, onClose, currentIndex, todayIndex, onPick }) {
  const [config, setConfig] = useState(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => (open ? subscribeToSessionConfig(setConfig) : undefined), [open]);
  useEffect(() => { if (!open) setShowAll(false); }, [open]);

  const next = useMemo(
    () => upcomingTopics({ currentIndex: todayIndex, total: weeklyContent.length, count: 6, config }),
    [todayIndex, config],
  );
  const listed = new Set([todayIndex, ...next.map((t) => t.index)]);
  const rest = weeklyContent.map((_, i) => i).filter((i) => !listed.has(i));

  const row = (index, label) => {
    const t = weeklyContent[index];
    const on = index === currentIndex;
    return (
      <button
        key={index}
        type="button"
        className={`ctp-row${on ? ' is-on' : ''}`}
        aria-current={on ? 'true' : undefined}
        onClick={() => { if (!on) onPick(index); onClose(); }}
      >
        <span className="ctp-main">
          <span className="ctp-title">{plainTopic(t?.topic)}</span>
          {label && <span className="ctp-when">{label}</span>}
        </span>
        {on ? <Check size={18} className="ctp-end" aria-label="Current topic" /> : <ChevronRight size={18} className="ctp-end" aria-hidden="true" />}
      </button>
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title="Topic for this call">
      <p className="ctp-note">You both switch to the topic you pick.</p>
      <div className="ctp-list">
        {row(todayIndex, 'Today')}
        {next.length > 0 && <p className="ctp-head">Coming up</p>}
        {next.map((t) => row(t.index, t.label))}
        {!showAll && rest.length > 0 && (
          <button type="button" className="ctp-more" onClick={() => setShowAll(true)}>
            All topics ({weeklyContent.length})
          </button>
        )}
        {showAll && rest.length > 0 && <p className="ctp-head">Other topics</p>}
        {showAll && rest.map((i) => row(i, null))}
      </div>
    </Sheet>
  );
}
