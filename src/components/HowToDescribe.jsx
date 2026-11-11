import React, { useState } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';

function renderMarkedStep(text) {
  const parts = String(text).split(/(\*[^*]+\*|\{[^}]+\})/g);
  return parts.map((part, idx) => {
    if (!part) return null;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <strong
          key={idx}
          style={{
            color: 'var(--accent)',
            fontWeight: 700,
          }}
        >
          {part.slice(1, -1)}
        </strong>
      );
    }
    if (part.startsWith('{') && part.endsWith('}') && part.length > 2) {
      return (
        <em
          key={idx}
          style={{
            fontStyle: 'italic',
            textDecorationLine: 'underline',
            textDecorationColor: 'var(--coral)',
            textDecorationThickness: '2px',
            textUnderlineOffset: '3px',
          }}
        >
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

export default function HowToDescribe({ howTo, compact = false, style }) {
  const [open, setOpen] = useState(false);

  if (!howTo || !Array.isArray(howTo.steps) || howTo.steps.length === 0) {
    return null;
  }

  const useful = Array.isArray(howTo.useful) ? howTo.useful.filter(Boolean) : [];

  return (
    <div style={{ padding: compact ? '6px 16px 2px' : '0', ...style }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--s-2)',
          width: '100%',
          background: open ? 'var(--accent-soft)' : 'var(--bg-secondary)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--r-md)',
          padding: compact ? '9px 12px' : '11px 14px',
          color: open ? 'var(--accent)' : 'var(--text-primary)',
          fontSize: compact ? 'var(--fs-xs)' : 'var(--fs-sm)',
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.15s, border-color 0.15s, color 0.15s',
        }}
      >
        <BookOpen size={15} strokeWidth={1.9} aria-hidden="true" />
        <span>How to describe it</span>
        <ChevronRight
          size={15}
          strokeWidth={2}
          aria-hidden="true"
          style={{
            marginLeft: 'auto',
            opacity: 0.75,
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.15s',
          }}
        />
      </button>

      {open && (
        <div
          style={{
            marginTop: 'var(--s-2)',
            padding: compact ? '10px 12px' : '12px 14px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--s-2)',
          }}
        >
          <ol
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--s-2)',
            }}
          >
            {howTo.steps.map((step, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 'var(--s-2)',
                  fontSize: compact ? 'var(--fs-xs)' : 'var(--fs-sm)',
                  lineHeight: 'var(--lh-body)',
                  color: 'var(--text-primary)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 800,
                    color: 'var(--accent)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {i + 1}.
                </span>
                <span>{renderMarkedStep(step)}</span>
              </li>
            ))}
          </ol>

          {useful.length > 0 && (
            <div style={{ marginTop: 'var(--s-1)' }}>
              <p
                style={{
                  margin: '0 0 6px',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Useful phrases
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {useful.map((phrase) => (
                  <span
                    key={phrase}
                    style={{
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-sm)',
                      padding: '4px 10px',
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 600,
                    }}
                  >
                    {phrase}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
