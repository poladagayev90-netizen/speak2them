import { buildAnonMatchingSnapshot } from './snapshotExport';

test('buildAnonMatchingSnapshot uses aliases and numbers only — zero names, cities, phones, emails or uids', () => {
  const people = [
    {
      id: 'uid_secret_1',
      name: 'Samet Eroglu',
      email: 'samet@example.com',
      whatsapp: '+905321112233',
      level: 'B1 – Intermediate',
      ageBand: '25-34',
      timeZone: 'Europe/Istanbul',
      country: 'Türkiye',
      inWeek: true,
      wants: 2,
      calls: 0,
      seen: Date.parse('2026-11-22T10:00:00Z'),
      ob: { weeklyTarget: 2, timeZone: 'Europe/Istanbul', availability: [{ day: 2, startMin: 18 * 60, endMin: 21 * 60 }] },
    },
    {
      id: 'uid_secret_2',
      name: 'Sabina Mammadova',
      email: 'sabina@example.com',
      whatsapp: '+994501112233',
      level: 'B1 – Intermediate',
      ageBand: '18-24',
      timeZone: 'Asia/Baku',
      city: 'Ganja',
      country: 'Azerbaijan',
      inWeek: false,
      wants: 3,
      calls: 5,
      seen: Date.parse('2026-11-20T10:00:00Z'),
      ob: { weeklyTarget: 3, timeZone: 'Asia/Baku', availability: [{ day: 2, startMin: 19 * 60, endMin: 22 * 60 }] },
    },
  ];
  const pairs = [
    { a: 'uid_secret_1', b: 'uid_secret_2', slotId: '2026-11-24-20', kind: 'booked', levelA: 'B1', levelB: 'B1' },
  ];

  const md = buildAnonMatchingSnapshot({
    week: '2026-11-23',
    people,
    pairs,
    nowMs: Date.parse('2026-11-22T12:00:00Z'),
  });

  expect(md).toContain('| L1 | B1 | 25–34 | -1h | in | 1/2 | 0 | 0 |');
  expect(md).toContain('| L2 | B1 | 18–24 | 0h | out | 1/3 | 5 | 2 |');
  expect(md).toContain('| 2026-11-24-20 | L1 + L2 | booked | 0 |');

  // Strict PII check: none of the sensitive fields may leak.
  for (const forbidden of ['Samet', 'Sabina', 'uid_secret', 'example.com', '532111', '50111', 'Istanbul', 'Asia/Baku', 'Ganja', 'Türkiye', 'Azerbaijan']) {
    expect(md).not.toContain(forbidden);
  }
});
