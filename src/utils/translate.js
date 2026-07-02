export async function translateText(text, sourceLang = 'az', targetLang = 'en') {
  if (!text || !text.trim()) return null;

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text.trim())}`;
    
    const response = await fetch(url);

    if (!response.ok) throw new Error('Translation failed: ' + response.status);

    const data = await response.json();
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      return data[0][0][0];
    }
    return null;
  } catch (error) {
    console.error('[Translate] Error:', error);
    return null;
  }
}
