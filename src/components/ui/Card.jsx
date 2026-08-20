import React from 'react';
import './ui.css';

/**
 * Surface primitive. `tone` carries the AI-vs-person signal (cyan ring for
 * AInur, violet ring for a real partner); default is a plain surface.
 *
 * Passing onClick renders a real <button> rather than a clickable <div>, so it
 * is keyboard reachable and announces itself correctly.
 */
export default function Card({
  tone = 'default',
  padding = 'md',
  onClick,
  as,
  className = '',
  children,
  ...rest
}) {
  const interactive = typeof onClick === 'function';
  const Tag = as || (interactive ? 'button' : 'div');

  const cls = [
    'ui-card',
    tone !== 'default' ? `ui-card--${tone}` : '',
    padding !== 'none' ? `ui-card--pad-${padding}` : '',
    interactive ? 'ui-card--interactive' : '',
    className,
  ].filter(Boolean).join(' ');

  const typeProp = Tag === 'button' ? { type: 'button' } : {};

  return (
    <Tag className={cls} onClick={onClick} {...typeProp} {...rest}>
      {children}
    </Tag>
  );
}
