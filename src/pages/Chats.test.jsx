import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { getDoc } from 'firebase/firestore';
import Chats from './Chats';

let mockChats;
const mockNavigate = jest.fn();
jest.mock('../firebase', () => ({ db: {} }));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('firebase/firestore', () => ({ doc: (_db, collection, id) => `${collection}/${id}`, getDoc: jest.fn() }));
jest.mock('../utils/blocklist', () => ({ subscribeToBlocked: () => () => {} }));
jest.mock('../utils/presence', () => ({ getPresence: () => 'offline' }));
jest.mock('../utils/chat', () => ({
  subscribeToChats: (_uid, cb) => { mockChats = cb; return () => {}; },
  unreadFor: () => 0, chatTimeLabel: () => '',
  isAinurId: id => id === 'ainur', AINUR_PEER: { name: 'AInur' },
}));

const rows = [{ id: 'me_sabina', participants: ['me', 'sabina'], lastMessage: 'Hello' }];
beforeEach(() => { jest.clearAllMocks(); });

test('loads a profile by document ID even without a uid field and opens that conversation', async () => {
  getDoc.mockResolvedValue({ exists: () => true, data: () => ({ name: 'Sabina' }) });
  render(<Chats user={{ uid: 'me' }} />);
  await act(async () => mockChats(rows));
  expect(getDoc).toHaveBeenCalledWith('users/sabina');
  fireEvent.click(screen.getByText('Sabina'));
  expect(mockNavigate).toHaveBeenCalledWith('/chat/sabina');
});

test('a chat update during profile loading does not leave names stuck', async () => {
  const pending = [];
  getDoc.mockImplementation(() => new Promise(resolve => pending.push(resolve)));
  render(<Chats user={{ uid: 'me' }} />);
  act(() => mockChats(rows));
  act(() => mockChats([...rows]));
  await act(async () => pending.forEach(resolve => resolve({ exists: () => true, data: () => ({ name: 'Sabina' }) })));
  expect(screen.getByText('Sabina')).toBeTruthy();
  act(() => mockChats([...rows]));
  expect(screen.getByText('Sabina')).toBeTruthy();
});

test('a temporary read failure is retried on the next chat snapshot', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  getDoc.mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ exists: () => true, data: () => ({ name: 'Sabina' }) });
  render(<Chats user={{ uid: 'me' }} />);
  await act(async () => mockChats(rows));
  expect(screen.getByText('Could not load profile')).toBeTruthy();
  await act(async () => mockChats([...rows]));
  expect(screen.getByText('Sabina')).toBeTruthy();
  log.mockRestore();
});
