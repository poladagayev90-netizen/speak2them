export async function fetchTopicImages(imageKeywords, manualImageUrls = []) {
  // If manual URLs provided, use those instead
  if (manualImageUrls && manualImageUrls.length > 0) {
    return manualImageUrls.map((url, i) => ({
      id: `manual-${i}`,
      url,
      alt: 'Topic image'
    }));
  }

  // Use LoremFlickr as a free fallback (no API key required)
  // It returns images based on keywords
  try {
    if (!imageKeywords || imageKeywords.length === 0) return [];
    
    // Map over all provided keywords (usually 5) to generate stable images
    const images = imageKeywords.map((kw, i) => {
      // Pick top 2 words from each keyword string for the search query
      const topKeywords = kw.split(' ').slice(0, 2).join(',');
      
      return {
        id: `loremflickr-${i}`,
        // Use lock instead of random so both users see the EXACT same image
        url: `https://loremflickr.com/800/600/${topKeywords}?lock=${i + 1}`,
        // LoremFlickr rate-limits and flakes; the seed makes this fallback
        // just as deterministic across both peers as the primary URL.
        fallbackUrl: `https://picsum.photos/seed/${encodeURIComponent(topKeywords)}-${i}/800/600`,
        alt: kw,
        credit: 'LoremFlickr'
      };
    });
    
    return images;
  } catch (err) {
    console.error('Error fetching topic images:', err);
    return [];
  }
}
