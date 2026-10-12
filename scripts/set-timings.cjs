// Writes line start times + duration into content/materials/NN.podcast.json:
//   node scripts/set-timings.cjs NN '[0, 5.4, ...]' 139.0
// (the array is align-listening.py's output; replace a null with a time between its neighbours)
const fs = require('fs');
const path = require('path');
const [nn, atJson, dur] = process.argv.slice(2);
const f = path.join(__dirname, `../content/materials/${nn}.podcast.json`);
const d = JSON.parse(fs.readFileSync(f, 'utf8'));
const at = JSON.parse(atJson);
if (at.length !== d.lines.length || at.some((x) => typeof x !== 'number')) throw new Error(`${nn}: need ${d.lines.length} numbers`);
d.lines.forEach((l, i) => { l.at = at[i]; });
d.duration = Number(dur);
d.voices = { Leyla: 'Cleo', Sam: 'Puck', model: 'gemini-3.8-flash-tts', post: 'natural speed, loudnorm -16, mp3 128k', made: new Date().toISOString().slice(0, 10) };
fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n');
console.log(`${nn}: ${at.length} lines, ${dur}s`);
