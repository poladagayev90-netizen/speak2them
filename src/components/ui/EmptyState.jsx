import React from 'react';
import './ui.css';

/**
 * What a screen shows before there is anything on it.
 *
 * An empty screen is the one a NEW learner always sees first, so it has to say
 * what to do, not only what is missing: "No conversations yet." on its own is
 * a dead end. Pass the next step as children (one or two Buttons).
 */
export default function EmptyState({ icon, title, text, children, className = '' }) {
  return (
    <div className={['ui-empty', className].filter(Boolean).join(' ')}>
      {icon && <div className="ui-empty-icon" aria-hidden="true">{icon}</div>}
      <p className="ui-empty-title">{title}</p>
      {text && <p className="ui-empty-text">{text}</p>}
      {children && <div className="ui-empty-actions">{children}</div>}
    </div>
  );
}
