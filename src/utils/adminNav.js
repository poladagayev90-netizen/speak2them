// The admin's tabs and how the admin bottom nav maps onto them. Kept out of
// pages/Admin.js so BottomNav (in the main bundle) does not pull the whole
// admin chunk in.

// Tabs in the order the admin works through them. `plan` is the old id of
// Week (pushes still open /admin?tab=plan).
//
// Since 2026-10-07 the admin has their own bottom nav (BottomNav.jsx: Today ·
// Activity · Week · Students · Admin), so the tabs come in GROUPS: a nav
// button opens one group and only its tabs show in the row — seven tabs in
// one sideways-scrolling row was the overflow Polad sent a picture of.
// The group follows the tab, so an old link (?tab=intros) still lands right.
export const TABS = [
  { id: 'activity', label: 'Activity', group: 'activity' },
  { id: 'matching', label: 'Matching', group: 'week' },
  { id: 'week', label: 'Week', group: 'week' },
  { id: 'premium', label: 'Students', group: 'admin' },
  { id: 'applicants', label: 'Applicants', group: 'admin' },
  { id: 'slots', label: 'Sessions', group: 'admin' },
  { id: 'attendance', label: 'Attendance', group: 'admin' },
  { id: 'intros', label: 'Intros', group: 'admin' },
  // Cohorts (the old paid group course, AdminCohorts.jsx) is hidden since
  // 2026-10-03: individual lessons replaced it and the tab read as the place
  // to schedule them. The component and its data stay; re-add the row to bring it back.
];

export function adminTabOf(t) {
  if (t === 'plan') return 'week';
  return TABS.some((x) => x.id === t) ? t : 'premium';
}

// Which bottom-nav button is lit for a /admin?tab=… address.
export const adminGroupOf = (tab) => (TABS.find((t) => t.id === adminTabOf(tab)) || TABS[0]).group;
