// Loads src/data/topicMaterials/NN.json (NN = the topic's `day`). Each file is its
// own lazy chunk, so the sheet fetches only the topic it shows and the main bundle
// does not grow with the 60 topics. Kept apart from utils/topicMaterials.js because
// require.context exists only under webpack (the helpers there are Jest-tested).
const ctx = require.context('../data/topicMaterials', false, /^\.\/\d\d\.json$/, 'lazy');
const keys = new Set(ctx.keys());

const fileOf = (day) => `./${String(day).padStart(2, '0')}.json`;

export function hasMaterials(day) {
  return keys.has(fileOf(day));
}

export async function loadMaterials(day) {
  if (!hasMaterials(day)) return null;
  const mod = await ctx(fileOf(day));
  return mod.default || mod;
}
