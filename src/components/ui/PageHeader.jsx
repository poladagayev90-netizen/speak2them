import React from 'react';
import { ChevronLeft } from 'lucide-react';
import './ui.css';

/**
 * The top of a page: one title style for every screen.
 *
 * Lessons and Live each hand-rolled the same --fs-h1 heading, while Chats used
 * a small accent-coloured logo line and History a centred 20px title — three
 * looks for the same job. This is the Lessons/Live one, shared.
 *
 * `onBack` adds a back chevron for pages reached from another page (History
 * from Profile); tab pages leave it out. `right` holds one small control, like
 * the leaderboard's week/all-time switch.
 */
export default function PageHeader({ title, subtitle, onBack, right, className = '' }) {
  return (
    <header className={['ui-page-head', className].filter(Boolean).join(' ')}>
      {onBack && (
        <button type="button" className="ui-page-back" onClick={onBack} aria-label="Back">
          <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
      <div className="ui-page-head-text">
        <h1 className="ui-page-title">{title}</h1>
        {subtitle && <p className="ui-page-sub">{subtitle}</p>}
      </div>
      {right && <div className="ui-page-head-right">{right}</div>}
    </header>
  );
}
