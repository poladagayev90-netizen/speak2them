import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { removeStudent } from '../utils/teacher';
import TeacherStudent from './TeacherStudent';

const mockListeners = {};
const mockNavigate = jest.fn();
jest.mock('../firebase', () => ({ db: {} }));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, useParams: () => ({ studentId: 'student' }) }), { virtual: true });
jest.mock('../utils/teacher', () => ({ nudgeStudent: jest.fn(), removeStudent: jest.fn(), NUDGE_RESULT_TEXT: {} }));
jest.mock('./History', () => ({ AnalysisDetail: () => <div>Report detail</div> }));
jest.mock('firebase/firestore', () => ({
  doc: () => 'student', collection: () => 'analyses', query: source => source,
  where: jest.fn(), orderBy: jest.fn(), limit: jest.fn(),
  onSnapshot: (source, next, error) => { mockListeners[source] = {next, error}; return jest.fn(); },
}));

test('teacher receives live totals without adding visible AI reports twice', () => {
  render(<TeacherStudent user={{uid:'teacher'}} />);
  act(() => {
    mockListeners.student.next({exists:()=>true,data:()=>({name:'Student',totalMinutes:7,aiPracticeSeconds:90})});
    mockListeners.analyses.next({docs:[{id:'a',data:()=>({source:'ainur',durationSeconds:90,status:'processing'})}]});
  });
  expect(screen.getByText('8.5')).toBeTruthy();
  expect(screen.getByText('Analysing…')).toBeTruthy();
  act(() => mockListeners.student.next({exists:()=>true,data:()=>({name:'Student',totalMinutes:8,aiPracticeSeconds:90})}));
  expect(screen.getByText('9.5')).toBeTruthy();
});

test('a failed report query is shown as an error, not no practice', () => {
  render(<TeacherStudent user={{uid:'teacher'}} />);
  act(() => mockListeners.analyses.error({code:'unavailable'}));
  expect(screen.getByRole('alert').textContent).toContain('Could not load');
  expect(screen.queryByText('No analyses yet.')).toBeNull();
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
