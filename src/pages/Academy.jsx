import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import {
  ArrowLeft, Check, CheckCircle2, ChevronLeft, ChevronRight, Circle,
  Maximize2, MonitorPlay, Play, RefreshCw, RotateCcw, Share2,
} from 'lucide-react';
import { fetchAcademyCatalogue, getCachedCatalogue } from '../utils/academyCatalogue';
import { academyShareUrl } from '../utils/academyLink';
import {
  DONE_RATIO,
  chapterKey,
  courseAction,
  courseOf,
  loadAcademyProgress,
  nextSeriesAfter,
  readLocalProgress,
  readStoredAcademyLang,
  resolveAcademyLang,
  resumeAt,
  saveAcademyProgress,
  saveStoredAcademyLang,
  seriesProgress,
} from '../utils/academyProgress';
import { getFeedbackLanguage } from '../utils/feedbackLanguage';
import { isGuestUser } from '../utils/guest';
import useBackButton from '../hooks/useBackButton';
import './Academy.css';

const COPY = {
  az: {
    backApp: 'Geri',
    kicker: 'Video bələdçilər',
    title: 'SpeakLab Academy',
    lede: 'SpeakLab-dan necə istifadə etməyi qısa videolarla öyrən — hər fəsil bir dəqiqəyə yaxındır.',
    start: 'Başla',
    cont: 'Davam et',
    again: 'Yenidən bax',
    replay: 'Yenidən bax',
    chapters: 'fəsil',
    min: 'dəq',
    watched: '{d} / {t} baxılıb',
    completed: 'Tamamlandı',
    chapterOf: 'Fəsil {i} / {t}',
    prev: 'Əvvəlki',
    next: 'Növbəti',
    nextChapter: 'Növbəti fəsil',
    nextCourse: 'Növbəti kurs',
    seen: 'Baxıldı',
    now: 'İndi',
    left: '{x} qalıb',
    chapterDone: 'Fəsil bitdi',
    courseDone: 'Kurs tamamlandı',
    nextIs: 'Növbəti: {x}',
    all: 'Bütün kurslar',
    listTitle: 'Fəsillər',
    share: 'Paylaş',
    shareCourse: 'Kursu paylaş',
    copied: 'Link kopyalandı',
    fullscreen: 'Tam ekran',
    loading: 'Yüklənir…',
    offlineTitle: 'Videoları yükləmək olmadı',
    offlineSub: 'İnterneti yoxlayıb yenidən cəhd edin.',
    retry: 'Yenidən cəhd et',
  },
  tr: {
    backApp: 'Geri',
    kicker: 'Video rehberler',
    title: 'SpeakLab Academy',
    lede: 'SpeakLab’i nasıl kullanacağını kısa videolarla öğren — her bölüm yaklaşık bir dakika.',
    start: 'Başla',
    cont: 'Devam et',
    again: 'Tekrar izle',
    replay: 'Tekrar izle',
    chapters: 'bölüm',
    min: 'dk',
    watched: '{d} / {t} izlendi',
    completed: 'Tamamlandı',
    chapterOf: 'Bölüm {i} / {t}',
    prev: 'Önceki',
    next: 'Sonraki',
    nextChapter: 'Sonraki bölüm',
    nextCourse: 'Sonraki kurs',
    seen: 'İzlendi',
    now: 'Şimdi',
    left: '{x} kaldı',
    chapterDone: 'Bölüm bitti',
    courseDone: 'Kurs tamamlandı',
    nextIs: 'Sıradaki: {x}',
    all: 'Tüm kurslar',
    listTitle: 'Bölümler',
    share: 'Paylaş',
    shareCourse: 'Kursu paylaş',
    copied: 'Bağlantı kopyalandı',
    fullscreen: 'Tam ekran',
    loading: 'Yükleniyor…',
    offlineTitle: 'Videolar yüklenemedi',
    offlineSub: 'İnternetinizi kontrol edip tekrar deneyin.',
    retry: 'Tekrar dene',
  },
};

function fmt(lang, key, vars = {}) {
  const str = COPY[lang]?.[key] || COPY.az[key] || key;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ''));
}

function clock(sec) {
  const n = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

async function copyFallback(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fallback below */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

async function sharePublicLink(title, text, url) {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Share')) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, url, dialogTitle: title });
      return 'shared';
    } catch (err) {
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('cancel') || msg.includes('abort')) return 'cancelled';
    }
  }
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyFallback(url)) ? 'copied' : 'failed';
}

export default function Academy({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { seriesId: paramSeries, chapterId: paramChapter } = useParams();

  const isGuest = isGuestUser(user);
  const uid = isGuest ? null : user?.uid || null;

  const urlParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [lang, setLangState] = useState(() => resolveAcademyLang({
    urlLang: new URLSearchParams(window.location.search).get('lang'),
    storedLang: readStoredAcademyLang(),
    guideLanguage: user?.guideLanguage,
    preferredLanguage: user?.preferredLanguage,
    feedbackLanguage: getFeedbackLanguage(),
  }));

  // Normalize legacy `?c=...&ch=...&lang=...` deep links to clean routes.
  useEffect(() => {
    const qSeries = urlParams.get('c');
    const qCh = urlParams.get('ch');
    const qLang = urlParams.get('lang');
    if (qLang === 'az' || qLang === 'tr') {
      saveStoredAcademyLang(qLang);
      setLangState(qLang);
    }
    if (qSeries && !paramSeries) {
      const target = qCh
        ? `/academy/${encodeURIComponent(qSeries)}/${encodeURIComponent(qCh)}`
        : `/academy/${encodeURIComponent(qSeries)}`;
      navigate(target, { replace: true });
    }
  }, [urlParams, paramSeries, navigate]);

  const [catalogue, setCatalogue] = useState(() => getCachedCatalogue()?.data || null);
  const [loading, setLoading] = useState(() => !getCachedCatalogue()?.data);
  const [loadError, setLoadError] = useState('');
  const [progress, setProgress] = useState(() => readLocalProgress(uid));
  const [wide, setWide] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : false
  ));
  const [ended, setEnded] = useState(false);
  const [toast, setToast] = useState('');

  const toastTimerRef = useRef(null);
  const videoRef = useRef(null);
  const frameRef = useRef(null);
  const ratioSwapRef = useRef(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const lastRemotePosRef = useRef({});

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 2400);
  }, []);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e) => {
      const v = videoRef.current;
      if (v && v.duration > 0) ratioSwapRef.current = v.currentTime / v.duration;
      setWide(e.matches);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const loadCatalogue = useCallback(async (force = false) => {
    if (!catalogue) setLoading(true);
    setLoadError('');
    const res = await fetchAcademyCatalogue({ force });
    if (res.data) setCatalogue(res.data);
    else if (!catalogue) setLoadError(res.error || 'failed');
    setLoading(false);
  }, [catalogue]);

  useEffect(() => { loadCatalogue(false); }, [loadCatalogue]);

  // Load local + Firestore progress and stamp first openedAt once.
  useEffect(() => {
    let alive = true;
    loadAcademyProgress(uid).then((merged) => {
      if (!alive) return;
      if (!merged.openedAt) {
        const stamped = { ...merged, openedAt: Date.now() };
        setProgress(stamped);
        saveAcademyProgress(uid, stamped, { syncRemote: Boolean(uid) });
      } else {
        setProgress(merged);
      }
    });
    return () => { alive = false; };
  }, [uid]);

  const activeSeries = useMemo(
    () => (catalogue?.series || []).find((s) => s.id === paramSeries) || null,
    [catalogue, paramSeries],
  );
  const activeCourse = activeSeries ? courseOf(activeSeries, lang) : null;
  const activeChapters = useMemo(() => activeCourse?.chapters || [], [activeCourse]);
  const chIndex = activeChapters.findIndex((c) => c.id === paramChapter);
  const activeChapter = chIndex >= 0 ? activeChapters[chIndex] : null;
  const isPlayer = Boolean(activeSeries && activeChapter);

  // Sync a single chapter update locally + optionally to Firestore.
  const recordChapter = useCallback((seriesId, chapterId, { pos, done, syncRemote }) => {
    const k = chapterKey(seriesId, chapterId);
    const prev = progressRef.current;
    const prevEntry = prev.chapters?.[k];
    const nextDone = Boolean(prevEntry?.done || done);
    const nextEntry = {
      done: nextDone,
      pos: Number(pos) || 0,
      at: Date.now(),
    };
    const nextState = {
      openedAt: prev.openedAt || Date.now(),
      chapters: { ...(prev.chapters || {}), [k]: nextEntry },
      last: k,
    };
    setProgress(nextState);
    if (syncRemote) lastRemotePosRef.current[k] = nextEntry.pos;
    saveAcademyProgress(uid, nextState, { syncRemote: Boolean(uid && syncRemote) });
  }, [uid]);

  // Persist playback position cleanly before leaving player or switching chapter.
  const flushPlayback = useCallback((syncRemote = true) => {
    const v = videoRef.current;
    if (!v || !activeSeries || !activeChapter) return;
    const k = chapterKey(activeSeries.id, activeChapter.id);
    const pos = Number(v.currentTime) || 0;
    const dur = Number(v.duration) || Number(activeChapter.dur) || 0;
    const prevDone = Boolean(progressRef.current.chapters?.[k]?.done);
    const done = prevDone || (dur > 0 && pos >= dur * DONE_RATIO);
    const lastSent = lastRemotePosRef.current[k];
    const meaningfulDelta = lastSent === undefined || Math.abs(pos - lastSent) >= 5;
    recordChapter(activeSeries.id, activeChapter.id, {
      pos,
      done,
      syncRemote: Boolean(syncRemote && (done !== prevDone || meaningfulDelta)),
    });
  }, [activeSeries, activeChapter, recordChapter]);

  useEffect(() => {
    setEnded(false);
    return () => { flushPlayback(true); };
  }, [paramSeries, paramChapter, flushPlayback]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushPlayback(true);
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [flushPlayback]);

  useBackButton(() => {
    if (isPlayer) {
      flushPlayback(true);
      navigate(activeSeries ? `/academy/${activeSeries.id}` : '/academy');
      return true;
    }
    if (paramSeries) {
      navigate('/academy');
      return true;
    }
    navigate('/');
    return true;
  }, true);

  const toggleLang = (next) => {
    if (next === lang || (next !== 'az' && next !== 'tr')) return;
    const v = videoRef.current;
    if (v && v.duration > 0) ratioSwapRef.current = v.currentTime / v.duration;
    saveStoredAcademyLang(next);
    setLangState(next);
  };

  const handleShare = async (series, ch = null) => {
    const c = courseOf(series, lang);
    if (!c) return;
    const title = ch ? `${ch.title} — ${c.title}` : `${c.title} — SpeakLab Academy`;
    const text = ch ? ch.subtitle : c.description;
    const url = academyShareUrl(series.id, ch?.id || null, lang);
    const outcome = await sharePublicLink(title, text, url);
    if (outcome === 'copied') showToast(fmt(lang, 'copied'));
  };

  const handleFullscreen = () => {
    const v = videoRef.current;
    const fr = frameRef.current;
    if (v?.webkitEnterFullscreen) {
      try { v.webkitEnterFullscreen(); return; } catch { /* ignore */ }
    }
    if (v?.requestFullscreen) {
      v.requestFullscreen().catch(() => {});
      return;
    }
    if (fr?.requestFullscreen) fr.requestFullscreen().catch(() => {});
  };

  const handleReplay = () => {
    const v = videoRef.current;
    if (!v) return;
    setEnded(false);
    try { v.currentTime = 0; } catch { /* ignore */ }
    const pr = v.play();
    if (pr?.catch) pr.catch(() => {});
  };

  const renderChapterList = (series, currentId = null) => {
    const c = courseOf(series, lang);
    const chapters = c?.chapters || [];
    return (
      <ol className="ac-chapters">
        {chapters.map((ch, i) => {
          const k = chapterKey(series.id, ch.id);
          const entry = progress.chapters?.[k];
          const done = Boolean(entry?.done);
          const cur = ch.id === currentId;
          const r = resumeAt(progress.chapters, series.id, ch.id, ch.dur);
          const meta = done ? fmt(lang, 'seen') : cur ? fmt(lang, 'now') : r ? fmt(lang, 'left', { x: clock(ch.dur - r) }) : clock(ch.dur);
          return (
            <li key={ch.id} className="ac-ch-item">
              <button
                type="button"
                className={`ac-ch-btn${cur ? ' is-cur' : ''}`}
                aria-current={cur ? 'true' : undefined}
                onClick={() => navigate(`/academy/${series.id}/${ch.id}`)}
              >
                <span className={`ac-ch-mark${done || cur ? ' is-on' : ''}`} aria-hidden="true">
                  {cur ? <Play size={16} /> : done ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                </span>
                <span className="ac-ch-main">
                  <span className="ac-ch-title">{i + 1}. {ch.title}</span>
                  <span className="ac-ch-sub">{ch.subtitle}</span>
                </span>
                <span className="ac-ch-meta">{meta}</span>
              </button>
              <button
                type="button"
                className="ac-ch-share"
                aria-label={`${fmt(lang, 'share')}: ${ch.title}`}
                onClick={() => handleShare(series, ch)}
              >
                <Share2 size={16} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>
    );
  };

  const renderCourseCard = (series, clickableTitle = true) => {
    const c = courseOf(series, lang);
    if (!c || !c.chapters?.length) return null;
    const p = seriesProgress(series, lang, progress.chapters);
    const act = courseAction(series, lang, progress.chapters);
    const runtimeMin = Math.max(1, Math.round(c.chapters.reduce((n, ch) => n + ch.dur, 0) / 60));
    const btnLabel = fmt(lang, act.kind);
    return (
      <section key={series.id} className="ac-card" aria-label={c.title}>
        <button
          type="button"
          className="ac-poster"
          aria-label={`${btnLabel}: ${c.title}`}
          onClick={() => navigate(`/academy/${series.id}/${act.ch}`)}
        >
          <img src={c.chapters[0].landscape.poster} alt="" loading="lazy" width="960" height="540" />
          <span className="ac-play-badge" aria-hidden="true">
            <Play size={22} fill="currentColor" />
          </span>
        </button>
        <div className="ac-card-body">
          {clickableTitle ? (
            <button type="button" className="ac-title-link" onClick={() => navigate(`/academy/${series.id}`)}>
              <h2>{c.title}</h2>
            </button>
          ) : (
            <h1 className="ac-course-h1">{c.title}</h1>
          )}
          <p className="ac-desc">{c.description}</p>
          <p className="ac-meta">{c.chapters.length} {fmt(lang, 'chapters')} · {runtimeMin} {fmt(lang, 'min')}</p>
          <div className="ac-bar" role="progressbar" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.done}>
            <span style={{ width: `${p.percent}%` }} />
          </div>
          <p className="ac-bar-note">
            {p.done === p.total ? fmt(lang, 'completed') : fmt(lang, 'watched', { d: p.done, t: p.total })}
          </p>
          <div className="ac-actions">
            <button type="button" className="ac-btn ac-btn--primary" onClick={() => navigate(`/academy/${series.id}/${act.ch}`)}>
              {act.kind === 'again' ? <RotateCcw size={16} aria-hidden="true" /> : <Play size={16} fill="currentColor" aria-hidden="true" />}
              {btnLabel}
            </button>
            <button type="button" className="ac-btn ac-btn--ghost" onClick={() => handleShare(series, null)}>
              <Share2 size={16} aria-hidden="true" />
              {fmt(lang, 'share')}
            </button>
          </div>
          {renderChapterList(series, null)}
        </div>
      </section>
    );
  };

  // Player data
  const prevChapter = chIndex > 0 ? activeChapters[chIndex - 1] : null;
  const nextChapter = chIndex >= 0 && chIndex < activeChapters.length - 1 ? activeChapters[chIndex + 1] : null;
  const otherCourse = activeSeries && !nextChapter ? nextSeriesAfter(catalogue, activeSeries, lang, progress.chapters) : null;
  const otherCourseFirst = otherCourse ? courseOf(otherCourse, lang)?.chapters?.[0] : null;
  const activeMedia = activeChapter ? (wide ? activeChapter.landscape : activeChapter.portrait) : null;

  return (
    <div className={`ac-page${isPlayer ? ' ac-page--player' : ''}`} lang={lang}>
      <header className="ac-topbar">
        <button
          type="button"
          className="ac-back"
          onClick={() => {
            if (isPlayer) { flushPlayback(true); navigate(activeSeries ? `/academy/${activeSeries.id}` : '/academy'); }
            else if (paramSeries) navigate('/academy');
            else navigate('/');
          }}
        >
          <ArrowLeft size={18} aria-hidden="true" />
          <span>{paramSeries ? fmt(lang, 'back') : fmt(lang, 'backApp')}</span>
        </button>

        <div className="ac-brand">
          <MonitorPlay size={18} aria-hidden="true" />
          <span>Academy</span>
        </div>

        <div className="ac-lang" role="radiogroup" aria-label="Language">
          {['az', 'tr'].map((code) => (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={lang === code}
              className={lang === code ? 'is-on' : ''}
              onClick={() => toggleLang(code)}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <main className="ac-main">
        {loading && !catalogue ? (
          <div className="ac-empty">
            <p className="ac-meta">{fmt(lang, 'loading')}</p>
          </div>
        ) : loadError && !catalogue ? (
          <div className="ac-empty">
            <p className="ac-empty-title">{fmt(lang, 'offlineTitle')}</p>
            <p className="ac-desc">{fmt(lang, 'offlineSub')}</p>
            <button type="button" className="ac-btn ac-btn--primary" onClick={() => loadCatalogue(true)}>
              <RefreshCw size={16} aria-hidden="true" /> {fmt(lang, 'retry')}
            </button>
          </div>
        ) : isPlayer && activeMedia ? (
          <>
            <div className="ac-player-bar">
              <button type="button" className="ac-btn ac-btn--ghost ac-btn--sm" onClick={handleFullscreen}>
                <Maximize2 size={15} aria-hidden="true" /> {fmt(lang, 'fullscreen')}
              </button>
              <button type="button" className="ac-btn ac-btn--ghost ac-btn--sm" onClick={() => handleShare(activeSeries, activeChapter)}>
                <Share2 size={15} aria-hidden="true" /> {fmt(lang, 'share')}
              </button>
            </div>

            <div className="ac-player-grid">
              <div className="ac-stage">
                <div ref={frameRef} className={`ac-frame ${wide ? 'is-landscape' : 'is-portrait'}`}>
                  <video
                    ref={videoRef}
                    key={`${activeSeries.id}_${activeChapter.id}_${lang}_${wide ? 'L' : 'P'}`}
                    controls
                    playsInline
                    preload="metadata"
                    controlsList="nodownload"
                    poster={activeMedia.poster}
                    src={activeMedia.src}
                    onLoadedMetadata={(e) => {
                      const v = e.currentTarget;
                      const dur = v.duration || activeChapter.dur;
                      let target = 0;
                      if (ratioSwapRef.current !== null) {
                        target = ratioSwapRef.current * dur;
                        ratioSwapRef.current = null;
                      } else {
                        target = resumeAt(progressRef.current.chapters, activeSeries.id, activeChapter.id, dur);
                      }
                      if (target > 0) {
                        try { v.currentTime = target; } catch { /* ignore */ }
                      }
                      const pr = v.play();
                      if (pr?.catch) pr.catch(() => {});
                    }}
                    onPlay={() => setEnded(false)}
                    onTimeUpdate={(e) => {
                      const v = e.currentTarget;
                      const dur = v.duration || activeChapter.dur;
                      if (!dur) return;
                      const k = chapterKey(activeSeries.id, activeChapter.id);
                      const prevDone = Boolean(progressRef.current.chapters?.[k]?.done);
                      if (!prevDone && v.currentTime >= dur * DONE_RATIO) {
                        recordChapter(activeSeries.id, activeChapter.id, {
                          pos: v.currentTime,
                          done: true,
                          syncRemote: true,
                        });
                      }
                    }}
                    onPause={() => flushPlayback(true)}
                    onEnded={(e) => {
                      const v = e.currentTarget;
                      const dur = v.duration || activeChapter.dur || 0;
                      setEnded(true);
                      recordChapter(activeSeries.id, activeChapter.id, { pos: dur, done: true, syncRemote: true });
                    }}
                  />

                  {ended && (
                    <div className="ac-ended">
                      <span className="ac-ended-mark" aria-hidden="true"><Check size={24} strokeWidth={2.5} /></span>
                      <p className="ac-ended-title">{nextChapter ? fmt(lang, 'chapterDone') : fmt(lang, 'courseDone')}</p>
                      {(nextChapter || otherCourse) && (
                        <p className="ac-ended-sub">
                          {fmt(lang, 'nextIs', { x: nextChapter ? nextChapter.title : courseOf(otherCourse, lang)?.title })}
                        </p>
                      )}
                      <div className="ac-ended-actions">
                        {nextChapter ? (
                          <button type="button" className="ac-btn ac-btn--primary" onClick={() => navigate(`/academy/${activeSeries.id}/${nextChapter.id}`)}>
                            {fmt(lang, 'nextChapter')} <ChevronRight size={16} aria-hidden="true" />
                          </button>
                        ) : otherCourse && otherCourseFirst ? (
                          <>
                            <button type="button" className="ac-btn ac-btn--primary" onClick={() => navigate(`/academy/${otherCourse.id}/${otherCourseFirst.id}`)}>
                              {fmt(lang, 'nextCourse')} <ChevronRight size={16} aria-hidden="true" />
                            </button>
                            <button type="button" className="ac-btn ac-btn--overlay" onClick={() => navigate('/academy')}>
                              {fmt(lang, 'all')}
                            </button>
                          </>
                        ) : (
                          <button type="button" className="ac-btn ac-btn--primary" onClick={() => navigate('/academy')}>
                            {fmt(lang, 'all')}
                          </button>
                        )}
                        <button type="button" className="ac-btn ac-btn--overlay" onClick={handleReplay}>
                          <RotateCcw size={15} aria-hidden="true" /> {fmt(lang, 'replay')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="ac-now">
                  <p className="ac-kicker">{fmt(lang, 'chapterOf', { i: chIndex + 1, t: activeChapters.length })}</p>
                  <h1>{activeChapter.title}</h1>
                  <p className="ac-desc">{activeChapter.subtitle}</p>
                </div>

                <div className="ac-steps">
                  <button
                    type="button"
                    className="ac-btn ac-btn--ghost"
                    disabled={!prevChapter}
                    onClick={() => prevChapter && navigate(`/academy/${activeSeries.id}/${prevChapter.id}`)}
                  >
                    <ChevronLeft size={16} aria-hidden="true" /> {fmt(lang, 'prev')}
                  </button>
                  {nextChapter ? (
                    <button type="button" className="ac-btn ac-btn--primary" onClick={() => navigate(`/academy/${activeSeries.id}/${nextChapter.id}`)}>
                      {fmt(lang, 'next')} <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  ) : otherCourse && otherCourseFirst ? (
                    <button type="button" className="ac-btn ac-btn--primary" onClick={() => navigate(`/academy/${otherCourse.id}/${otherCourseFirst.id}`)}>
                      {fmt(lang, 'nextCourse')} <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  ) : (
                    <button type="button" className="ac-btn ac-btn--primary" onClick={() => navigate('/academy')}>
                      {fmt(lang, 'all')}
                    </button>
                  )}
                </div>
              </div>

              <aside className="ac-side" aria-label={fmt(lang, 'listTitle')}>
                <div className="ac-side-head">
                  <h2>{fmt(lang, 'listTitle')}</h2>
                  <button type="button" className="ac-btn ac-btn--ghost ac-btn--sm" onClick={() => handleShare(activeSeries, null)}>
                    <Share2 size={14} aria-hidden="true" /> {fmt(lang, 'shareCourse')}
                  </button>
                </div>
                <p className="ac-side-title">{activeCourse?.title}</p>
                {renderChapterList(activeSeries, activeChapter.id)}
              </aside>
            </div>
          </>
        ) : activeSeries ? (
          <div className="ac-single">
            {renderCourseCard(activeSeries, false)}
          </div>
        ) : (
          <>
            <div className="ac-hero">
              <p className="ac-kicker">{fmt(lang, 'kicker')}</p>
              <h1>{fmt(lang, 'title')}</h1>
              <p className="ac-desc">{fmt(lang, 'lede')}</p>
            </div>
            <div className="ac-grid">
              {(catalogue?.series || []).map((s) => renderCourseCard(s, true))}
            </div>
          </>
        )}
      </main>

      {toast && <div className="ac-toast" role="status">{toast}</div>}
    </div>
  );
}
