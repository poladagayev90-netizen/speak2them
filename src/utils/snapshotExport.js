// Anonymised matching snapshot for AI analysis (2026-11-22).
// INVARIANT (CLAUDE.md): AI sees ALIASES and NUMBERS ONLY — never real names,
// emails, WhatsApp numbers, cities or uids.

import { availabilitySummary, levelGap, plannedCount, ageBandShort } from './matching';
import { offsetVsBaku } from './timezone';

const shortLevel = (lv) => String(lv || '').slice(0, 2).toUpperCase() || '-';

// Builds a compact Markdown table of the week using aliases (L1, L2…) only.
export function buildAnonMatchingSnapshot({ week, people = [], pairs = [], nowMs = Date.now() }) {
  const aliasById = new Map();
  const ordered = [...people].sort((a, b) => (b.seen || 0) - (a.seen || 0) || String(a.id).localeCompare(String(b.id)));
  ordered.forEach((p, idx) => aliasById.set(p.id, `L${idx + 1}`));

  const lines = [
    `# SpeakLab Week Snapshot (${week}, anonymised)`,
    `Learners: ${ordered.length} | In week: ${ordered.filter((p) => p.inWeek).length} | Pairs: ${pairs.length}`,
    '',
    '| Alias | Level | Age | TZ vs Baku | In | Planned/Target | Calls | Last seen (d) | Free (Baku) |',
    '|---|---|---|---|---|---:|---:|---:|---|',
  ];

  for (const p of ordered) {
    const alias = aliasById.get(p.id);
    const planned = plannedCount(pairs, p.id);
    const diffH = p.timeZone && p.timeZone !== 'Asia/Baku' ? Math.round(offsetVsBaku(p.timeZone) / 60) : 0;
    const tzStr = diffH === 0 ? '0h' : (diffH > 0 ? `+${diffH}h` : `${diffH}h`);
    const seenDays = p.seen ? Math.max(0, Math.floor((nowMs - p.seen) / 86400000)) : '-';
    const avail = availabilitySummary(p.ob, week).text.replace(/\|/g, '/');
    lines.push(
      `| ${alias} | ${shortLevel(p.level)} | ${ageBandShort(p.ageBand) || '-'} | ${tzStr} | ${p.inWeek ? 'in' : 'out'} | ${planned}/${p.wants || 0} | ${Number(p.calls) || 0} | ${seenDays} | ${avail} |`,
    );
  }

  if (pairs.length) {
    lines.push('', '## Pairs', '| Slot (Baku) | Pair | Status | Level gap |', '|---|---|---|---:|');
    for (const pair of pairs) {
      const a = aliasById.get(pair.a) || 'HOST';
      const b = aliasById.get(pair.b) || 'HOST';
      const gap = levelGap(pair.levelA, pair.levelB);
      lines.push(`| ${pair.slotId} | ${a} + ${b} | ${pair.kind} | ${gap === null ? '-' : gap} |`);
    }
  }

  return lines.join('\n');
}
