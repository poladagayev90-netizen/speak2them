import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Target, Timer, Trophy, Languages, Volume2, VolumeX } from 'lucide-react';
import { guessQuestions } from '../data/guessQuestions';
import {
  parseGuess, formatNumber, describeNumber, accuracyLabel, pickWinners,
  GUESS_ROUND_SECONDS,
} from '../utils/guessGame';
import { getFeedbackLanguage, FEEDBACK_LANGUAGES } from '../utils/feedbackLanguage';
import {
  sfxEnabled, setSfxEnabled, sfxGameOpen, sfxLockIn, sfxPeerLock, sfxTick,
  sfxReveal, sfxWin, sfxLose, sfxNextCard,
} from '../utils/sfx';

// In-call "Guess It" (bil bakalım). One question with a number nobody knows,
// 45 seconds to write a guess, then the closer number wins and both players
// have to say WHY they picked theirs. The number is the excuse; the argument
// afterwards is the actual English practice.
//
// EVERYTHING SYNCED lives in the call doc's `guessStage` (same pattern as
// Taboo/Debate), so both peers are always on the same card and the same clock.
//
// ABOUT THE HIDDEN GUESS: your peer's number is in the shared call document
// from the moment they submit — it has to be, that is how it reaches you at
// reveal — so this component simply does not render it until the round
// resolves. Someone with dev tools open could read it early. That is the same
// level of trust Taboo's forbidden words rely on, and the two players are
// looking at each other on a live call, which is a stronger deterrent than any
// amount of encryption.
//
// WHO WRITES THE SCORE: each player writes only their OWN score field when
// they win. Both clients hold the same two guesses and the same answer, so
// they always agree on the winner, and nobody ever writes a field the other
// one is also writing — no lost updates, no host to elect. The cost is that a
// player who closes the panel at the exact moment of reveal loses that point,
// which for a friendly in-call game is the right trade.

// Asked after the answer lands. The reveal is the moment both players actually
// want to talk — without a prompt they say "oh" and hit Next.
const TALK_PROMPTS = [
  'Why did you choose that number?',
  'How did you work it out? Explain your thinking.',
  'Was the real answer bigger or smaller than you expected? Why?',
  'Which part of this surprised you most?',
  'Guess something else about it — and say why.',
];

const PANEL = {
  pointerEvents: 'auto',
  width: '100%',
  maxWidth: 360,
  background: 'var(--bg-card)',
  borderRadius: 'var(--r-xl)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--glass-edge), var(--e-3)',
  overflow: 'hidden',
  // Same lesson the Debate panel taught: on a 320px screen the footer buttons
  // fall out of frame unless the panel is capped and only the middle scrolls.
  maxHeight: 'calc(100vh - 32px)',
  display: 'flex',
  flexDirection: 'column',
};

const FOOT_BTN = {
  flex: 1,
  height: 46,
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const GHOST_BTN = {
  ...FOOT_BTN,
  border: '1px solid var(--border)',
  background: 'var(--bg-input)',
  color: 'var(--text-secondary)',
};

const SOLID_BTN = {
  ...FOOT_BTN,
  border: 'none',
  background: 'var(--accent)',
  color: 'var(--text-on-accent)',
};

const TONE_COLOR = {
  great: 'var(--accent)',
  good: 'var(--accent)',
  ok: 'var(--text-secondary)',
  far: 'var(--text-muted)',
  muted: 'var(--text-muted)',
};

export default function CallGuessStage({
  cardIndex, deadlineMs, myUid, peerUid, peerName,
  answers = {}, scores = {},
  onSubmit, onWin, onNext, onClose,
}) {
  const card = guessQuestions[cardIndex % guessQuestions.length];
  const myGuess = answers[myUid];
  const peerGuess = answers[peerUid];
  const hasMine = typeof myGuess === 'number';
  const hasTheirs = typeof peerGuess === 'number';

  const [draft, setDraft] = useState('');
  const [timeUp, setTimeUp] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(GUESS_ROUND_SECONDS);
  // Kept separate from secondsLeft: the bar should drain smoothly, but the
  // number must stay a whole second or it reads as a stopwatch, not a clock.
  const [fraction, setFraction] = useState(1);
  const [soundOn, setSoundOn] = useState(() => sfxEnabled());
  // The answer counts up on reveal instead of appearing. A number that simply
  // shows up reads like a form field; counting is the one cue that makes this
  // feel like a game show, and it costs nothing.
  const [rolled, setRolled] = useState(null);
  const scoredRef = useRef(null);
  const revealSoundRef = useRef(null);
  const tickedAtRef = useRef(null);
  const peerWasLockedRef = useRef(false);

  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const lang = getFeedbackLanguage();
  const langLabel = FEEDBACK_LANGUAGES.find((l) => l.code === lang)?.label || 'Translate';
  const translation = card[lang];

  // Every card is a fresh round: clear the box, the timer and the translation
  // toggle. Without this reset the next question opens already "finished".
  useEffect(() => {
    setDraft('');
    setTimeUp(false);
    setShowTranslation(false);
    setRolled(null);
  }, [cardIndex]);

  const bothAnswered = hasMine && hasTheirs;

  // The countdown is derived from a shared deadline rather than counted down
  // locally, so a player who opens the panel late still sees the real time
  // remaining instead of a fresh 45 seconds.
  useEffect(() => {
    if (bothAnswered) return undefined;
    const tick = () => {
      const msLeft = Math.max(0, deadlineMs - Date.now());
      setSecondsLeft(Math.ceil(msLeft / 1000));
      setFraction(Math.min(1, msLeft / (GUESS_ROUND_SECONDS * 1000)));
      if (msLeft <= 0) setTimeUp(true);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadlineMs, bothAnswered, cardIndex]);

  const revealed = bothAnswered || timeUp;

  const winners = useMemo(
    () => (revealed
      ? pickWinners([{ uid: myUid, guess: myGuess }, { uid: peerUid, guess: peerGuess }], card.a)
      : []),
    [revealed, myUid, peerUid, myGuess, peerGuess, card.a],
  );
  const iWon = winners.includes(myUid);

  // Record my own point, once per card. The ref stops React's re-renders from
  // firing a second write before the new score arrives back from Firestore.
  useEffect(() => {
    if (!revealed || !iWon) return;
    if (scoredRef.current === cardIndex) return;
    scoredRef.current = cardIndex;
    onWin();
  }, [revealed, iWon, cardIndex, onWin]);

  // ── Sound ─────────────────────────────────────────────────────────────────
  // sfx.js normally refuses to play anything during a call; these game cues are
  // its one deliberate exception and the reasoning lives there. Each of them is
  // a single blip, never a loop.

  // Opening chime. The tap that opened the panel is a user gesture on THIS
  // device; on the peer's it may arrive with the audio context still suspended,
  // in which case sfx.js drops it silently rather than throwing.
  useEffect(() => { sfxGameOpen(); }, []);

  // Your partner just committed. Nothing on screen moves at that moment, so
  // without a sound the pressure of being the last one typing never lands.
  useEffect(() => {
    if (hasTheirs && !peerWasLockedRef.current && !revealed) sfxPeerLock();
    peerWasLockedRef.current = hasTheirs;
  }, [hasTheirs, revealed]);

  // Last five seconds only. This is the shared round clock, so it ticks for
  // both players — including the one who already answered, because the tension
  // is the point. Any longer and it would sit on top of the conversation.
  useEffect(() => {
    if (revealed || secondsLeft > 5 || secondsLeft <= 0) return;
    if (tickedAtRef.current === `${cardIndex}:${secondsLeft}`) return;
    tickedAtRef.current = `${cardIndex}:${secondsLeft}`;
    sfxTick();
  }, [secondsLeft, revealed, cardIndex]);

  // Reveal flourish, then the verdict — sequenced, not stacked, or they mush
  // into one noise. Guarded per card so a re-render cannot replay it.
  useEffect(() => {
    if (!revealed) return undefined;
    if (revealSoundRef.current === cardIndex) return undefined;
    revealSoundRef.current = cardIndex;
    sfxReveal();
    const id = setTimeout(() => (iWon ? sfxWin() : sfxLose()), 620);
    return () => clearTimeout(id);
  }, [revealed, cardIndex, iWon]);

  // Count the answer up. Skipped entirely under reduced motion — the value
  // still lands, it just does not travel.
  useEffect(() => {
    if (!revealed) return undefined;
    if (reducedMotion) { setRolled(card.a); return undefined; }
    let raf;
    const t0 = performance.now();
    const step = (now) => {
      // Clamped at BOTH ends. requestAnimationFrame hands the callback the
      // frame's start time, which can be a hair EARLIER than the
      // performance.now() taken just before scheduling it — so `now - t0` goes
      // negative on the first frame, (1 - p) ** 3 exceeds 1, and the reveal
      // flashes a minus sign before it starts counting.
      const p = Math.min(1, Math.max(0, (now - t0) / 900));
      setRolled(card.a * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [revealed, card.a, cardIndex, reducedMotion]);

  const submit = () => {
    const value = parseGuess(draft);
    if (value === null) return;
    sfxLockIn();
    onSubmit(value);
  };

  const myScore = scores[myUid] || 0;
  const peerScore = scores[peerUid] || 0;
  const parsedDraft = parseGuess(draft);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 'var(--z-stage)',
      background: 'var(--overlay)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', pointerEvents: 'none',
    }}>
      <div className="guess-panel" style={PANEL}>
        {/* Header: title, running score, close */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 16px 8px', flexShrink: 0,
        }}>
          <p style={{
            color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: 0,
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <Target size={17} strokeWidth={2} aria-hidden="true" />
            Guess It
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Keyed on the score so a point remounts the chip and it pops —
                otherwise the number changes with no acknowledgement at all. */}
            <span
              key={`${myScore}-${peerScore}`}
              className="guess-score guess-score-pop"
              style={{
                color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700,
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap',
              }}
            >
              You {myScore} — {peerScore} {peerName || 'Partner'}
            </span>
            {/* This is the app-wide sound switch, the same one Profile shows —
                one setting, not a second one that quietly disagrees with it. */}
            <button
              className="guess-sound"
              onClick={() => {
                const next = !soundOn;
                setSfxEnabled(next);
                setSoundOn(next);
                if (next) sfxLockIn();
              }}
              aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'}
              aria-pressed={soundOn}
              style={{
                background: 'transparent', border: 'none',
                color: soundOn ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer', padding: '2px 2px', display: 'flex',
              }}
            >
              {soundOn
                ? <Volume2 size={17} strokeWidth={2} aria-hidden="true" />
                : <VolumeX size={17} strokeWidth={2} aria-hidden="true" />}
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                cursor: 'pointer', padding: '2px 4px', display: 'flex',
              }}
            >
              <X size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Scrolling middle: question, then either the input or the result */}
        <div style={{ padding: '0 16px', overflowY: 'auto', minHeight: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 8, marginBottom: 8,
          }}>
            <span style={{
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', borderRadius: 20,
              padding: '3px 10px', fontSize: 11, fontWeight: 700,
            }}>
              {card.cat}
            </span>
            {translation && (
              <button
                onClick={() => setShowTranslation((v) => !v)}
                className="guess-translate"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: showTranslation ? 'var(--ai-fill)' : 'transparent',
                  color: showTranslation ? 'var(--text-on-ai)' : 'var(--ai)',
                  border: `1px solid ${showTranslation ? 'transparent' : 'var(--border)'}`,
                  borderRadius: 20, padding: '3px 10px',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <Languages size={13} strokeWidth={2} aria-hidden="true" />
                {langLabel}
              </button>
            )}
          </div>

          <p className="guess-question" style={{
            color: 'var(--text-primary)', fontSize: 19, fontWeight: 700, lineHeight: 1.35,
            margin: '0 0 6px', textAlign: 'center',
          }}>
            {card.q}
          </p>

          {showTranslation && translation && (
            <p className="guess-translation" style={{
              color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, lineHeight: 1.4,
              margin: '0 0 4px', textAlign: 'center',
            }}>
              {translation}
            </p>
          )}

          {!revealed && (
            <>
              <div
                className={secondsLeft <= 5 ? 'guess-timer is-urgent' : 'guess-timer'}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  color: secondsLeft <= 10 ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: 13, fontWeight: 700, margin: '10px 0 6px',
                }}
              >
                <Timer size={15} strokeWidth={2} aria-hidden="true" />
                {secondsLeft}s left
              </div>

              {/* A number alone does not read as pressure. The bar does the
                  work a countdown is actually for: showing it shrinking. */}
              <div
                className="guess-bar"
                role="progressbar"
                aria-label="Time left in this round"
                aria-valuemin={0}
                aria-valuemax={GUESS_ROUND_SECONDS}
                aria-valuenow={secondsLeft}
                style={{
                  height: 4, borderRadius: 4, background: 'var(--bg-input)',
                  overflow: 'hidden', margin: '0 0 12px',
                }}
              >
                <div style={{
                  height: '100%', width: `${Math.max(0, fraction) * 100}%`,
                  background: secondsLeft <= 10 ? 'var(--accent)' : 'var(--text-muted)',
                  borderRadius: 4,
                  transition: 'width 250ms linear, background 300ms ease',
                }} />
              </div>

              {/* The player still typing had no way of knowing the other one
                  was already done — which is half the pressure of the game. */}
              {hasTheirs && !hasMine && (
                <p style={{
                  color: 'var(--accent)', fontSize: 12, fontWeight: 700,
                  textAlign: 'center', margin: '-6px 0 10px',
                }}>
                  {peerName || 'Your partner'} has locked in an answer
                </p>
              )}

              {hasMine ? (
                <div style={{
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                  borderRadius: 14, padding: '16px 14px', textAlign: 'center',
                }}>
                  <p style={{
                    color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, margin: '0 0 4px',
                    textTransform: 'uppercase', letterSpacing: '1px',
                  }}>
                    Your answer is locked
                  </p>
                  <p style={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 800, margin: 0 }}>
                    {formatNumber(myGuess)} <span style={{ fontSize: 14, fontWeight: 700 }}>{card.unit}</span>
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, margin: '8px 0 0' }}>
                    {hasTheirs
                      ? 'Opening the answer…'
                      : `Waiting for ${peerName || 'your partner'} — talk while you wait!`}
                  </p>
                </div>
              ) : (
                <>
                  <input
                    className="guess-input"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                    inputMode="numeric"
                    placeholder="Your number"
                    aria-label={`Your guess in ${card.unit}`}
                    style={{
                      width: '100%', height: 54, borderRadius: 14, textAlign: 'center',
                      background: 'var(--bg-input)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', fontSize: 22, fontWeight: 800,
                      fontFamily: 'inherit', outline: 'none',
                    }}
                  />
                  <p style={{
                    color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
                    textAlign: 'center', margin: '6px 0 0',
                  }}>
                    in <strong>{card.unit}</strong>
                    {parsedDraft !== null && parsedDraft >= 1e6 && (
                      <> — that is {describeNumber(parsedDraft)}</>
                    )}
                  </p>

                  {/* Typing eleven zeros on a phone keypad is how you lose a
                      player. The chips append a multiplier instead, and only
                      appear once there is something to multiply. */}
                  {/^\d+(\.\d+)?$/.test(draft.trim()) && (
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
                      {[['k', 'thousand'], ['m', 'million'], ['b', 'billion']].map(([s, word]) => (
                        <button
                          key={s}
                          onClick={() => setDraft((d) => `${d.trim()}${s}`)}
                          style={{
                            border: '1px solid var(--border)', background: 'var(--bg-input)',
                            color: 'var(--text-secondary)', borderRadius: 10,
                            padding: '6px 12px', fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {word}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {revealed && (
            <div className="guess-reveal" style={{ marginTop: 10 }}>
              <div style={{
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 16, padding: '14px', textAlign: 'center',
              }}>
                <p style={{
                  color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, margin: '0 0 2px',
                  textTransform: 'uppercase', letterSpacing: '1px',
                }}>
                  The answer
                </p>
                {/* Tabular figures: without them every frame of the count-up
                    changes the text width and the whole card jitters. */}
                <p className="guess-answer" style={{
                  color: 'var(--text-primary)', fontSize: 28, fontWeight: 800, margin: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {/* Before the first animation frame `rolled` is still null,
                      and rendering card.a there flashed the real answer for one
                      frame — the count-up then started over from zero, so the
                      panel gave the number away and then pretended not to
                      have. Start at zero and let the animation deliver it. */}
                  {formatNumber(rolled === null
                    ? (reducedMotion ? card.a : 0)
                    : Math.round(rolled))}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700, margin: '2px 0 0' }}>
                  {card.unit}{describeNumber(card.a) ? ` · ${describeNumber(card.a)}` : ''}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {[
                  { label: 'You', guess: myGuess, uid: myUid },
                  { label: peerName || 'Partner', guess: peerGuess, uid: peerUid },
                ].map((p) => {
                  const acc = accuracyLabel(p.guess, card.a);
                  const won = winners.includes(p.uid);
                  return (
                    <div key={p.uid} className={`guess-player ${p.uid === myUid ? 'is-me' : 'is-peer'}${won ? ' is-winner' : ''}`} style={{
                      flex: 1, minWidth: 0, borderRadius: 14, padding: '10px 8px', textAlign: 'center',
                      background: won ? 'var(--accent)' : 'var(--bg-input)',
                      border: `1px solid ${won ? 'transparent' : 'var(--border)'}`,
                      color: won ? 'var(--text-on-accent)' : 'var(--text-primary)',
                    }}>
                      <p style={{
                        fontSize: 11, fontWeight: 700, margin: '0 0 3px',
                        opacity: won ? 0.85 : 1,
                        color: won ? 'var(--text-on-accent)' : 'var(--text-muted)',
                        textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap',
                      }}>
                        {won && <Trophy size={11} strokeWidth={2.5} aria-hidden="true" style={{ verticalAlign: -1, marginRight: 3 }} />}
                        {p.label}
                      </p>
                      <p style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                        {typeof p.guess === 'number' ? formatNumber(p.guess) : '—'}
                      </p>
                      <p style={{
                        fontSize: 11, fontWeight: 700, margin: '3px 0 0',
                        color: won ? 'var(--text-on-accent)' : TONE_COLOR[acc.tone],
                        opacity: won ? 0.9 : 1,
                      }}>
                        {acc.text}
                      </p>
                    </div>
                  );
                })}
              </div>

              <p style={{
                color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, lineHeight: 1.45,
                margin: '12px 0 0', textAlign: 'center',
              }}>
                {card.fact}
              </p>

              <div style={{
                marginTop: 12, borderRadius: 14, padding: '12px 14px',
                background: 'var(--bg-input)', border: '1px solid var(--ai)',
              }}>
                <p style={{
                  color: 'var(--ai)', fontSize: 11, fontWeight: 700, margin: '0 0 4px',
                  textTransform: 'uppercase', letterSpacing: '1px',
                }}>
                  Now talk about it
                </p>
                <p style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, margin: 0, lineHeight: 1.4 }}>
                  {TALK_PROMPTS[cardIndex % TALK_PROMPTS.length]}
                </p>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '14px 16px 16px', flexShrink: 0 }}>
          {revealed ? (
            <>
              <button onClick={onClose} className="guess-finish" style={GHOST_BTN}>Finish</button>
              <button
                onClick={() => { sfxNextCard(); onNext(); }}
                className="guess-next"
                style={SOLID_BTN}
              >
                Next question →
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="guess-finish" style={GHOST_BTN}>Finish</button>
              <button
                onClick={submit}
                className="guess-submit"
                disabled={hasMine || parsedDraft === null}
                style={{
                  ...SOLID_BTN,
                  opacity: hasMine || parsedDraft === null ? 0.45 : 1,
                  cursor: hasMine || parsedDraft === null ? 'default' : 'pointer',
                }}
              >
                {hasMine ? 'Locked in' : 'Lock in answer'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
