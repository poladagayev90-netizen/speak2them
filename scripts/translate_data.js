const fs = require('fs');

async function translateText(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=az&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    return json[0].map(x => x[0]).join('');
  } catch(e) {
    return text;
  }
}

async function run() {
  let fileStr = fs.readFileSync('src/data/weeklyContent.js', 'utf8');
  
  if (fileStr.includes('meaningAZ')) {
    console.log('Already contains meaningAZ, skipping.');
    return;
  }
  
  const regex = /meaning:\s*"([^"]+)"/g;
  let matches = [...fileStr.matchAll(regex)];
  
  for (let i = 0; i < matches.length; i++) {
    let match = matches[i];
    let originalText = match[1];
    let translated = await translateText(originalText);
    console.log(`[${i+1}/${matches.length}] Translating: ${originalText} -> ${translated}`);
    fileStr = fileStr.replace(match[0], `meaning: "${originalText}", meaningAZ: "${translated.replace(/"/g, '\\"')}"`);
    // brief delay to avoid rate limits
    await new Promise(r => setTimeout(r, 200));
  }
  
  fs.writeFileSync('src/data/weeklyContent.js', fileStr);
  console.log("Done translating.");
}
run();
