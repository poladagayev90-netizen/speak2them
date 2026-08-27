// Guards the one invariant the grammar taxonomy depends on: the concept ids in
// functions/grammarConcepts.js (what the analysis LLM may tag, and what the
// per-user aggregate is keyed by) and src/data/grammarConcepts.js (the labels
// the progress room renders) must be the same set.
//
// Drift is quiet in both directions and neither side crashes: an id only the
// server knows renders as a bare slug, an id only the client knows never
// appears at all. Same class of invariant as functions/dailyQuestions.json vs
// src/data/weeklyContent.js.
//
//   node scripts/check_grammar_concepts.js
//
// Exits non-zero on drift so it can be dropped into CI later.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const serverIds = require(path.join(root, 'functions', 'grammarConcepts')).CONCEPT_IDS;

// The client file is an ES module, so it is read as text rather than required.
// The id charset must include digits — an earlier version of this check used
// [a-z_]+ and silently ignored `l1_transfer`, reporting drift that was not there.
const clientSrc = fs.readFileSync(path.join(root, 'src', 'data', 'grammarConcepts.js'), 'utf8');
const clientIds = [...clientSrc.matchAll(/\{\s*id:\s*'([a-z0-9_]+)'/g)].map((m) => m[1]);

const problems = [];

const serverSet = new Set(serverIds);
const clientSet = new Set(clientIds);

if (serverIds.length !== serverSet.size) problems.push('duplicate ids in functions/grammarConcepts.js');
if (clientIds.length !== clientSet.size) problems.push('duplicate ids in src/data/grammarConcepts.js');

const missingOnClient = serverIds.filter((id) => !clientSet.has(id));
const missingOnServer = clientIds.filter((id) => !serverSet.has(id));

if (missingOnClient.length) problems.push(`missing from src/data/grammarConcepts.js: ${missingOnClient.join(', ')}`);
if (missingOnServer.length) problems.push(`missing from functions/grammarConcepts.js: ${missingOnServer.join(', ')}`);

if (problems.length) {
  console.error('✗ grammar concept drift');
  for (const p of problems) console.error('  -', p);
  process.exit(1);
}

console.log(`✓ grammar concepts in sync (${serverIds.length} ids)`);
