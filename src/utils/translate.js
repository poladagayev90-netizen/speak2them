export async function translateText(text, sourceLang = 'az', targetLang = 'en') {
  if (!text || !text.trim()) return null;

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.trim())}&langpair=${sourceLang}|${targetLang}`;
    
    const response = await fetch(url);

    if (!response.ok) throw new Error('Translation failed: ' + response.status);

    const data = await response.json();
    if (data && data.responseData && data.responseData.translatedText) {
      return data.responseData.translatedText;
    }
    return null;
  } catch (error) {
    console.error('[Translate] Error:', error);
    return null;
  }
}
