import { describeImages } from '../data/describeImages';

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

  // Picsum ARTIQ İŞLƏDİLMİR: seed yalnız "eyni seed → eyni təsadüfi foto"
  // deməkdir, açar sözlə əlaqəsi yoxdur. Ekranda morj görünüb altında başqa söz
  // yazılmasının səbəbi məhz bu idi, üstəlik təsadüfi fotoların çoxu təsvir
  // edilə bilməyən boş mənzərə olurdu.
  //
  // İndi əl ilə seçilmiş dəst işlədilir: hər şəkildə insan/hərəkət/obyekt var
  // və açar sözlər şəklin ÖZ məzmunundandır. Siyahı statikdir, ona görə
  // determinizm (və deməli iki tərəfin sinxronu) daha da güclüdür.
  return describeImages;
}
