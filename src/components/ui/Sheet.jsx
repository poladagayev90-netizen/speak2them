import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Button from './Button';
import './ui.css';

/**
 * One bottom sheet / modal for the whole app. Replaces .dt-overlay,
 * .streak-overlay, .journey-overlay, .settings-panel and .daily-panel, which
 * had five different z-indexes, five animations and three close behaviours.
 *
 * Layout is header / scrolling body / pinned footer. That split is deliberate:
 * the Debate panel used to grow past the viewport on a 320px screen and put its
 * "next topic" button 49px below the fold with no way to scroll to it. Here the
 * body is the only part that scrolls, so a footer action is always reachable.
 */
export default function Sheet({
  open,
  onClose,
  title = null,
  footer = null,
  center = false,
  showGrip = true,
  labelledBy,
  children,
}) {
  const panelRef = useRef(null);
  const restoreFocusRef = useRef(null);

  // Escape closes, and the body stops scrolling behind the sheet. Both are
  // restored on unmount even if the caller unmounts us abruptly.
  useEffect(() => {
    if (!open) return undefined;

    restoreFocusRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);

    // Move focus into the sheet so a screen reader lands here and Escape works
    // without the user tabbing first.
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === 'function') el.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const titleId = labelledBy || (title ? 'ui-sheet-title' : undefined);

  return (
    <div
      className={`ui-sheet-backdrop${center ? ' ui-sheet-backdrop--center' : ''}`}
      // Only a click that starts AND ends on the backdrop closes -- otherwise a
      // text selection that drags out of the panel dismisses the sheet.
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`ui-sheet${center ? ' ui-sheet--center' : ''}`}
      >
        {showGrip && !center && <div className="ui-sheet-grip" aria-hidden="true" />}

        {(title || onClose) && (
          <div className="ui-sheet-head">
            {title ? <h2 id={titleId} className="ui-sheet-title">{title}</h2> : <span />}
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label="Close"
                onClick={onClose}
                icon={<X size={20} strokeWidth={1.75} />}
              />
            )}
          </div>
        )}

        <div className="ui-sheet-body">{children}</div>

        {footer && <div className="ui-sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}
