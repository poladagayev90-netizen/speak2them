const UNSPLASH_ACCESS_KEY = process.env.REACT_APP_UNSPLASH_ACCESS_KEY;
const UNSPLASH_URL = 'https://api.unsplash.com/search/photos';

export async function fetchTopicImages(imageKeywords, manualImageUrls = []) {
  // If manual URLs provided, use those instead
  if (manualImageUrls && manualImageUrls.length > 0) {
    return manualImageUrls.map((url, i) => ({
      id: `manual-${i}`,
      url,
      alt: 'Topic image'
    }));
  }

  if (!UNSPLASH_ACCESS_KEY || !imageKeywords || imageKeywords.length === 0) {
    return [];
  }

  try {
    const results = await Promise.all(
      imageKeywords.map(async (keyword) => {
        const res = await fetch(
          `${UNSPLASH_URL}?query=${encodeURIComponent(keyword)}&per_page=1&orientation=landscape`,
          {
            headers: {
              Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`
            }
          }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const photo = data.results?.[0];
        if (!photo) return null;
        return {
          id: photo.id,
          url: photo.urls.regular,
          alt: photo.alt_description || keyword,
          credit: photo.user?.name || 'Unsplash'
        };
      })
    );
    return results.filter(Boolean);
  } catch (error) {
    console.error('[Images] Fetch failed:', error);
    return [];
  }
}
