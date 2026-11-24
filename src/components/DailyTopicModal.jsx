import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Maximize2, Minimize2, Expand, Shrink, BookOpen, MessageCircle, Lightbulb, Brain, ChevronDown, ChevronUp, ChevronRight, ImageIcon, Images, Video as VideoIcon, Headphones, BookOpenText, CalendarDays } from 'lucide-react';
import { getContentByIndex, getTodayContent, weeklyContent } from '../data/weeklyContent';
import { localMeaning } from '../utils/feedbackLanguage';
import { plainTopic } from '../utils/topicLabel';
import { upcomingTopics } from '../utils/topicQueue';
import { DEFAULT_SESSION_CONFIG, subscribeToSessionConfig } from '../utils/sessionSchedule';
import { isGuestUser } from '../utils/guest';
import PictureDescribing from './PictureDescribing';
import TopicVideos from './TopicVideos';
import { VIDEOS_ENABLED, canBrowseAllVideos } from '../utils/fetchTopicVideos';
import SpeakingCards from './SpeakingCards';
import PodcastLevels from './materials/PodcastLevels';
import ReadingView from './materials/ReadingView';
import { readingLevelFor } from '../utils/topicMaterials';
import { hasMaterials, loadMaterials } from '../utils/topicMaterialsLoader';
import './materials/materials.css';
import useMeaningLang from './materials/useMeaningLang';
import { LangSwitch } from './materials/TermText';
import SayButton from './ui/SayButton';
import useFirstRunCopy from '../hooks/useFirstRunCopy';
import { practiceText } from '../data/practiceCopy';

// Focus mode: the sheet's header and tab row fold away so Listen or Read
// fills the screen (Polad 2026-11-18 — on a phone the 3-row tab grid ate the
// script's room; on a shared laptop screen he wanted only the text). Videos
// joined on 2026-11-19 — the clip is what the teacher shares, and the header,
// tabs and picks line cost it a third of the height. Kept per device; it only
// takes effect on these tabs.
const FOCUS_KEY = 'sl.topicFocus';
const FOCUS_SECTIONS = ['listen', 'read', 'videos', 'pictures'];
function readFocus() {
  try { return localStorage.getItem(FOCUS_KEY) === '1'; } catch (_) { return false; }
}
function saveFocus(on) {
  try { localStorage.setItem(FOCUS_KEY, on ? '1' : '0'); } catch (_) { /* private mode */ }
}

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function DailyQuiz({ content, onFinish }) {
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (!content) return;
    
    const quiz = [];
    
    // Vocab questions (3 questions)
    const shuffledVocab = shuffle(content.vocabulary || []);
    const vocabCount = Math.min(3, shuffledVocab.length);
    
    for (let i = 0; i < vocabCount; i++) {
      const target = shuffledVocab[i];
      const otherMeanings = content.vocabulary.filter(v => v.word !== target.word).map(v => v.meaning);
      const options = shuffle([
        { text: target.meaning, isCorrect: true },
        ...shuffle(otherMeanings).slice(0, 3).map(m => ({ text: m, isCorrect: false }))
      ]);
      quiz.push({
        qText: `What does "${target.word}" mean?`,
        options,
      });
    }

    // Idiom questions (2 questions)
    const shuffledIdioms = shuffle(content.idioms || []);
    const idiomCount = Math.min(2, shuffledIdioms.length);
    
    for (let i = 0; i < idiomCount; i++) {
      const target = shuffledIdioms[i];
      const otherPhrases = content.idioms.filter(v => v.phrase !== target.phrase).map(v => v.phrase);
      
      const options = shuffle([
        { text: target.phrase, isCorrect: true },
        ...shuffle(otherPhrases).slice(0, 3).map(m => ({ text: m, isCorrect: false }))
      ]);
      quiz.push({
        qText: `Which of these means "${target.meaning}"?`,
        options,
      });
    }
    
    setQuestions(shuffle(quiz));
    setCurrentQ(0);
    setScore(0);
    setSelected(null);
    setIsFinished(false);
  }, [content]);

  if (questions.length === 0) return <p style={{textAlign:'center', color:'var(--text-muted)', marginTop:20}}>Loading...</p>;

  if (isFinished) {
    return (
      <div className="dt-quiz-result">
        <h3>Result</h3>
        <div className="dt-score">{score} / {questions.length}</div>
        <p>{score === questions.length ? 'Excellent. You know these well.' : 'A little more practice with these.'}</p>
        <button className="dt-quiz-next" onClick={onFinish} style={{ width: '100%', marginTop: '20px' }}>
          Back to topic
        </button>
      </div>
    );
  }

  const q = questions[currentQ];

  const handleSelect = (idx, isCorrect) => {
    if (selected !== null) return;
    setSelected(idx);
    if (isCorrect) setScore(s => s + 1);
  };

  const handleNext = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(q => q + 1);
      setSelected(null);
    } else {
      setIsFinished(true);
    }
  };

  return (
    <div className="dt-quiz-container">
      <div className="dt-quiz-header">
        <span>Question {currentQ + 1}/{questions.length}</span>
        <span>Xal: {score}</span>
      </div>
      <h3 className="dt-quiz-q">{q.qText}</h3>
      <div className="dt-quiz-options">
        {q.options.map((opt, i) => {
          let statusClass = '';
          if (selected !== null) {
            if (opt.isCorrect) statusClass = 'correct';
            else if (selected === i) statusClass = 'wrong';
          }
          return (
            <button 
              key={i} 
              className={`dt-quiz-opt ${statusClass} ${selected !== null ? 'disabled' : ''}`}
              onClick={() => handleSelect(i, opt.isCorrect)}
            >
              {opt.text}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <button className="dt-quiz-next" onClick={handleNext}>
          {currentQ < questions.length - 1 ? 'Next' : 'See result'}
        </button>
      )}
    </div>
  );
}

// `topicIndex` shows that topic instead of today's (a lesson's topic sheet on
// /class/:id — the same sheet the teacher shares in the lesson).
export default function DailyTopicModal({ open, onClose, user, topicIndex = null, todayIndex = null, onSelectTopic = null }) {
  const { lang } = useFirstRunCopy(user?.guideLanguage);
  const pt = (k, v) => practiceText(lang, k, v);
  const isGuest = isGuestUser(user);
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(topicIndex);
  const [content, setContent] = useState(null);
  const [sessionConfig, setSessionConfig] = useState(DEFAULT_SESSION_CONFIG);
  // The L1 line under each word follows the same AZ / TR / EN choice as the
  // word cards (useMeaningLang). EN = no L1 line (QA 2026-11-12 O1).
  const [meaningLang] = useMeaningLang();
  const l1 = (item) => (meaningLang === 'en' ? '' : localMeaning(item, meaningLang));
  const [activeSection, setActiveSection] = useState('vocabulary');
  const [lastDescribeMode, setLastDescribeMode] = useState('pictures');
  const [difficulty, setDifficulty] = useState('easy');
  const [expandedVocab, setExpandedVocab] = useState(null);
  const [materials, setMaterials] = useState(null);
  const contentRef = useRef(null);
  const tabsRef = useRef(null);
  // Scrolled down → the three-row tab grid folds into ONE row of chips that
  // scrolls sideways (Polad 2026-11-12: the pinned grid ate so much height that
  // portrait clips shrank to a strip). Back at the top it opens up again. The
  // CSS only applies on phones (App.css, .dt-modal--compact).
  const [compactTabs, setCompactTabs] = useState(false);
  const [focusPref, setFocusPref] = useState(readFocus);
  const focus = focusPref && FOCUS_SECTIONS.includes(activeSection);
  const setFocus = (on) => { setFocusPref(on); saveFocus(on); };

  // Fullscreen (computer; the button is hidden on phones by CSS): the whole
  // SHEET goes fullscreen, not the <video>, so the words and questions stay
  // beside the clip — and the browser bar and Chrome's «sharing this tab» bar
  // leave the shared screen (Polad 2026-11-19, after a real Meet lesson).
  // Esc is the browser's own way out.
  const modalRef = useRef(null);
  const canFullscreen = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    if (!canFullscreen) return undefined;
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [canFullscreen]);
  // Closing the sheet must not leave the page stuck in fullscreen.
  useEffect(() => {
    if (open) return undefined;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    return undefined;
  }, [open]);
  useEffect(() => () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else modalRef.current?.requestFullscreen?.().catch(() => {});
  };
  const fullscreenLabel = isFullscreen ? 'Leave fullscreen (Esc)' : 'Fullscreen: hide the browser bars';
  const onContentScroll = (e) => {
    const el = e.currentTarget;
    const y = el.scrollTop;
    // Fold only when there is room to scroll well past what folding frees
    // (~130px); otherwise unfolding could pull the page back to 0 and fold
    // and unfold in a loop. Hysteresis: fold past 48px, unfold under 8px.
    const room = el.scrollHeight - el.clientHeight;
    if (!compactTabs && y > 48 && room > 200) setCompactTabs(true);
    else if (compactTabs && y < 8) setCompactTabs(false);
  };

  // A long tab (a reading, a script) must not leave the next one scrolled halfway.
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
    setCompactTabs(false);
  }, [activeSection]);

  // Esc leaves focus mode on a computer (before it would close the sheet).
  useEffect(() => {
    if (!open || !focus) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setFocusPref(false); saveFocus(false); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, focus]);

  // In the folded row the active chip is always in view.
  useEffect(() => {
    if (!compactTabs || !tabsRef.current) return;
    const row = tabsRef.current;
    const active = Array.from(row.querySelectorAll('.dt-tab.active')).find((el) => el.offsetWidth > 0);
    if (active) row.scrollLeft = active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2;
  }, [compactTabs, activeSection]);

  useEffect(() => {
    if (!open) return undefined;
    if (isGuest) {
      setSessionConfig(DEFAULT_SESSION_CONFIG);
      return undefined;
    }
    return subscribeToSessionConfig(setSessionConfig);
  }, [open, isGuest]);

  useEffect(() => {
    if (open) {
      setSelectedTopicIndex(topicIndex);
      setActiveSection('vocabulary');
      setExpandedVocab(null);
    }
  }, [open, topicIndex]);

  useEffect(() => {
    if (open) {
      setContent(Number.isInteger(selectedTopicIndex) ? getContentByIndex(selectedTopicIndex) : getTodayContent());
    }
  }, [open, selectedTopicIndex]);

  const baseTodayIndex = useMemo(() => {
    if (Number.isInteger(todayIndex) && todayIndex >= 0) return todayIndex;
    return weeklyContent.indexOf(getTodayContent());
  }, [todayIndex]);

  const upcomingList = useMemo(() => (
    baseTodayIndex < 0
      ? []
      : upcomingTopics({ currentIndex: baseTodayIndex, total: weeklyContent.length, count: 6, config: sessionConfig, lang })
  ), [baseTodayIndex, sessionConfig, lang]);

  const selectSection = (sec) => {
    if (sec === 'pictures' || sec === 'videos') setLastDescribeMode(sec);
    setActiveSection(sec);
  };

  const openDescribe = () => {
    setActiveSection(VIDEOS_ENABLED ? lastDescribeMode : 'pictures');
  };

  const switchTopic = (idx) => {
    setSelectedTopicIndex(idx);
    if (typeof onSelectTopic === 'function') onSelectTopic(idx);
    setActiveSection('vocabulary');
    setExpandedVocab(null);
    if (contentRef.current) contentRef.current.scrollTop = 0;
  };

  // Listening + reading exist for some topics only; their tabs appear when they do.
  useEffect(() => {
    let alive = true;
    setMaterials(null);
    if (open && content && hasMaterials(content.day)) {
      loadMaterials(content.day).then((m) => { if (alive) setMaterials(m); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [open, content]);

  if (!open || !content) return null;

  return (
    <div className="dt-overlay" onClick={onClose}>
      <div ref={modalRef} className={`dt-modal${compactTabs ? ' dt-modal--compact' : ''}${focus ? ' dt-modal--focus' : ''}`} onClick={e => e.stopPropagation()}>

        {focus && (
          <div className="dt-focus-actions">
            {canFullscreen && (
              <button type="button" className="dt-focus-exit dt-fs-btn" onClick={toggleFullscreen} aria-label={fullscreenLabel} title={fullscreenLabel}>
                {isFullscreen ? <Shrink size={18} /> : <Expand size={18} />}
              </button>
            )}
            <button type="button" className="dt-focus-exit" onClick={() => setFocus(false)} aria-label="Leave focus mode (Esc)">
              <Minimize2 size={18} /> <span>Exit focus</span>
            </button>
          </div>
        )}

        {/* Header */}
        <div className="dt-header">
          <div className="dt-header-info">
            <span className="dt-badge">Day {content.day}</span>
            <h2 className="dt-title">{plainTopic(content.topic)}</h2>
          </div>
          <div className="dt-header-actions">
            {canFullscreen && (
              <button type="button" className="dt-close dt-fs-btn" onClick={toggleFullscreen} aria-label={fullscreenLabel} title={fullscreenLabel}>
                {isFullscreen ? <Shrink size={20} /> : <Expand size={20} />}
              </button>
            )}
            {FOCUS_SECTIONS.includes(activeSection) && (
              <button type="button" className="dt-close" onClick={() => setFocus(true)} aria-label="Focus mode: hide the header and tabs" title="Focus mode">
                <Maximize2 size={20} />
              </button>
            )}
            <button className="dt-close" onClick={onClose} aria-label="Close">
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="dt-tabs" ref={tabsRef}>
          <button
            className={`dt-tab ${activeSection === 'vocabulary' ? 'active' : ''}`}
            onClick={() => setActiveSection('vocabulary')}
          >
            <BookOpen size={16} /> Words
          </button>
          {materials?.podcast && (
            <button
              className={`dt-tab ${activeSection === 'listen' ? 'active' : ''}`}
              onClick={() => setActiveSection('listen')}
            >
              <Headphones size={16} /> Listen
            </button>
          )}
          {materials?.reading && (
            <button
              className={`dt-tab ${activeSection === 'read' ? 'active' : ''}`}
              onClick={() => setActiveSection('read')}
            >
              <BookOpenText size={16} /> Read
            </button>
          )}
          <button
            className={`dt-tab ${activeSection === 'idioms' ? 'active' : ''}`}
            onClick={() => setActiveSection('idioms')}
          >
            <Lightbulb size={16} /> Idioms
          </button>
          <button
            className={`dt-tab ${activeSection === 'questions' ? 'active' : ''}`}
            onClick={() => setActiveSection('questions')}
          >
            <MessageCircle size={16} /> Questions
          </button>
          <button
            className={`dt-tab ${activeSection === 'quiz' ? 'active' : ''}`}
            onClick={() => setActiveSection('quiz')}
          >
            <Brain size={16} /> Quiz
          </button>
          <button
            className={`dt-tab dt-tab--describe ${activeSection === 'pictures' || activeSection === 'videos' ? 'active' : ''}`}
            onClick={openDescribe}
          >
            <Images size={16} /> Describe
          </button>
          <button
            className={`dt-tab dt-tab--split ${activeSection === 'pictures' ? 'active' : ''}`}
            onClick={() => selectSection('pictures')}
          >
            <ImageIcon size={16} /> Pictures
          </button>
          {VIDEOS_ENABLED && (
            <button
              className={`dt-tab dt-tab--split ${activeSection === 'videos' ? 'active' : ''}`}
              onClick={() => selectSection('videos')}
            >
              <VideoIcon size={16} /> Videos
            </button>
          )}
          {upcomingList.length > 0 && (
            <button
              className={`dt-tab ${activeSection === 'next' ? 'active' : ''}`}
              onClick={() => selectSection('next')}
            >
              <CalendarDays size={16} /> Next topics
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="dt-content" ref={contentRef} onScroll={onContentScroll}>

          {activeSection === 'vocabulary' && (
            <div className="dt-section dt-section--list">
              {/* Spans the whole row: on wide screens the list is a 2-column grid and the switch would take a card's cell. */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gridColumn: '1 / -1' }}><LangSwitch compact /></div>
              {content.vocabulary.map((v, i) => (
                <div
                  key={i}
                  className={`dt-vocab-card ${expandedVocab === i ? 'expanded' : ''}`}
                  onClick={() => setExpandedVocab(expandedVocab === i ? null : i)}
                >
                  <div className="dt-vocab-row">
                    <span className="say-row">
                      <SayButton text={v.word} />
                      <span className="dt-vocab-word">{v.word}</span>
                    </span>
                    {expandedVocab === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                  <p className="dt-vocab-meaning">{v.meaning}</p>
                  {l1(v) && <p className="dt-vocab-meaning dt-meaning-l1">{l1(v)}</p>}
                  {expandedVocab === i && (
                    <p className="dt-vocab-example">"{v.example}"</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeSection === 'listen' && materials?.podcast && (
            <div className="dt-section dt-section--episode">
              <PodcastLevels podcast={materials.podcast} topic={content} userLevel={user?.level} />
            </div>
          )}

          {activeSection === 'read' && materials?.reading && (
            <div className="dt-section dt-section--read">
              <ReadingView reading={materials.reading} topic={content} initialLevel={readingLevelFor(user?.level)} />
            </div>
          )}

          {activeSection === 'idioms' && (
            <div className="dt-section dt-section--list">
              {content.idioms.map((idm, i) => (
                <div key={i} className="dt-idiom-card">
                  <div className="say-row">
                    <SayButton text={idm.phrase} />
                    <p className="dt-idiom-phrase">"{idm.phrase}"</p>
                  </div>
                  <p className="dt-idiom-meaning">{idm.meaning}</p>
                  {l1(idm) && <p className="dt-idiom-meaning dt-meaning-l1">{l1(idm)}</p>}
                  <p className="dt-idiom-example"> {idm.example}</p>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'questions' && (
            <div className="dt-section dt-section--questions">
              <div className="dt-diff-toggle">
                <button
                  className={`dt-diff-btn ${difficulty === 'easy' ? 'active' : ''}`}
                  onClick={() => setDifficulty('easy')}
                >
                  Easy
                </button>
                <button
                  className={`dt-diff-btn ${difficulty === 'hard' ? 'active' : ''}`}
                  onClick={() => setDifficulty('hard')}
                >
                  Hard
                </button>
              </div>
              <SpeakingCards questions={content.questions[difficulty]} />
            </div>
          )}

          {activeSection === 'quiz' && (
            <div className="dt-section dt-section--narrow">
              <DailyQuiz content={content} onFinish={() => setActiveSection('vocabulary')} />
            </div>
          )}

          {(activeSection === 'pictures' || activeSection === 'videos') && VIDEOS_ENABLED && (
            <div className="dt-describe-switch" role="tablist" aria-label="Describe mode">
              <button
                type="button"
                role="tab"
                aria-selected={activeSection === 'pictures'}
                className={`dt-describe-btn${activeSection === 'pictures' ? ' active' : ''}`}
                onClick={() => selectSection('pictures')}
              >
                <ImageIcon size={15} aria-hidden="true" /> Pictures
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeSection === 'videos'}
                className={`dt-describe-btn${activeSection === 'videos' ? ' active' : ''}`}
                onClick={() => selectSection('videos')}
              >
                <VideoIcon size={15} aria-hidden="true" /> Videos
              </button>
            </div>
          )}

          {VIDEOS_ENABLED && activeSection === 'videos' && <TopicVideos day={content.day} showLibrary={canBrowseAllVideos(user)} uid={user?.uid} />}

          {activeSection === 'pictures' && (
            <PictureDescribing
              inline
              topic={content.topic}
              day={content.day}
              imageKeywords={content.imageKeywords}
              manualImageUrls={content.manualImageUrls}
              onClose={onClose}
            />
          )}

          {activeSection === 'next' && (
            <div className="dt-section dt-section--narrow dt-next-list">
              {Number.isInteger(selectedTopicIndex) && baseTodayIndex >= 0 && selectedTopicIndex !== baseTodayIndex && (
                <button
                  type="button"
                  className="dt-next-item dt-next-item--today"
                  onClick={() => switchTopic(null)}
                >
                  <span className="dt-next-meta">{pt('today')} · {pt('topic.day', { day: weeklyContent[baseTodayIndex]?.day })}</span>
                  <span className="dt-next-title">{plainTopic(weeklyContent[baseTodayIndex]?.topic)}</span>
                  <ChevronRight size={18} className="dt-next-arrow" aria-hidden="true" />
                </button>
              )}
              {upcomingList.map((item) => {
                const itemTopic = weeklyContent[item.index];
                const isCurrent = selectedTopicIndex === item.index;
                return (
                  <button
                    key={item.dateStr}
                    type="button"
                    className={`dt-next-item${isCurrent ? ' is-current' : ''}`}
                    onClick={() => switchTopic(item.index)}
                  >
                    <span className="dt-next-meta">{item.label} · {pt('topic.day', { day: itemTopic?.day })}</span>
                    <span className="dt-next-title">{plainTopic(itemTopic?.topic)}</span>
                    <ChevronRight size={18} className="dt-next-arrow" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
