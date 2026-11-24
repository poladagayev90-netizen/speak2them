import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { markAcademyOpened } from './academyPopup';

// SpeakLab Academy watch progress — pure rules + localStorage + Firestore sync.
//
// Progress keys are language-neutral (`T02_ch1`) so switching AZ ↔ TR keeps
// watch progress and resume position intact. Monotonic 90% rule: once a
// chapter is marked `done`, it stays `done` across devices.
export const DONE_RATIO = 0.9;
export const ACADEMY_LANG_KEY = 'sl.academy.lang';

const LOCAL_PREFIX = 'sl.academy.progress.';

export function chapterKey(seriesId, chapterId) {
  return `${seriesId}_${chapterId}`;
}

export function resolveAcademyLang({
  urlLang = null,
  storedLang = null,
  guideLanguage = null,
  preferredLanguage = null,
  feedbackLanguage = null,
} = {}) {
  const pick = (v) => (v === 'az' || v === 'tr' ? v : null);
  return (
    pick(urlLang)
    || pick(storedLang)
    || pick(guideLanguage)
    || pick(preferredLanguage)
    || pick(feedbackLanguage)
    || 'az'
  );
}

export function readStoredAcademyLang() {
  try {
    const v = localStorage.getItem(ACADEMY_LANG_KEY);
    return v === 'az' || v === 'tr' ? v : null;
  } catch {
    return null;
  }
}

export function saveStoredAcademyLang(lang) {
  if (lang !== 'az' && lang !== 'tr') return;
  try { localStorage.setItem(ACADEMY_LANG_KEY, lang); } catch { /* private mode */ }
}

export function mergeChapterEntry(a, b) {
  if (!a) return b ? { ...b } : null;
  if (!b) return { ...a };
  const aAt = Number(a.at) || 0;
  const bAt = Number(b.at) || 0;
  const newer = bAt > aAt ? b : a;
  return {
    done: Boolean(a.done || b.done),
    pos: Number(newer.pos) || 0,
    at: Math.max(aAt, bAt),
  };
}

export function mergeProgressState(local = {}, remote = {}) {
  const lCh = (local && typeof local.chapters === 'object' && local.chapters) || {};
  const rCh = (remote && typeof remote.chapters === 'object' && remote.chapters) || {};
  const keys = new Set([...Object.keys(lCh), ...Object.keys(rCh)]);
  const chapters = {};
  for (const k of keys) {
    const merged = mergeChapterEntry(lCh[k], rCh[k]);
    if (merged) chapters[k] = merged;
  }
  const lOpened = Number(local?.openedAt) || 0;
  const rOpened = Number(remote?.openedAt) || 0;
  const openedAt = lOpened && rOpened ? Math.min(lOpened, rOpened) : (lOpened || rOpened || 0);
  const last = remote?.last || local?.last || '';
  return { openedAt, chapters, last };
}

export function resumeAt(chapters, seriesId, chapterId, dur) {
  const e = chapters?.[chapterKey(seriesId, chapterId)];
  if (!e || e.done) return 0;
  const pos = Number(e.pos) || 0;
  if (pos < 2 || (dur && pos > dur - 3)) return 0;
  return pos;
}

export function courseOf(series, lang) {
  return series?.langs?.[lang] || series?.langs?.az || series?.langs?.tr || null;
}

export function seriesProgress(series, lang, chapters) {
  const c = courseOf(series, lang);
  const list = c?.chapters || [];
  const total = list.length;
  const done = list.filter((ch) => Boolean(chapters?.[chapterKey(series.id, ch.id)]?.done)).length;
  return {
    done,
    total,
    percent: total ? Math.round((done / total) * 100) : 0,
  };
}

export function courseAction(series, lang, chapters) {
  const c = courseOf(series, lang);
  const list = c?.chapters || [];
  if (!list.length) return { kind: 'start', ch: '' };
  const p = seriesProgress(series, lang, chapters);
  if (p.done === p.total) return { kind: 'again', ch: list[0].id };
  const next = list.find((ch) => !chapters?.[chapterKey(series.id, ch.id)]?.done) || list[0];
  const anyStarted = p.done > 0 || list.some((ch) => Number(chapters?.[chapterKey(series.id, ch.id)]?.pos) > 0);
  return { kind: anyStarted ? 'cont' : 'start', ch: next.id };
}

export function nextSeriesAfter(catalogue, series, lang, chapters) {
  const list = catalogue?.series || [];
  const i = list.findIndex((s) => s.id === series?.id);
  if (i < 0 || list.length <= 1) return null;
  for (let offset = 1; offset < list.length; offset += 1) {
    const candidate = list[(i + offset) % list.length];
    const p = seriesProgress(candidate, lang, chapters);
    if (p.done < p.total) return candidate;
  }
  return null;
}

function storageKey(uid) {
  return `${LOCAL_PREFIX}${uid || 'guest'}`;
}

export function readLocalProgress(uid) {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(uid)) || 'null');
    if (raw && typeof raw === 'object') {
      return {
        openedAt: Number(raw.openedAt) || 0,
        chapters: raw.chapters && typeof raw.chapters === 'object' ? raw.chapters : {},
        last: typeof raw.last === 'string' ? raw.last : '',
      };
    }
  } catch { /* private mode */ }
  return { openedAt: 0, chapters: {}, last: '' };
}

export function writeLocalProgress(uid, state) {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify({
      openedAt: Number(state?.openedAt) || 0,
      chapters: state?.chapters || {},
      last: state?.last || '',
    }));
  } catch { /* quota / private mode */ }
}

export async function loadAcademyProgress(uid) {
  const local = readLocalProgress(uid);
  if (!uid) return local;
  try {
    const snap = await getDoc(doc(db, 'academyProgress', uid));
    if (!snap.exists()) return local;
    const remote = snap.data() || {};
    const merged = mergeProgressState(local, remote);
    writeLocalProgress(uid, merged);
    if (merged.openedAt || Object.keys(merged.chapters).length > 0) {
      markAcademyOpened(uid);
    }
    return merged;
  } catch (err) {
    console.warn('[academy] load progress failed', err?.code || err?.message);
    return local;
  }
}

export async function saveAcademyProgress(uid, state, { syncRemote = false } = {}) {
  writeLocalProgress(uid, state);
  if (uid) markAcademyOpened(uid);
  if (!uid || !syncRemote) return { ok: true };
  try {
    const payload = {
      uid,
      openedAt: Number(state.openedAt) || Date.now(),
      chapters: state.chapters || {},
      updatedAt: serverTimestamp(),
    };
    if (state.last) payload.last = String(state.last).slice(0, 64);
    await setDoc(doc(db, 'academyProgress', uid), payload, { merge: true });
    return { ok: true };
  } catch (err) {
    console.warn('[academy] save progress failed', err?.code || err?.message);
    return { ok: false };
  }
}

// One-shot cross-device check for eligible newcomers on Home.jsx so a user who
// already opened Academy on another device won't get the newcomer popup again.
export async function checkRemoteAcademyOpened(uid) {
  if (!uid) return false;
  try {
    const snap = await getDoc(doc(db, 'academyProgress', uid));
    if (!snap.exists()) return false;
    const data = snap.data() || {};
    const hasProgress = Boolean(data.openedAt) || (data.chapters && Object.keys(data.chapters).length > 0);
    if (hasProgress) markAcademyOpened(uid);
    return hasProgress;
  } catch {
    return false;
  }
}
