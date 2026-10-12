// Draws a podcast episode's cover + chapter pictures with the Gemini API (Nano Banana),
// paid from the billing account the key belongs to (GDP credits) — no AI Studio tab,
// no daily playground limit:
//   node scripts/podcast-images.cjs 22 23            (all four pictures)
//   node scripts/podcast-images.cjs 21:ch2           (one picture again)
// Writes ~/Downloads/sl_NN_{cover,ch1,ch2,ch3}.jpg, then: bash scripts/ingest-materials.sh NN
// Key: GEMINI_API_KEY in .env. Style reference: the previous episode's cover.webp.
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MODEL = process.env.IMAGE_MODEL || 'gemini-nano-banana-2.1';
const KEY = (fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m) || [])[1]?.replace(/["\r\s]/g, '');
if (!KEY) throw new Error('GEMINI_API_KEY missing in .env');

const STYLE = 'Same style as the attached picture (flat warm editorial vector, warm peach and lavender, soft grain, no neon, no outlines), no text, no letters, no logos. ';
const HOSTS = 'Hosts: Leyla, an Azerbaijani woman with long dark wavy hair, round glasses and a lavender sweater; Sam, a British man with short ginger hair, a ginger beard and a denim shirt over a white T-shirt; podcast studio desk with two microphones. ';
const LEYLA = 'Any woman with round glasses here is Leyla: long dark wavy hair, round glasses, lavender sweater. Any red-haired bearded man is Sam: short ginger hair, ginger beard, denim shirt. ';

function reference(nn) {
  for (let n = Number(nn) - 1; n > 0; n -= 1) {
    const f = path.join(ROOT, `content/materials/${String(n).padStart(2, '0')}/cover.webp`);
    if (fs.existsSync(f)) return f;
  }
  throw new Error('no reference cover');
}

async function draw(prompt, refFile) {
  const body = {
    contents: [{ role: 'user', parts: [
      { inline_data: { mime_type: 'image/webp', data: fs.readFileSync(refFile).toString('base64') } },
      { text: prompt },
    ] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } },
  };
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, body: JSON.stringify(body),
    });
    const j = await res.json();
    const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData || p.inline_data);
    if (part) {
      const d = part.inlineData || part.inline_data;
      return { buf: Buffer.from(d.data, 'base64'), mime: d.mimeType || d.mime_type, usage: j.usageMetadata };
    }
    console.warn(`  attempt ${attempt}: ${res.status} ${JSON.stringify(j.error || j.candidates?.[0]?.finishReason || j).slice(0, 200)}`);
    await new Promise((r) => setTimeout(r, 5000 * attempt));
  }
  throw new Error('no image');
}

(async () => {
  for (const arg of process.argv.slice(2)) {
    const [nn, only] = arg.split(':');
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, `content/materials/${nn}.podcast.json`), 'utf8'));
    const jobs = [['cover', STYLE + HOSTS + d.coverPrompt + '.']];
    d.chapters.forEach((c, i) => jobs.push([`ch${i + 1}`, `${STYLE}${LEYLA}Only the people described. ${c.prompt}.`]));
    const ref = reference(nn);
    for (const [name, prompt] of jobs) {
      if (only && only !== name) continue;
      const { buf, mime, usage } = await draw(prompt, ref);
      const out = path.join(os.homedir(), 'Downloads', `sl_${nn}_${name}.${/png/.test(mime) ? 'png' : 'jpg'}`);
      fs.writeFileSync(out, buf);
      console.log(`${nn} ${name}: ${(buf.length / 1024) | 0} KB ${mime} tokens=${usage?.totalTokenCount ?? '?'}`);
    }
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
