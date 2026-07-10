import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { ArrowLeft } from 'lucide-react';
import { getTodayPuzzle, getTodayPuzzleIndex } from '../data/puzzleWords';

const MAX_GUESSES = 6;
const KEY_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL'],
];
const STORAGE_KEY = 'dailyPuzzle_v1';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Standard Wordle scoring, two passes so duplicate letters behave correctly:
// exact positions claim their letters first, then remaining letters can mark
// "present" only as many times as they occur in the answer.
function scoreGuess(guess, answer) {
  const result = Array(5).fill('absent');
  const remaining = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) {
      result[i] = 'correct';
    } else {
      remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
    }
  }
  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue;
    if (remaining[guess[i]] > 0) {
      result[i] = 'present';
      remaining[guess[i]] -= 1;
    }
  }
  return result;
}

function loadState(dayIndex) {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (raw && raw.dayIndex === dayIndex && Array.isArray(raw.guesses)) return raw;
  } catch (e) { /* corrupt state — start fresh */ }
  return { dayIndex, guesses: [], won: false, rewarded: false };
}

export default function DailyPuzzle({ user }) {
  const navigate = useNavigate();
  const dayIndex = getTodayPuzzleIndex();
  const puzzle = useMemo(() => getTodayPuzzle(), []);
  const answer = puzzle.word;

  const [state, setState] = useState(() => loadState(dayIndex));
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);
  const [burst, setBurst] = useState(false);
  const reduceMotion = prefersReducedMotion();

  const done = state.won || state.guesses.length >= MAX_GUESSES;
  const wrongCount = state.guesses.length - (state.won ? 1 : 0);
  const showAzHint = state.won || wrongCount >= 3 || done;

  const persist = useCallback((next) => {
    setState(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) {}
  }, []);

  // +2 bonus minutes, once per day. The localStorage `rewarded` flag guards
  // the write; the increment itself is merge-safe.
  const grantReward = useCallback((next) => {
    if (next.rewarded || !user?.uid) return next;
    setDoc(doc(db, 'users', user.uid), {
      puzzleWins: increment(1),
      bonusMinutes: increment(2),
      lastPuzzleDate: new Date().toDateString(),
    }, { merge: true }).catch((e) => console.error('[Puzzle] reward failed:', e));
    return { ...next, rewarded: true };
  }, [user?.uid]);

  const submitGuess = useCallback(() => {
    if (done) return;
    if (input.length !== 5) {
      setShake(true);
      setTimeout(() => setShake(false), 450);
      return;
    }
    const guess = input.toUpperCase();
    const won = guess === answer;
    let next = { ...state, guesses: [...state.guesses, guess], won };
    if (won) {
      next = grantReward(next);
      setBurst(true);
      setTimeout(() => setBurst(false), 1500);
    }
    persist(next);
    setInput('');
  }, [done, input, answer, state, persist, grantReward]);

  const handleKey = useCallback((key) => {
    if (done) return;
    if (key === 'ENTER') { submitGuess(); return; }
    if (key === 'DEL') { setInput((v) => v.slice(0, -1)); return; }
    if (/^[A-Z]$/.test(key)) setInput((v) => (v.length < 5 ? v + key : v));
  }, [done, submitGuess]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Enter') handleKey('ENTER');
      else if (e.key === 'Backspace') handleKey('DEL');
      else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKey]);

  // Aggregate the best-known state per letter for keyboard colouring:
  // correct beats present beats absent.
  const keyStates = useMemo(() => {
    const rank = { correct: 3, present: 2, absent: 1 };
    const states = {};
    state.guesses.forEach((g) => {
      const score = scoreGuess(g, answer);
      for (let i = 0; i < 5; i++) {
        if ((rank[score[i]] || 0) > (rank[states[g[i]]] || 0)) states[g[i]] = score[i];
      }
    });
    return states;
  }, [state.guesses, answer]);

  const rows = Array.from({ length: MAX_GUESSES }, (_, r) => {
    if (r < state.guesses.length) {
      const guess = state.guesses[r];
      return { letters: guess.split(''), score: scoreGuess(guess, answer), revealed: true };
    }
    if (r === state.guesses.length && !done) {
      return { letters: input.padEnd(5).split(''), score: null, revealed: false, active: true };
    }
    return { letters: Array(5).fill(''), score: null, revealed: false };
  });

  return (
    <div className="home-page">
      <div className="home-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => navigate('/')}
          aria-label="Geri"
          style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', padding: 4 }}
        >
          <ArrowLeft size={22} />
        </button>
        <div className="home-logo">🧩 Günün Tapmacası</div>
      </div>

      <div className="home-body" style={{ paddingBottom: '90px', maxWidth: 420, margin: '0 auto', position: 'relative' }}>
        {burst && !reduceMotion && (
          <div className="taboo-confetti-layer" aria-hidden="true" style={{ zIndex: 5 }}>
            {Array.from({ length: 18 }, (_, i) => {
              const angle = (i / 18) * Math.PI * 2;
              const dist = 80 + (i % 4) * 30;
              return (
                <span key={i} className="taboo-confetti-piece" style={{
                  left: '50%', top: '30%',
                  background: ['#f59e0b', '#7c6ff7', '#22d3ee', '#ef4444', '#22c55e'][i % 5],
                  animationDelay: `${(i * 40) % 200}ms`,
                  '--tx': `${Math.cos(angle) * dist}px`,
                  '--ty': `${Math.sin(angle) * dist + 40}px`,
                  '--rot': `${(i * 97) % 720 - 360}deg`,
                }} />
              );
            })}
          </div>
        )}

        <div className="puzzle-hint">
          <p className="puzzle-hint-label">İpucu (EN)</p>
          <p className="puzzle-hint-text">“{puzzle.hintEN}”</p>
          {showAzHint && <p className="puzzle-hint-az">🇦🇿 {puzzle.hintAZ}</p>}
          {!showAzHint && wrongCount > 0 && (
            <p className="puzzle-hint-locked">🔒 AZ tərcümə {3 - wrongCount} səhv cəhddən sonra açılır</p>
          )}
        </div>

        <div className={`puzzle-grid${shake ? ' puzzle-shake' : ''}`}>
          {rows.map((row, r) => (
            <div className="puzzle-row" key={r}>
              {row.letters.map((ch, c) => (
                <div
                  key={c}
                  className={`puzzle-tile${row.revealed ? ` is-${row.score[c]}` : ''}${row.active && ch.trim() ? ' is-filled' : ''}`}
                  style={row.revealed && !reduceMotion ? { animationDelay: `${c * 90}ms` } : undefined}
                >
                  {ch.trim()}
                </div>
              ))}
            </div>
          ))}
        </div>

        {done && (
          <div className={`puzzle-result${state.won ? ' is-win' : ''}`}>
            {state.won ? (
              <>
                <p className="puzzle-result-title">🎉 Afərin! {state.guesses.length} cəhdə tapdın</p>
                <p className="puzzle-result-sub">+2 bonus dəqiqə qazandın. Sabah yeni söz! 🧩</p>
              </>
            ) : (
              <>
                <p className="puzzle-result-title">Söz: <b>{answer}</b> — {puzzle.hintAZ}</p>
                <p className="puzzle-result-sub">Narahat olma, sabah yeni şansın var! 💪</p>
              </>
            )}
            <button className="btn-primary" style={{ marginTop: 10 }} onClick={() => navigate('/')}>
              Ana səhifəyə qayıt
            </button>
          </div>
        )}

        {!done && (
          <div className="puzzle-keyboard">
            {KEY_ROWS.map((row, r) => (
              <div className="puzzle-key-row" key={r}>
                {row.map((k) => (
                  <button
                    key={k}
                    onClick={() => handleKey(k)}
                    className={`puzzle-key${k.length > 1 ? ' puzzle-key--wide' : ''}${keyStates[k] ? ` is-${keyStates[k]}` : ''}`}
                  >
                    {k === 'DEL' ? '⌫' : k === 'ENTER' ? '✓' : k}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
