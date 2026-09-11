import React from 'react';
import { render, screen } from '@testing-library/react';
import MessageTimestamp from './MessageTimestamp';

test('shows the full local date and 24-hour send time with a machine-readable timestamp', () => {
  const date = new Date(2026, 8, 11, 9, 5);
  render(<MessageTimestamp createdAt={date} />);
  expect(screen.getByText('11.09.2026 · 09:05').getAttribute('datetime')).toBe(date.toISOString());
});

test('supports report timestamps from Firestore', () => {
  render(<MessageTimestamp createdAt={{ toDate: () => new Date(2025, 11, 31, 23, 59) }} />);
  expect(screen.getByText('31.12.2025 · 23:59')).toBeTruthy();
});

test('distinguishes pending messages from missing historical dates', () => {
  const { rerender } = render(<MessageTimestamp pending />);
  expect(screen.getByText('Sending…')).toBeTruthy();
  rerender(<MessageTimestamp createdAt={new Date('invalid')} />);
  expect(screen.getByText('Date unavailable')).toBeTruthy();
});
