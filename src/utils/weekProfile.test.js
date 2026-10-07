import { paintCell, profileCells, cellKind, needsWeekProfile, ownTimeOfSlot, markNever, dayHourLabel } from './weekProfile';
import { pendingMiss, reasonsFor, missReasonDoc } from './missReasons';

const ob = {
  availability: [{ day: 2, startMin: 19 * 60, endMin: 21 * 60 }],
  maybeAvailability: [{ day: 6, startMin: 11 * 60, endMin: 12 * 60 }],
};

describe('week profile grid', () => {
  it('one state per cell; painting the same kind clears it', () => {
    let c = profileCells(ob);
    expect(cellKind(c, '2-19')).toBe('free');
    c = paintCell(c, '2-19', 'never');
    expect(cellKind(c, '2-19')).toBe('never');
    expect(c.free.has('2-19')).toBe(false);
    c = paintCell(c, '2-19', 'never');
    expect(cellKind(c, '2-19')).toBe(null);
    c = paintCell(c, '6-11', 'free');
    expect(cellKind(c, '6-11')).toBe('free');
    expect(c.maybe.size).toBe(0);
  });

  it('asks active learners who never saw it, not newcomers, teachers or the admin', () => {
    expect(needsWeekProfile({ uid: 'u', callCount: 3 }, ob)).toBe(true);
    expect(needsWeekProfile({ uid: 'u', callCount: 0 }, ob)).toBe(false);
    expect(needsWeekProfile({ uid: 'u', callCount: 3 }, { ...ob, weekProfileAt: { seconds: 1 } })).toBe(false);
    expect(needsWeekProfile({ uid: 'u', role: 'teacher', callCount: 3 }, ob)).toBe(false);
    expect(needsWeekProfile({ uid: 'u', callCount: 3 }, null)).toBe(false);
  });

  it('a Baku slot in the learner\'s own week', () => {
    expect(ownTimeOfSlot('2026-10-06-20', 'Asia/Baku')).toEqual({ day: 2, hour: 20 });
    expect(ownTimeOfSlot('2026-10-06-20', 'Europe/Istanbul')).toEqual({ day: 2, hour: 19 });
    expect(ownTimeOfSlot('2026-10-06-00', 'Europe/Istanbul')).toEqual({ day: 1, hour: 23 });
    expect(ownTimeOfSlot('nope')).toBeNull();
    expect(dayHourLabel({ day: 2, hour: 9 })).toBe('Tue 09:00');
  });

  it('marking an hour Never takes it out of free and maybe', () => {
    const r = markNever(ob, { day: 2, hour: 20 });
    expect(r.availability).toEqual([{ day: 2, startMin: 19 * 60, endMin: 20 * 60 }]);
    expect(r.busyAvailability).toEqual([{ day: 2, startMin: 20 * 60, endMin: 21 * 60 }]);
    expect(r.maybeAvailability).toEqual(ob.maybeAvailability);
    // Marking it twice keeps it Never (a second tap is not a toggle here).
    expect(markNever({ ...ob, busyAvailability: r.busyAvailability }, { day: 2, hour: 20 }).busyAvailability).toEqual(r.busyAvailability);
    // The last free hour stays free: the rules need one, the planner refuses Never anyway.
    const one = { availability: [{ day: 3, startMin: 20 * 60, endMin: 21 * 60 }] };
    const r2 = markNever(one, { day: 3, hour: 20 });
    expect(r2.availability).toEqual(one.availability);
    expect(r2.busyAvailability).toEqual(one.availability);
  });
});

describe('miss reasons', () => {
  const now = Date.parse('2026-10-07T12:00:00Z');
  const ev = (id, outcome, hoursAgo) => ({ id, outcome, slotId: '2026-10-06-20', atMs: now - hoursAgo * 3600000 });

  it('asks about the newest own miss of the last two weeks, once', () => {
    const events = [ev('a', 'no_show', 30), ev('b', 'late_cancel', 5), ev('c', 'partner_no_show', 1), ev('d', 'no_show', 24 * 20)];
    expect(pendingMiss({ events, now }).id).toBe('b');
    expect(pendingMiss({ events, answered: new Set(['b']), now }).id).toBe('a');
    expect(pendingMiss({ events, answered: new Set(['b']), dismissed: new Set(['a']), now })).toBeNull();
  });

  it('an in-time cancel of a practice days ahead is asked at once', () => {
    expect(pendingMiss({ events: [ev('x', 'cancelled', -72)], now }).id).toBe('x');
  });

  it('«I forgot» only for a missed practice; the doc carries a trimmed note', () => {
    expect(reasonsFor('no_show').map((r) => r.value)).toContain('forgot');
    expect(reasonsFor('late_cancel').map((r) => r.value)).not.toContain('forgot');
    expect(missReasonDoc({ uid: 'u', eventId: 'e', kind: 'no_show', reason: 'other', note: '  ', slotId: 's' })).toEqual({ uid: 'u', eventId: 'e', kind: 'no_show', reason: 'other', slotId: 's' });
    expect(missReasonDoc({ uid: 'u', eventId: 'e', kind: 'no_show', reason: 'other', note: 'x'.repeat(300), slotId: 's' }).note).toHaveLength(200);
  });
});
