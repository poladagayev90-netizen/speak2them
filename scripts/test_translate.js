async function testMyMemory() {
  try {
    const text = 'Polad';
    const sourceLang = 'az';
    const targetLang = 'en';
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
    
    const res = await fetch(url);
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('Translated:', data.responseData?.translatedText);
  } catch (e) {
    console.error(e);
  }
}

testMyMemory();
