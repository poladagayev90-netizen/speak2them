import React, { useState } from 'react';
import { MessageSquareQuote } from 'lucide-react';
import { describeFrames } from '../data/describeFrames';

// Şəkil təsviri üçün danışıq qəlibləri paneli. İki yerdə işlənir:
//   - PictureDescribing (tam ekran, məşq rejimi) → compact=false, açıq gəlir
//   - CallImageStage (zəng içi kart, yer azdır)  → compact=true, yığılı gəlir
//
// NİYƏ QRUP SEÇİCİSİ VAR: 20 qəlibi birdən göstərmək ekranı doldurur və şagird
// nəyi seçəcəyini bilmir. Dörd qrup danışığın təbii ardıcıllığıdır (gör → yerləş
// → təxmin et → fikir bildir), ona görə eyni anda yalnız bir addım göstərilir.
export default function DescribeFrames({ compact = false, prompts = [] }) {
  const [openGroup, setOpenGroup] = useState(describeFrames[0].id);
  // Zəng içində yer azdır — istifadəçi özü açana qədər yalnız başlıq görünür.
  const [expanded, setExpanded] = useState(!compact);

  const active = describeFrames.find((g) => g.id === openGroup) || describeFrames[0];

  return (
    <div style={{ padding: compact ? '4px 16px 0' : '0 20px 8px' }}>
      {/* Bu, ekranda BASILA BİLƏN yeganə şeydir, ona görə düymə kimi görünməlidir:
          səthi, kənarı və basılma reaksiyası var. Əvvəl fon/kənarsız, kiçik boz
          böyük-hərf yazı idi — başlıq kimi oxunurdu, heç kim ona toxunmurdu. */}
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: expanded ? 'var(--accent-soft)' : 'var(--bg-secondary)',
          border: `1px solid ${expanded ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 12,
          padding: compact ? '9px 12px' : '11px 14px',
          color: expanded ? 'var(--accent)' : 'var(--text-primary)',
          fontSize: compact ? 13 : 14,
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.15s, border-color 0.15s, color 0.15s',
        }}
      >
        <MessageSquareQuote size={15} strokeWidth={1.75} aria-hidden="true" />
        Sentence starters
        <span
          aria-hidden="true"
          style={{
            marginLeft: 'auto', fontSize: 11, opacity: 0.75,
            transform: expanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.15s',
          }}
        >
          ▶
        </span>
      </button>

      {expanded && (
        <>
          {/* Qrup seçicisi — eyni anda yalnız bir addımın qəlibləri açıqdır. */}
          <div style={{
            display: 'flex', gap: 6, overflowX: 'auto',
            marginTop: 10, paddingBottom: 6,
            scrollbarWidth: 'none',
          }}>
            {describeFrames.map((g) => {
              const on = g.id === active.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setOpenGroup(g.id)}
                  style={{
                    flexShrink: 0,
                    background: on ? 'var(--accent-soft)' : 'transparent',
                    color: on ? 'var(--accent)' : 'var(--text-secondary)',
                    border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 14, padding: '4px 10px',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {g.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {active.frames.map((f) => (
              <span
                key={f}
                style={{
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8, padding: '5px 10px',
                  fontSize: compact ? 12 : 13, fontWeight: 500,
                }}
              >
                {f}
              </span>
            ))}
          </div>

          {/* Şəklə ÖZƏL suallar — qəliblərdən fərqli olaraq bunlar hər kadrda
              dəyişir, ona görə ayrıca və vizual olaraq fərqli göstərilir. */}
          {prompts.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={{
                color: 'var(--text-secondary)', fontSize: 11, margin: '0 0 6px',
                textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                For this picture
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {prompts.map((p, i) => (
                  <p key={i} style={{
                    margin: 0, fontSize: compact ? 12 : 13,
                    color: 'var(--text-primary)', lineHeight: 1.45,
                  }}>
                    • {p}
                  </p>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
