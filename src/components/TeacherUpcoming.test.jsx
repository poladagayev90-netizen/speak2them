import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TeacherUpcoming from './TeacherUpcoming';
import { cancelSlotMatch } from '../utils/teacher';
jest.mock('../utils/teacher', () => ({ cancelSlotMatch: jest.fn() }));
jest.mock('../utils/practiceSlots', () => ({
  parseSlotId: id => id ? { date: '2026-09-12', hour: 14, startMs: Date.now() + 3600000, endMs: id === 'past' ? 0 : Date.now() + 7200000 } : null,
  dayLabel: () => '12 Sep', blockLabel: () => '14:00–16:00',
}));
const pair = [
 {id:'a',displayName:'Sabina',upcomingCall:{slotId:'future',peerUid:'b',peerName:'Nisa'}},
 {id:'b',displayName:'Nisa',upcomingCall:{slotId:'future',peerUid:'a',peerName:'Sabina'}},
];
beforeEach(() => jest.clearAllMocks());
test('a new call appears from live profiles without the roster IDs changing, once per pair', () => {
 const {rerender} = render(<TeacherUpcoming students={pair.map(s=>({...s,upcomingCall:null}))} />);
 expect(screen.getByText(/No scheduled calls/)).toBeTruthy();
 rerender(<TeacherUpcoming students={pair} />);
 expect(screen.getByText('Sabina ↔ Nisa')).toBeTruthy();
 expect(screen.getAllByText('Cancel call')).toHaveLength(1);
});
test('cancellation requires confirmation and success remains visible after the last call disappears', async () => {
 cancelSlotMatch.mockResolvedValue({ok:true});
 const {rerender} = render(<TeacherUpcoming students={pair} />);
 fireEvent.click(screen.getByText('Cancel call'));
 expect(cancelSlotMatch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByText('Keep call'));
 expect(cancelSlotMatch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByText('Cancel call'));
 await act(async () => fireEvent.click(screen.getByText('Confirm cancellation')));
 expect(cancelSlotMatch).toHaveBeenCalledWith('future','a');
 rerender(<TeacherUpcoming students={[]} />);
 expect(screen.getByRole('status').textContent).toContain('pairing was cancelled');
 expect(screen.getByText(/No scheduled calls/)).toBeTruthy();
});
test('failed cancellation keeps the call and enables retry', async () => {
 cancelSlotMatch.mockResolvedValue({ok:false,errorText:'Connection failed'});
 render(<TeacherUpcoming students={pair} />);
 fireEvent.click(screen.getByText('Cancel call'));
 await act(async () => fireEvent.click(screen.getByText('Confirm cancellation')));
 expect(screen.getByRole('alert').textContent).toBe('Connection failed');
 expect(screen.getByText('Confirm cancellation').disabled).toBe(false);
 expect(screen.getByText('Sabina ↔ Nisa')).toBeTruthy();
});
test('loading and read errors are visible instead of a hidden panel', () => {
 const {rerender} = render(<TeacherUpcoming students={[]} loading />);
 expect(screen.getByRole('status').textContent).toContain('Loading');
 rerender(<TeacherUpcoming students={[]} error="Could not refresh calls" />);
 expect(screen.getByRole('alert').textContent).toContain('Could not refresh calls');
 expect(screen.queryByText(/No scheduled calls/)).toBeNull();
});
test('expired blocks are not shown', () => {
 render(<TeacherUpcoming students={[{...pair[0],upcomingCall:{...pair[0].upcomingCall,slotId:'past'}}]} />);
 expect(screen.queryByText('Cancel call')).toBeNull();
});
