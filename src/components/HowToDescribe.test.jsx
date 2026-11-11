import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import HowToDescribe from './HowToDescribe';

test('renders nothing when howTo is missing', () => {
  const { container } = render(<HowToDescribe howTo={null} />);
  expect(container.firstChild).toBeNull();
});

test('toggles inline steps and renders *prep* as strong and {feeling} as em', () => {
  const howTo = {
    steps: [
      'A cat is sitting *on* a wooden table *in* the kitchen.',
      'It pushes the glass *off* the edge, looking {mischievous} and {calm}.',
    ],
    useful: ['push off', 'on the edge'],
  };

  render(<HowToDescribe howTo={howTo} />);

  const btn = screen.getByRole('button', { name: /How to describe it/i });
  expect(btn.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByText(/Useful phrases/i)).toBeNull();

  fireEvent.click(btn);
  expect(btn.getAttribute('aria-expanded')).toBe('true');

  const onEl = screen.getByText('on');
  expect(onEl.tagName).toBe('STRONG');

  const feelEl = screen.getByText('mischievous');
  expect(feelEl.tagName).toBe('EM');

  expect(screen.getByText('push off')).toBeTruthy();
  expect(screen.getByText('on the edge')).toBeTruthy();

  fireEvent.click(btn);
  expect(btn.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByText(/Useful phrases/i)).toBeNull();
});
