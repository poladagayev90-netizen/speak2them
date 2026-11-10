import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AddToCalendar from './AddToCalendar';

jest.mock('../../nativePush', () => ({ isNativePush: () => false }));

test('opens Google Calendar and .ics choices for the booking', () => {
  render(<AddToCalendar booking={{ id: 'b1', startMs: Date.UTC(2026, 10, 12, 14, 0) }} peerName="Aysel" />);
  expect(screen.queryByText('Google Calendar')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /add to calendar/i }));
  const google = screen.getByRole('link', { name: /google calendar/i });
  expect(google.getAttribute('href')).toContain('dates=20261112T140000Z%2F20261112T143000Z');
  expect(google.getAttribute('target')).toBe('_blank');
  expect(screen.getByRole('button', { name: /\.ics/ })).toBeTruthy();
});
