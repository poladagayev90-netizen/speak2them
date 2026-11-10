import { rankClimb } from './ranking';

describe('rankClimb', () => {
  it('counts places climbed', () => {
    expect(rankClimb(7, 4)).toBe(3);
    expect(rankClimb(2, 1)).toBe(1);
  });
  it('never reports a drop, a stay or a first visit', () => {
    expect(rankClimb(3, 5)).toBe(0);
    expect(rankClimb(4, 4)).toBe(0);
    expect(rankClimb(null, 4)).toBe(0);
    expect(rankClimb(0, 4)).toBe(0);
    expect(rankClimb('x', 4)).toBe(0);
  });
});
