import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { removeStudent } from '../utils/teacher';
import TeacherStudent from './TeacherStudent';

const mockListeners = {};
const mockNavigate = jest.fn();
jest.mock('../firebase', () => ({ db: {} }));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, useParams: () => ({ studentId: 'student' }) }), { virtual: true });
jest.mock('../utils/teacher', () => ({ nudgeStudent: jest.fn(), removeStudent: jest.fn(), NUDGE_RESULT_TEXT: {} }));
jest.mock('./Progress', () => ({ learnerUid }) => <div>Lab of {learnerUid}</div>);
jest.mock('../components/tutor/StudentLessons', () => () => <div>Lessons panel</div>);
jest.mock('../utils/presenceLog', () => ({
  fetchPresenceDays: () => Promise.resolve([{ date: '2026-10-07', hours: [20, 21] }, { date: '2026-10-06', hours: [] }]),
  hoursLabel: () => '20–22',
}));
jest.mock('firebase/firestore', () => ({
  doc: () => 'student',
  onSnapshot: (source, next, error) => { mockListeners[source] = {next, error}; return jest.fn(); },
}));

test('a linked student opens on their Lab, read-only, with live totals', () => {
  render(<TeacherStudent user={{uid:'teacher'}} />);
  act(() => mockListeners.student.next({exists:()=>true,data:()=>({name:'Student',teacherId:'teacher',totalMinutes:7,aiPracticeSeconds:90})}));
  expect(screen.getByText('Lab of student')).toBeTruthy();
  expect(screen.getByText('8.5')).toBeTruthy();
  act(() => mockListeners.student.next({exists:()=>true,data:()=>({name:'Student',teacherId:'teacher',totalMinutes:8,aiPracticeSeconds:90})}));
  expect(screen.getByText('9.5')).toBeTruthy();
});

test('lessons and activity are a tab away; an unlinked student shows neither', async () => {
  render(<TeacherStudent user={{uid:'teacher'}} />);
  act(() => mockListeners.student.next({exists:()=>true,data:()=>({name:'Student',teacherId:'teacher'})}));
  fireEvent.click(screen.getByRole('tab', { name: 'Lessons' }));
  expect(screen.getByText('Lessons panel')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Activity' }));
  expect(await screen.findByText('In the app on 1 of the last 14 days · hours in Baku time')).toBeTruthy();
  act(() => mockListeners.student.next({exists:()=>true,data:()=>({name:'Student',teacherId:'someone-else'})}));
  expect(screen.getByText('This student is not linked to you.')).toBeTruthy();
});

test('removal requires confirmation, cancel leaves membership intact, success returns to class', async () => {
  removeStudent.mockResolvedValue({ ok: true });
  render(<TeacherStudent user={{uid:'teacher'}} />);
  act(() => mockListeners.student.next({exists:()=>true,data:()=>({name:'Sabina',teacherId:'teacher'})}));
  fireEvent.click(screen.getByText('Remove from class'));
  expect(removeStudent).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Cancel'));
  expect(removeStudent).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Remove from class'));
  await act(async () => fireEvent.click(screen.getByText('Confirm removal')));
  expect(removeStudent).toHaveBeenCalledWith('student');
  expect(mockNavigate).toHaveBeenCalledWith('/teacher', {replace:true});
});

test('another teacher cannot see the removal control', () => {
  render(<TeacherStudent user={{uid:'other'}} />);
  act(() => mockListeners.student.next({exists:()=>true,data:()=>({name:'Sabina',teacherId:'teacher'})}));
  expect(screen.queryByText('Remove from class')).toBeNull();
});

test('a failed removal keeps the confirmation open and shows the error', async () => {
  removeStudent.mockResolvedValue({ok:false,errorText:'Network error'});
  render(<TeacherStudent user={{uid:'teacher'}} />);
  act(() => mockListeners.student.next({exists:()=>true,data:()=>({name:'Sabina',teacherId:'teacher'})}));
  fireEvent.click(screen.getByText('Remove from class'));
  await act(async () => fireEvent.click(screen.getByText('Confirm removal')));
  expect(screen.getByRole('alert').textContent).toBe('Network error');
  expect(screen.getByText('Confirm removal').disabled).toBe(false);
});
