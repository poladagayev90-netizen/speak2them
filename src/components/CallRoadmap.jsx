import React from 'react';

// Conversation roadmap shown to both peers the moment a call connects, so
// nobody sits in silence wondering what to talk about. It now doubles as a
// short "how to start talking" guide (5 steps), while still surfacing the
// shared daily topic + starter questions. The 📅 panel carries the full
// question/vocab set for anyone who wants more.

const STEPS = [
  {
    label: 'Tanışlıqla başlayın',
    text: 'Adınızı, haradan olduğunuzu və niyə ingiliscə öyrəndiyinizi qısaca bölüşün. Bu, ilk gərginliyi aradan qaldırır və söhbətə rahat giriş verir.',
  },
  {
    label: 'Hazır mövzu suallarından istifadə edin',
    text: '"Günün Mövzusu" bölməsindəki suallar söhbəti fasiləsiz irəli aparır — nə deyəcəyinizi düşünməyə vaxt itirmirsiniz.',
    feature: 'daily',
  },
  {
    label: 'Gördüklərinizi təsvir edin',
    text: 'Ekranda göstərilən şəkli mümkün qədər detallı izah etməyə çalışın. Bu, lüğətinizi canlı şəkildə işlətməyin ən effektiv yoludur.',
  },
  {
    label: 'Öz mövzunuzu seçin',
    text: 'Hazır suallar məcburi deyil — istədiyiniz istiqamətə yönələ, tamamilə sərbəst danışa bilərsiniz. Məqsəd nitqi davam etdirməkdir.',
  },
  {
    label: 'Tabu oyunu ilə sınayın',
    text: 'Sözü demədən izah etmə oyunu — danışıq qorxusunu əyləncə vasitəsilə aradan qaldırmağın ən effektiv yoludur.',
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
          aria-label="Bələdçini keç və zəngə başla"
        >
          Keç ✕
        </button>

        <p className="call-roadmap-label">🗺️ Zəng bələdçisi</p>
        <h2 className="call-roadmap-title">Danışığa Necə Başlamaq Olar?</h2>

        {content.topic && (
          <div className="call-roadmap-topic-pill">
            Bugünün mövzusu · <b>{content.topic}</b>
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

        <button className="call-roadmap-start" onClick={onStart}>Başla 🎙️</button>
        <button className="call-roadmap-more" onClick={onOpenDaily}>
          Daha çox sual və söz üçün 📅 panelini aç
        </button>
      </div>
    </div>
  );
}
