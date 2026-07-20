// Zəngdə "şəkli birlikdə təsvir et" mərhələsi üçün şəkil siyahısı. İki tərəf
// EYNİ şəkli görməlidir — ona görə mənbə tam DETERMİNİSTİK olmalıdır: eyni
// giriş → eyni URL → eyni şəkil, hər cihazda, hər regionda, hər zaman.
//
// Əvvəl LoremFlickr (`?lock=N`) primary, picsum fallback idi. İki problem
// desync yaradırdı: (1) LoremFlickr `lock`-a baxmayaraq həmişə eyni şəkli
// qaytarmır, rate-limit edir; (2) bir tərəfdə primary yüklənib, digərində
// yüklənməyəndə yalnız BİR tərəf fallback-ə keçirdi → eyni indeks, fərqli
// şəkil. Həll: picsum `seed` — saf funksiya kimi deterministikdir; per-peer
// fallback şaxəsi ümumiyyətlə yoxdur, ona görə tərəflər heç vaxt ayrıla bilmir.
export async function fetchTopicImages(imageKeywords, manualImageUrls = []) {
  // Əl ilə verilmiş URL-lər (varsa) — onlar da hər iki tərəf üçün eynidir.
  if (manualImageUrls && manualImageUrls.length > 0) {
    return manualImageUrls.map((url, i) => ({
      id: `manual-${i}`,
      url,
      alt: 'Topic image',
    }));
  }

  if (!imageKeywords || imageKeywords.length === 0) return [];

  // Hər açar söz üçün stabil, unikal seed → hər ikisində eyni, amma bir-birindən
  // fərqli 5 şəkil. Picsum sürətli global CDN-dir (fallback lazım deyil).
  return imageKeywords.map((kw, i) => ({
    id: `picsum-${i}`,
    url: `https://picsum.photos/seed/${encodeURIComponent(kw)}-${i}/800/600`,
    alt: kw,
    credit: 'Picsum',
  }));
}
