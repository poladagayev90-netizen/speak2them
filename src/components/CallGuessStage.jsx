import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Target, Timer, Trophy, Languages } from 'lucide-react';
import { guessQuestions } from '../data/guessQuestions';
import {
  parseGuess, formatNumber, describeNumber, accuracyLabel, pickWinners,
  GUESS_ROUND_SECONDS,
} from '../utils/guessGame';
import { getFeedbackLanguage, FEEDBACK_LANGUAGES } from '../utils/feedbackLanguage';

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
  const scoredRef = useRef(null);

  const lang = getFeedbackLanguage();
  const langLabel = FEEDBACK_LANGUAGES.find((l) => l.code === lang)?.label || 'Translate';
  const translation = card[lang];

  // Every card is a fresh round: clear the box, the timer and the translation
  // toggle. Without this reset the next question opens already "finished".
  useEffect(() => {
    setDraft('');
    setTimeUp(false);
    setShowTranslation(false);
  }, [cardIndex]);

  const bothAnswered = hasMine && hasTheirs;

  // The countdown is derived from a shared deadline rather than counted down
  // locally, so a player who opens the panel late still sees the real time
  // remaining instead of a fresh 45 seconds.
  useEffect(() => {
    if (bothAnswered) return undefined;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) setTimeUp(true);
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

  const submit = () => {
    const value = parseGuess(draft);
    if (value === null) return;
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
            <span className="guess-score" style={{
              color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700,
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: 20, padding: '3px 10px',
            }}>
              You {myScore} — {peerScore} {peerName || 'Partner'}
            </span>
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
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                color: secondsLeft <= 10 ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 700, margin: '10px 0 12px',
              }}>
                <Timer size={15} strokeWidth={2} aria-hidden="true" />
                {secondsLeft}s left
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
            <div style={{ marginTop: 10 }}>
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
                <p className="guess-answer" style={{ color: 'var(--text-primary)', fontSize: 28, fontWeight: 800, margin: 0 }}>
                  {formatNumber(card.a)}
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
              <button onClick={onNext} className="guess-next" style={SOLID_BTN}>Next question →</button>
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
