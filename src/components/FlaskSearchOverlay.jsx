import React from 'react';

// Laboratory-themed waiting animation: a bubbling flask, pure CSS/SVG —
// no external assets. Used fullscreen during on-demand partner search and
// inline (fullscreen=false) inside the session waiting card.
function FlaskAnimation({ size = 140 }) {
  return (
    <div className="flask-swing" style={{ width: size, height: size * 1.15 }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 140 160"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <clipPath id="flask-liquid-clip">
            <path d="M58 6 h24 v14 l-2 40 34 76 a10 10 0 0 1 -9 16 h-70 a10 10 0 0 1 -9 -16 l34 -76 -2 -40 z" />
          </clipPath>
        </defs>

        <g clipPath="url(#flask-liquid-clip)">
          <rect className="flask-liquid" x="0" y="104" width="140" height="56" fill="#7c6ff7" />
          <circle className="flask-bubble flask-b1" cx="55" cy="150" r="5" fill="#c7c1ff" />
          <circle className="flask-bubble flask-b2" cx="72" cy="152" r="4" fill="#e4e1ff" />
          <circle className="flask-bubble flask-b3" cx="88" cy="149" r="6" fill="#b3aaff" />
        </g>

        <path
          d="M58 6 h24 v14 l-2 40 34 76 a10 10 0 0 1 -9 16 h-70 a10 10 0 0 1 -9 -16 l34 -76 -2 -40 z"
          stroke="#7c6ff7"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <line x1="52" y1="6" x2="88" y2="6" stroke="#7c6ff7" strokeWidth="5" strokeLinecap="round" />
      </svg>

      <style>{`
        .flask-swing {
          margin: 0 auto;
          animation: flaskSwing 2.6s ease-in-out infinite;
          transform-origin: 50% 90%;
        }
        .flask-liquid {
          opacity: 0.85;
          animation: flaskLiquid 2.6s ease-in-out infinite;
        }
        .flask-bubble {
          opacity: 0;
          animation: flaskBubble 2.2s ease-in infinite;
        }
        .flask-b2 { animation-delay: 0.7s; }
        .flask-b3 { animation-delay: 1.3s; }
        @keyframes flaskSwing {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }
        @keyframes flaskLiquid {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes flaskBubble {
          0% { transform: translateY(0); opacity: 0; }
          20% { opacity: 0.9; }
          100% { transform: translateY(-42px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default function FlaskSearchOverlay({
  visible = true,
  fullscreen = true,
  title,
  subtitle,
  onCancel,
  cancelLabel = 'Ləğv et',
}) {
  if (!visible) return null;

  if (!fullscreen) {
    return (
      <div style={{ textAlign: 'center' }}>
        <FlaskAnimation size={80} />
        {title && (
          <p style={{ color: '#7c6ff7', fontWeight: 700, fontSize: '14px', margin: '8px 0 0' }}>
            {title}
          </p>
        )}
        {subtitle && (
          <p style={{ color: '#666', fontSize: '12px', margin: '4px 0 0' }}>{subtitle}</p>
        )}
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(10, 10, 20, 0.92)',
      backdropFilter: 'blur(6px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <FlaskAnimation size={140} />
      {title && (
        <p style={{ color: '#fff', fontWeight: 800, fontSize: '20px', margin: '20px 0 0', textAlign: 'center' }}>
          {title}
        </p>
      )}
      {subtitle && (
        <p style={{ color: '#a1a1aa', fontSize: '14px', margin: '10px 0 0', textAlign: 'center', maxWidth: 320 }}>
          {subtitle}
        </p>
      )}
      {onCancel && (
        <button
          onClick={onCancel}
          style={{
            marginTop: 28, background: 'transparent', color: '#ef4444',
            border: '1px solid #ef444466', borderRadius: 12,
            padding: '12px 32px', fontWeight: 700, fontSize: 15, cursor: 'pointer',
          }}
        >
          {cancelLabel}
        </button>
      )}
    </div>
  );
}
