// Rebuild derived AI totals and archive the surviving call records.
// Dry-run by default. Does not send messages, replay analysis, or change old call totals.
const path = require('path');
const fs = require('fs');
const { firestoreRest } = require('./firestore-rest.cjs');
const { syncAiPractice, recordCallPractice } = require('../functions/practiceStats');

async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE, '.config/configstore/firebase-tools.json'), 'utf8'));
  const cli = require(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/auth.js'));
  const token = await cli.getAccessToken(config.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
  const db = firestoreRest(token.access_token, 'speak2them-64f2b');
  const reports = await db.collection('callAnalysis').where('source','==','ainur').get();
  const uids = [...new Set(reports.docs.map(d=>d.data().userId).filter(Boolean))];
  const calls = await db.collection('calls').where('status','==','ended').get();
  console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'dry-run',aiLearners:uids.length,survivingCalls:calls.size}));
  if (!process.argv.includes('--apply')) return;
  for (const uid of uids) await syncAiPractice(db,uid);
  let recorded = 0;
  for (const d of calls.docs) {
    const call = d.data();
    for (const uid of [...new Set([call.userA,call.userB,call.callerId,call.receiverId].filter(Boolean))].slice(0,2)) {
      await recordCallPractice(db,d.id,call,uid);
      recorded++;
    }
  }
  console.log(JSON.stringify({aiLearnersRebuilt:uids.length,callParticipantsChecked:recorded}));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
