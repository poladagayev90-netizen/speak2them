const {test} = require('node:test');
const assert = require('node:assert/strict');
const {removeStudent} = require('./removeStudent');
function fixture(teacherId='teacher', count=2) {
 const docs = new Map([['users/student',{teacherId,name:'Sabina',totalMinutes:20}],['teachers/teacher',{studentCount:count}],['users/teacher',{tutorStudentCount:count}],['teachers/teacher/roster/student',{status:'active'}]]);
 const ref = path => ({path,collection:key=>({doc:id=>ref(`${path}/${key}/${id}`)})});
 const tx = {get:async r=>({exists:docs.has(r.path),data:()=>docs.get(r.path)}),set:(r,v)=>docs.set(r.path,{...docs.get(r.path),...v}),update:(r,v)=>{const data={...docs.get(r.path),...v}; for(const k in data) if(data[k]==='DELETE') delete data[k]; docs.set(r.path,data);}};
 return {docs,db:{collection:key=>({doc:id=>ref(`${key}/${id}`)}),runTransaction:fn=>fn(tx)}};
}
const fields={delete:()=> 'DELETE',serverTimestamp:()=>123};
test('removes only membership and decrements counts once across retries',async()=>{
 const {db,docs}=fixture();
 await removeStudent(db,fields,'teacher','student');
 await removeStudent(db,fields,'teacher','student');
 assert.equal(docs.get('users/student').teacherId,undefined);
 assert.equal(docs.get('users/student').totalMinutes,20);
 assert.equal(docs.get('teachers/teacher').studentCount,1);
 assert.equal(docs.get('users/teacher').tutorStudentCount,1);
 assert.equal(docs.get('teachers/teacher/roster/student').status,'removed');
});
test('rejects another teacher without changing the student',async()=>{
 const {db,docs}=fixture('other');
 await assert.rejects(removeStudent(db,fields,'teacher','student'),{httpStatus:403});
 assert.equal(docs.get('users/student').teacherId,'other');
});
test('counts never become negative',async()=>{
 const {db,docs}=fixture('teacher',0);
 await removeStudent(db,fields,'teacher','student');
 assert.equal(docs.get('teachers/teacher').studentCount,0);
});
test('invalid document paths are rejected',async()=>{
 const {db}=fixture();
 await assert.rejects(removeStudent(db,fields,'teacher','bad/id'),{httpStatus:400});
});
