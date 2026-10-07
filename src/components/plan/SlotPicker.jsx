import React, { useMemo, useState } from 'react';
import { upcomingBlocks, dayChip, hourLabel } from '../../utils/practiceSlots';
import './plan.css';

// Pick a new practice time in two steps: the day, then the hour.
//
// Since 2026-10-07 any whole hour 07:00–23:00 can be a start (a student wanted
// 11:00 and only 10:00 / 12:00 existed). That is up to 17 starts a day — as one
// list of buttons the old picker would have grown to eighty-odd, so the day
// comes first and only its hours show. Hours are in the device's own clock,
// like every time a learner reads; the slot id stays Baku time.
export default function SlotPicker({ nowMs = Date.now(), excludeSlotId = null, days = 9, busySlotId = '', disabled = false, onPick }) {
  const blocks = useMemo(() => upcomingBlocks(nowMs, excludeSlotId, days), [nowMs, excludeSlotId, days]);
  const dates = useMemo(() => [...new Set(blocks.map((b) => b.date))], [blocks]);
  // Start on the day of the practice being moved, when it is still ahead.
  const [date, setDate] = useState(() => {
    const own = excludeSlotId && excludeSlotId.slice(0, 10);
    return dates.includes(own) ? own : dates[0];
  });
  const hours = blocks.filter((b) => b.date === date);
  return (
    <div className="pl-pick">
      <div className="pl-pick-days" role="tablist" aria-label="Day">
        {dates.map((d) => {
          const chip = dayChip(d, nowMs);
          return (
            <button key={d} type="button" role="tab" aria-selected={d === date}
              className={`pl-pick-day ${d === date ? 'is-on' : ''}`} onClick={() => setDate(d)}>
              <span>{chip.weekday}</span><b>{chip.day}</b>
            </button>
          );
        })}
      </div>
      <div className="pl-pick-hours" aria-label="Time">
        {hours.map((b) => (
          <button key={b.slotId} type="button" className="pl-pick-hour" disabled={disabled} onClick={() => onPick(b.slotId)}>
            {busySlotId === b.slotId ? '…' : hourLabel(b.date, b.hour)}
          </button>
        ))}
      </div>
    </div>
  );
}
