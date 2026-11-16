import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Play, Search, X } from 'lucide-react';
import { describeVideos } from '../data/describeVideos';
import { weeklyContent } from '../data/weeklyContent';
import { canBrowseAllVideos, videosForTopic } from '../utils/fetchTopicVideos';
import { MAX_PICKS, pickedClips, saveClipPicks, subscribeToClipPicks } from '../utils/teacherClipPicks';
import ClipViewer from '../components/ClipViewer';
import { Button } from '../components/ui';
import './VideoLibrary.css';

// The whole describe-video deck, for teachers (canBrowseAllVideos, checked below).
//
// A learner meets six clips a topic, handed out by the rotation. A teacher in a
// lesson needs the OTHER question answered: "which clip fits the person in
// front of me right now" — a cooking clip for the one who cooks, a street
// scene for the one who froze on the last picture. So this is a picker first
// (every poster, searchable by what is in it) and a stage second.
//
// THE STAGE IS IN THE URL (?clip=<id>). The teacher shares this tab on a call:
// the browser's back button has to leave the clip and land on the grid, and a
// link to one clip can be pasted into a chat. Arrows REPLACE the entry, so
// back never walks through every clip that was shown.
//
// Posters only on the grid (lazy <img>, never <video>): at 360 clips the page
// would otherwise pull hundreds of megabytes before the teacher chose one.

const norm = (s) => String(s || '').toLowerCase();

// What a search looks through: what is visible in the clip (the words and the
// description), not the file name.
function matches(clip, q) {
  if (!q) return true;
  const hay = [clip.alt, ...(clip.keywords || []), clip.id.replace(/-/g, ' ')].map(norm).join(' ');
  return q.split(/\s+/).every((part) => hay.includes(part));
}

function Stage({ clips, index, onIndexChange, onClose }) {
  const closeRef = useRef(null);
  // Same stale-index guard as ClipViewer's arrows: the index comes back
  // through the URL a render later, and a quick double press must not be
  // counted once.
  const pendingRef = useRef(null);
  useEffect(() => { pendingRef.current = null; }, [index]);

  // Focus lands on the way out, so a keyboard user is never trapped under a
  // full-screen layer; Escape and the arrow keys work while the tab is shared
  // and the teacher's hands are on the laptop, not on the phone-sized arrows.
  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return;
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (e.key === 'Escape') onClose();
      else if (d) {
        const next = ((pendingRef.current ?? index) + d + clips.length) % clips.length;
        pendingRef.current = next;
        onIndexChange(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, clips.length, onIndexChange, onClose]);

  return (
    <div className="vl-stage" role="dialog" aria-modal="true" aria-label="Clip">
      <div className="vl-stage-bar">
        <Button
          ref={closeRef}
          variant="ghost"
          size="sm"
          icon={<ArrowLeft size={18} aria-hidden="true" />}
          onClick={onClose}
        >
          All clips
        </Button>
      </div>
      <div className="vl-stage-body">
        <ClipViewer clips={clips} index={index} onIndexChange={onIndexChange} />
      </div>
    </div>
  );
}

export default function VideoLibrary({ user }) {
  const allowed = canBrowseAllVideos(user);
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const openId = params.get('clip');

  // PICK MODE (?pick=<day>, from the topic sheet's «Choose clips»): the same
  // grid, but a tap adds the clip to that topic's list instead of opening it
  // (the small play button still previews). The list starts from the
  // teacher's earlier picks, or from the topic's own clips, so «add two of
  // mine» is two taps, not six. See utils/teacherClipPicks.js.
  const pickDay = Number(params.get('pick')) || null;
  const pickTopic = pickDay ? weeklyContent.find((c) => c.day === pickDay) : null;
  const [chosen, setChosen] = useState(null); // null until the saved picks load
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // The list as it was when the picker opened leads the grid, so the teacher
  // sees what is already chosen without hunting through 100 posters. Fixed at
  // load: re-sorting on every tap would move the tile under the finger.
  const [leading, setLeading] = useState([]);
  useEffect(() => {
    if (!pickTopic || !user?.uid) return undefined;
    let first = true;
    return subscribeToClipPicks(user.uid, (days) => {
      if (!first) return; // later snapshots are our own save echoing back
      first = false;
      const mine = pickedClips(days, pickDay);
      const ids = (mine.length ? mine : videosForTopic(pickDay)).map((c) => c.id);
      setChosen(ids);
      setLeading(ids);
    });
  }, [pickTopic, pickDay, user?.uid]);

  const toggle = (id) => setChosen((prev) => {
    const list = prev || [];
    if (list.includes(id)) return list.filter((x) => x !== id);
    return list.length >= MAX_PICKS ? list : [...list, id];
  });
  // Back to the sheet the picker was opened from; from a pasted link, to the
  // plain library (a back there could leave the app).
  // Read once: previewing a clip rewrites the URL and drops the state.
  const fromSheetRef = useRef(location.state?.fromSheet === true);
  const leavePick = () => {
    if (fromSheetRef.current) navigate(-1);
    else navigate('/teacher/videos', { replace: true });
  };
  const save = async (ids) => {
    if (saving) return;
    setSaving(true);
    setSaveFailed(false);
    const { ok } = await saveClipPicks(user.uid, pickDay, ids);
    setSaving(false);
    if (ok) leavePick();
    else setSaveFailed(true);
  };

  const q = norm(query).trim();
  const results = useMemo(() => {
    const hits = describeVideos.filter((c) => matches(c, q));
    if (!leading.length) return hits;
    const rank = (c) => { const k = leading.indexOf(c.id); return k < 0 ? leading.length : k; };
    return [...hits].sort((a, b) => rank(a) - rank(b));
  }, [q, leading]);

  // The stage steps through what the teacher was looking at: with a search on,
  // the arrows stay inside the results. A pasted link to a clip the search
  // hides falls back to the whole deck rather than to nothing.
  const stageList = results.some((c) => c.id === openId) ? results : describeVideos;
  const stageIndex = stageList.findIndex((c) => c.id === openId);

  // Pick mode rides along in the URL while a clip is previewed.
  const base = pickDay ? { pick: String(pickDay) } : {};
  const open = (id) => setParams({ ...base, clip: id });
  const close = () => {
    // Back, when the stage was opened from this grid (one history entry to
    // pop); a replace when it came from a pasted link, or back would leave
    // the app.
    if (window.history.state?.idx > 0) navigate(-1);
    else setParams(base, { replace: true });
  };

  // When the stage closes — by its button, Escape or the browser's back —
  // focus returns to the tile of the clip that was showing. After the fact,
  // not in close(): back is asynchronous and the stage is still mounted then.
  const lastOpenRef = useRef(openId);
  useEffect(() => {
    const was = lastOpenRef.current;
    lastOpenRef.current = openId;
    if (!openId && was) document.getElementById(`vl-tile-${was}`)?.focus();
  }, [openId]);
  const step = (i) => setParams({ ...base, clip: stageList[i].id }, { replace: true });

  if (!allowed) return <Navigate to="/" replace />;

  return (
    <div className="vl-page">
      <header className="vl-head">
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon={<ArrowLeft size={20} aria-hidden="true" />}
          aria-label={pickTopic ? 'Back without saving' : 'Back to the teacher panel'}
          onClick={() => (pickTopic ? leavePick() : navigate('/teacher'))}
        />
        <div className="vl-head-text">
          {pickTopic ? (
            <>
              <h1 className="vl-title">Choose clips</h1>
              <p className="vl-sub">
                Day {pickTopic.day} · {pickTopic.topic}. Tap a clip to add or remove it — they play in the order you add them.
              </p>
            </>
          ) : (
            <>
              <h1 className="vl-title">Video library</h1>
              <p className="vl-sub">
                All {describeVideos.length} clips. Pick one that fits your student, then share this tab.
              </p>
            </>
          )}
        </div>
      </header>

      <label className="vl-search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search what happens: dog, kitchen, rain…"
          aria-label="Search clips"
          enterKeyHint="search"
        />
        {query && (
          <button type="button" className="vl-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </label>

      {q && results.length > 0 && (
        <p className="vl-count" aria-live="polite">
          {results.length} of {describeVideos.length}
        </p>
      )}

      {results.length === 0 ? (
        <div className="vl-empty" aria-live="polite">
          <p className="vl-empty-title">No clip shows “{query.trim()}”.</p>
          <p className="vl-empty-sub">Try what you would see on screen: an animal, a place, an action.</p>
          <Button variant="secondary" size="sm" onClick={() => setQuery('')}>Show all clips</Button>
        </div>
      ) : (
        <ul className="vl-grid">
          {results.map((clip) => {
            const order = pickTopic && chosen ? chosen.indexOf(clip.id) : -1;
            const picked = order >= 0;
            return (
              <li key={clip.id} className={pickTopic ? 'vl-cell--pick' : undefined}>
                <button
                  type="button"
                  id={`vl-tile-${clip.id}`}
                  className={`vl-tile${picked ? ' picked' : ''}`}
                  onClick={() => (pickTopic ? toggle(clip.id) : open(clip.id))}
                  aria-label={clip.alt}
                  aria-pressed={pickTopic ? picked : undefined}
                  disabled={pickTopic && !chosen}
                >
                  <span className="vl-thumb">
                    <img src={clip.poster} alt="" loading="lazy" decoding="async" />
                    {clip.seconds ? <span className="vl-dur">{clip.seconds}s</span> : null}
                    {picked && <span className="vl-order" aria-hidden="true">{order + 1}</span>}
                  </span>
                  <span className="vl-words">{(clip.keywords || []).slice(0, 3).join(' · ')}</span>
                </button>
                {pickTopic && (
                  <button type="button" className="vl-preview" onClick={() => open(clip.id)} aria-label={`Preview: ${clip.alt}`}>
                    <Play size={14} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {pickTopic && (
        <div className="vl-pickbar" role="region" aria-label="Chosen clips">
          <span className="vl-pickbar-count" aria-live="polite">
            {chosen ? `${chosen.length} chosen` : 'Loading…'}
            {chosen && chosen.length >= MAX_PICKS ? ` · ${MAX_PICKS} is the most` : ''}
          </span>
          {saveFailed && <span className="vl-pickbar-error">Not saved. Try again.</span>}
          <Button variant="ghost" size="sm" onClick={() => save([])} disabled={saving || !chosen}>
            Topic's own
          </Button>
          <Button
            size="sm"
            icon={<Check size={16} aria-hidden="true" />}
            onClick={() => save(chosen)}
            disabled={saving || !chosen || chosen.length === 0}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      )}

      {stageIndex >= 0 && (
        <Stage clips={stageList} index={stageIndex} onIndexChange={step} onClose={close} />
      )}
    </div>
  );
}
