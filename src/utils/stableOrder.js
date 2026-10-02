// A list that does not move under the admin's finger. Admin lists are live
// (onSnapshot): someone's lastSeen ticks, an applicant is marked seen, and a
// list sorted on those fields reshuffles while the admin is reading or
// ticking it — the row they were about to tap is suddenly somewhere else.
// Each item keeps the place it got when it first appeared; only items that
// are new to the list are sorted (by `compare`) and added at the end. A new
// `rank` map (a filter change) sorts everything afresh.
export function stableOrder(items, compare, rank) {
  const fresh = items.filter((i) => !rank.has(i.id)).sort(compare);
  let n = rank.size;
  for (const i of fresh) rank.set(i.id, n++);
  return [...items].sort((a, b) => rank.get(a.id) - rank.get(b.id));
}
