// Records a podcast episode with the Gemini API (two speakers: Leyla = Cleo, Sam = Puck),
// paid from the billing account the key belongs to — no AI Studio tab:
//   node scripts/podcast-tts.cjs 31 [32 …]
// Writes ~/Downloads/sl_epNN.wav, then: bash scripts/ingest-materials.sh NN → align → set-timings.
// TEST=1 records only the first two lines (to compare the voices with the AI Studio ones).
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MODEL = process.env.TTS_MODEL || 'gemini-3.8-flash-tts';
const KEY = (fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m) || [])[1]?.replace(/["\r\s]/g, '');
if (!KEY) throw new Error('GEMINI_API_KEY missing in .env');

// The API returns raw 16-bit mono PCM; wrap it in a WAV header.
function wav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

(async () => {
  for (const nn of process.argv.slice(2)) {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, `content/materials/${nn}.podcast.json`), 'utf8'));
    // The same text the AI Studio page got: check-podcast's tts-lines.json ([laugh] → <laugh>).
    const tts = JSON.parse(fs.readFileSync(path.join(ROOT, `content/materials/${nn}/tts-lines.json`), 'utf8'));
    const lines = d.lines.map((l, i) => ({ s: l.s, t: tts[i] })).slice(0, process.env.TEST ? 2 : undefined);
    const body = {
      // Multi-speaker requests name the speaker on every text part.
      contents: [{ parts: lines.map((l) => ({ text: l.t, speechMetadata: { speaker: l.s } })) }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { multiSpeakerVoiceConfig: { speakerVoiceConfigs: [
          { speaker: 'Leyla', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Cleo' } } },
          { speaker: 'Sam', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
        ] } },
      },
    };
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, body: JSON.stringify(body),
    });
    const j = await res.json();
    const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData || p.inline_data);
    if (!part) throw new Error(`${nn}: ${res.status} ${JSON.stringify(j.error || j).slice(0, 300)}`);
    const dd = part.inlineData || part.inline_data;
    const rate = Number(/rate=(\d+)/.exec(dd.mimeType || dd.mime_type || '')?.[1] || 24000);
    const out = path.join(os.homedir(), 'Downloads', `sl_ep${nn}${process.env.TEST ? '_test' : ''}.wav`);
    const pcm = Buffer.from(dd.data, 'base64');
    fs.writeFileSync(out, wav(pcm, rate));
    console.log(`${nn}: ${(pcm.length / 2 / rate).toFixed(1)} s → ${out}`);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
