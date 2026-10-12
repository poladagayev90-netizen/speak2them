// Prints the Nano Banana job list for podcast episodes as JSON, for the AI Studio
// page queue: node scripts/podcast-image-jobs.cjs 21 22
// "H|" = cover (hosts block added on the page), "S|" = chapter scene (only the people described).
const path = require('path');
const jobs = [];
for (const n of process.argv.slice(2)) {
  const d = require(path.join(__dirname, `../content/materials/${n}.podcast.json`));
  jobs.push([`sl_${n}_cover.jpg`, `H|${d.coverPrompt}.`]);
  d.chapters.forEach((c, i) => jobs.push([`sl_${n}_ch${i + 1}.jpg`, `S|Only the people described. ${c.prompt}.`]));
}
console.log(JSON.stringify(jobs));
