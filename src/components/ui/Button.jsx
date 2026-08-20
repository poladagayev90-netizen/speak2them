import React from 'react';
import './ui.css';

/**
 * The app's one button. Replaces .btn-primary / .btn-chat / .btn-random /
 * .call-btn-big / FOOT_BTN / GHOST_BTN / SOLID_BTN and the handful of inline
 * `<button style={{...}}>` recipes that had drifted apart.
 *
 * variant 'ai' is not decoration -- cyan means "this talks to AInur" the same
 * way violet means "this talks to a person". See the token block in index.css.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  full = false,
  icon = null,
  iconRight = null,
  iconOnly = false,
  as: Tag = 'button',
  className = '',
  children,
  ...rest
}) {
  const cls = [
    'ui-btn',
    `ui-btn--${variant}`,
    `ui-btn--${size}`,
    full ? 'ui-btn--full' : '',
    iconOnly ? 'ui-btn--icon' : '',
    className,
  ].filter(Boolean).join(' ');

  // type="button" by default: a bare <button> inside a form submits it, which
  // has bitten this codebase before on the auth screens.
  const typeProp = Tag === 'button' ? { type: rest.type || 'button' } : {};

  return (
    <Tag className={cls} {...typeProp} {...rest}>
      {icon}
      {!iconOnly && children}
      {!iconOnly && iconRight}
    </Tag>
  );
}
