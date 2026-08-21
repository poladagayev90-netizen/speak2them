import React from 'react';

// Conversation roadmap shown to both peers the moment a call connects, so
// nobody sits in silence wondering what to talk about. It now doubles as a
// short "how to start talking" guide (5 steps), while still surfacing the
// shared daily topic + starter questions. The 📅 panel carries the full
// question/vocab set for anyone who wants more.

const STEPS = [
  {
    label: 'Start by introducing yourself',
    text: 'Share your name, where you are from and why you are learning English. It is an easy way into the conversation.',
  },
  {
    label: 'Use the ready-made topic questions',
    text: "The questions in Today’s Topic keep the conversation moving, so you never have to search for something to say.",
    feature: 'daily',
  },
  {
    label: 'Describe what you see',
    text: 'Describe the picture on screen in as much detail as you can. It is the most effective way to put your vocabulary to work.',
  },
  {
    label: 'Pick your own topic',
    text: 'The ready-made questions are optional — take the conversation anywhere you like. The goal is to keep talking.',
  },
  {
    label: 'Try the Taboo game',
    text: 'Explain a word without saying it — a fast, playful way to build fluency.',
  },
];

export default function CallRoadmap({ content, onStart, onOpenDaily }) {
  if (!content) return null;

  const starterQuestions = (content.questions?.easy || []).slice(0, 3);

  return (
    <div className="call-roadmap">
      <div className="call-roadmap-card">
        <button
          className="call-roadmap-skip"
          onClick={onStart}
          aria-label="Skip the guide and start the call"
        >
          Skip
        </button>

        <p className="call-roadmap-label">How to start</p>
        <h2 className="call-roadmap-title">How to start talking</h2>

        {content.topic && (
          <div className="call-roadmap-topic-pill">
            Today's topic · <b>{content.topic}</b>
          </div>
        )}

        <div className="call-roadmap-steps">
          {STEPS.map((step, i) => (
            <div key={i} className="call-roadmap-step">
              <span className="call-roadmap-step-num">{i + 1}</span>
              <div className="call-roadmap-step-body">
                <p className="call-roadmap-step-label">{step.label}</p>
                <p className="call-roadmap-step-text">{step.text}</p>

                {/* Step 2 surfaces today's real starter questions inline so
                    the advice is immediately actionable, not abstract. */}
                {step.feature === 'daily' && starterQuestions.length > 0 && (
                  <div className="call-roadmap-questions">
                    {starterQuestions.map((q, qi) => (
                      <p key={qi} className="call-roadmap-question">“{q}”</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <button className="call-roadmap-start" onClick={onStart}>Start</button>
        <button className="call-roadmap-more" onClick={onOpenDaily}>
          Open the 📅 panel for more questions and words
        </button>
      </div>
    </div>
  );
}
