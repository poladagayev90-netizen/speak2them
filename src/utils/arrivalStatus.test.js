import { arrivalStatus, arrivalLabel, lateCounts } from './arrivalStatus';

const booking = {
  participants: ['emil', 'polad'],
  outcome: { polad: 'partner_no_show', emil: 'no_show' },
  arrival: { polad: { atMs: 1, lateMin: 0, source: 'server' }, emil: null },
};

test('Polad came on time, Emil did not come — and it is not Polad’s miss', () => {
  const p = arrivalStatus(booking, 'polad');
  expect(p.kind).toBe('on_time');
  expect(p.partnerMissed).toBe(true);
  expect(arrivalLabel(p)).toBe('On time');
  expect(arrivalLabel(arrivalStatus(booking, 'emil'))).toBe('Did not come');
});

test('late beyond the grace, approximate when the app reported it', () => {
  const b = { participants: ['a', 'b'], outcome: { a: 'attended', b: 'attended' },
    arrival: { a: { lateMin: 12, source: 'server' }, b: { lateMin: 7, source: 'client' } } };
  expect(arrivalLabel(arrivalStatus(b, 'a'))).toBe('12 min late');
  expect(arrivalLabel(arrivalStatus(b, 'b'))).toBe('~7 min late');
  expect(arrivalStatus({ arrival: { a: { lateMin: 2, source: 'server' } } }, 'a').kind).toBe('on_time');
  expect(lateCounts([b, booking]).get('a')).toBe(1);
  expect(lateCounts([b, booking]).has('polad')).toBe(false);
});

test('old bookings: came without a time, or no record at all', () => {
  expect(arrivalStatus({ outcome: { a: 'attended' } }, 'a').kind).toBe('came');
  expect(arrivalStatus({ outcome: {} }, 'a').kind).toBe('unknown');
  expect(arrivalStatus({ outcome: { a: 'no_show' } }, 'a').kind).toBe('no_show');
});
