import React from 'react';
import './ui.css';

/**
 * Small label chip: vocabulary keywords, CEFR levels, counts.
 *
 * `hit` is the picture-describing mechanic -- the pill turns green the moment
 * the learner actually says that word. It is a plain string match against the
 * transcript, so the feedback is instant and costs nothing.
 */
export default function Pill({ tone = 'default', hit = false, className = '', children, ...rest }) {
  const cls = [
    'ui-pill',
    tone !== 'default' ? `ui-pill--${tone}` : '',
    hit ? 'ui-pill--hit' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}
