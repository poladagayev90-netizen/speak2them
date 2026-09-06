import { commitMatch } from './matchmaking';
const mockData = new Map();
jest.mock('../firebase', () => ({db:{}}));
jest.mock('firebase/firestore', () => ({
  doc: (_db,collection,id) => `${collection}/${id}`,
  serverTimestamp: () => 'new-time',
  runTransaction: async (_db, fn) => fn({
    get: async ref => ({exists:()=>mockData.has(ref),data:()=>mockData.get(ref)}),
    set: (ref, data, options) => mockData.set(ref,options?.merge?{...mockData.get(ref),...data}:data),
    update: (ref, data) => mockData.set(ref,{...mockData.get(ref),...data}),
  }),
}));

test('matching the same pair starts fresh instead of reusing their credited duration', async () => {
  mockData.set('matchQueue/a',{status:'searching'});
  mockData.set('matchQueue/b',{status:'searching'});
  mockData.set('calls/call_a_b',{status:'ended',authoritativeDurationSec:35,statsApplied_a:true,minutesBilled_a:true});
  await commitMatch('a','b');
  const call=mockData.get('calls/call_a_b');
  expect(call.status).toBe('accepted');
  expect(call.statsApplied_a).toBeUndefined();
  expect(call.minutesBilled_a).toBeUndefined();
  expect(call.authoritativeDurationSec).toBeUndefined();
  expect(mockData.get('matchQueue/b').callId).toBe('call_a_b');
});
