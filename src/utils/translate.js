const LIBRETRANSLATE_URL = 'https://libretranslate.com/translate';

export async function translateText(text, sourceLang = 'az', targetLang = 'en') {
  if (!text || !text.trim()) return null;

  try {
    const response = await fetch(LIBRETRANSLATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text.trim(),
        source: sourceLang,
        target: targetLang,
        format: 'text'
      })
    });

    if (!response.ok) throw new Error('Translation failed: ' + response.status);

    const data = await response.json();
    return data.translatedText || null;
  } catch (error) {
    console.error('[Translate] Error:', error);
    return null;
  }
}
