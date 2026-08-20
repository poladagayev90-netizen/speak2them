import React from 'react';
import './ui.css';

/** Number over a caption. Tabular figures so a ticking value doesn't jitter. */
export default function Stat({ value, label, icon = null, className = '', ...rest }) {
  return (
    <div className={['ui-stat', className].filter(Boolean).join(' ')} {...rest}>
      <span className="ui-stat-value">
        {icon}
        {value}
      </span>
      <span className="ui-stat-label">{label}</span>
    </div>
  );
}
