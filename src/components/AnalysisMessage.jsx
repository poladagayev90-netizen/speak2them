import React from 'react';
import { FileText, ChevronRight } from 'lucide-react';

/**
 * The report card that appears in a conversation when an analysis is finished.
 *
 * Lives here rather than inside Chat.jsx because two screens show it now: the
 * teacher conversation, and the AInur thread a learner without a teacher gets.
 * `isMine` is only about wording — who the report is about — and the caller
 * decides where tapping it goes, because that differs by screen.
 */
export default function AnalysisMessage({ message, isMine, onOpen }) {
  const score = Number.isFinite(message.score) ? message.score : null;
  const themes = Array.isArray(message.themes) ? message.themes.filter(Boolean) : [];

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--s-3)',
        width: '100%', textAlign: 'left', cursor: 'pointer',
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', padding: 'var(--s-3)',
        color: 'var(--text-primary)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0, width: 38, height: 38, borderRadius: 'var(--r-md)',
          background: 'var(--accent-soft)', color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <FileText size={19} strokeWidth={2} />
      </span>

      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: '14px', fontWeight: 800, marginBottom: 2 }}>
          {isMine ? 'Your session report' : 'Session report'}
          {score !== null && (
            // Bal mətnin içindədir, ayrı rəngli nişan deyil: rəng bu palitrada
            // "yaxşı/pis" demir və zəif balı qırmızı etmək qadağandır.
            <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}> · {score}/100</span>
          )}
        </span>
        <span
          style={{
            fontSize: '12px', fontWeight: 600,
            color: 'var(--text-muted)',
            // İKİ sətir, bir sətir yox. Ölçdüm: 360px ekranda bu sətrə ~224px
            // düşür, yəni ~35 simvol — "Working on: Artikllər (a / an / the)"
            // 36 simvoldur və tək sətirdə BİRİNCİ mövzunun ortasından kəsilirdi
            // ("... (a / an / th…"). Mövzu adları kartın bütün mənasıdır, ona
            // görə ikinci sətir verilir; ikidən çoxu isə söhbət axınını qırar.
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {themes.length ? `Working on: ${themes.join(', ')}` : 'Open to see the full report'}
        </span>
      </span>

      <ChevronRight size={18} strokeWidth={2} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
    </button>
  );
}
