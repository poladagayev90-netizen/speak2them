const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeAiPractice, syncAiPractice, recordCallPractice } = require('./practiceStats');
const at = '2026-09-07T00:00:00Z';
const report = { source:'ainur', status:'done', durationSeconds:90, timestamp:at };

test('AI totals exclude pending/failed/human reports and retain historical seconds', () => {
  const result = summarizeAiPractice([report, {...report,timestamp:'2026-08-20T12:00:00Z'}, {...report,status:'processing'}, {...report,source:'call'}, {...report,durationSeconds:-1}], Date.parse(at));
  assert.equal(result.aiPracticeSeconds,180);
  assert.equal(result.aiPracticeWeekSeconds,90);
  assert.equal(result.aiPracticeSessions,2);
});

function database() {
  const data = new Map([['users/u',{teacherId:'t'}],['teachers/t/roster/u',{lastActiveAt:{toMillis:()=>Date.parse('2026-09-10T00:00:00Z')}}]]);
  const ref = path => ({path,collection:name=>({doc:id=>ref(`${path}/${name}/${id}`)})});
  const db = { doc:ref, collection:()=>({where:()=>({query:true})}), runTransaction:async f=>f({
    get:async r=>r.query?{docs:[{data:()=>report}]}:{exists:data.has(r.path),data:()=>data.get(r.path)},
    set:(r,v,options)=>data.set(r.path,options?.merge?{...data.get(r.path),...v}:v),
  })};
  return {db,data};
}
test('retrying AI sync never adds the same report twice or moves activity backwards', async () => {
  const {db,data}=database();
  await syncAiPractice(db,'u'); await syncAiPractice(db,'u');
  assert.equal(data.get('users/u').aiPracticeSeconds,90);
  assert.equal(data.get('users/u').aiPracticeSessions,1);
  assert.equal(data.get('teachers/t/roster/u').lastActiveAt.toMillis(),Date.parse('2026-09-10T00:00:00Z'));
});
test('short calls get an immutable activity record; retries do not duplicate it', async () => {
  const {db,data}=database();
  const call={createdAt:at,endedAt:'2026-09-07T00:00:35Z',authoritativeDurationSec:35};
  await recordCallPractice(db,'c',call,'u'); await recordCallPractice(db,'c',call,'u');
  assert.equal([...data.keys()].filter(k=>k.includes('practiceSessions')).length,1);
  assert.equal(data.get('users/u').lastPracticeAt.toMillis(),Date.parse(call.endedAt));
});
