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
    
    // Pick the first keyword string, split by space, take top 2 words
    const topKeywords = imageKeywords[0].split(' ').slice(0, 2).join(',');
    
    // Generate 3 random images for the keyword
    const images = Array.from({ length: 3 }).map((_, i) => ({
      id: `loremflickr-${i}`,
      url: `https://loremflickr.com/800/600/${topKeywords}?random=${i + 1}`,
      alt: imageKeywords[0],
      credit: 'LoremFlickr'
    }));
    
    return images;
  } catch (err) {
    console.error('Error fetching topic images:', err);
    return [];
  }
}
