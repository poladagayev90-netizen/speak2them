import { describeImages } from '../data/describeImages';
import { topicImages } from '../data/topicImages';

// Zəngdə "şəkli birlikdə təsvir et" mərhələsi üçün şəkil siyahısı. İki tərəf
// EYNİ şəkli görməlidir — ona görə mənbə tam DETERMİNİSTİK olmalıdır: eyni
// giriş → eyni URL → eyni şəkil, hər cihazda, hər regionda, hər zaman.
//
// Əvvəl LoremFlickr (`?lock=N`) primary, picsum fallback idi. İki problem
// desync yaradırdı: (1) LoremFlickr `lock`-a baxmayaraq həmişə eyni şəkli
// qaytarmır, rate-limit edir; (2) bir tərəfdə primary yüklənib, digərində
// yüklənməyəndə yalnız BİR tərəf fallback-ə keçirdi → eyni indeks, fərqli
// şəkil. Həll: statik, əvvəlcədən seçilmiş dəst — saf funksiya kimi
// deterministikdir; per-peer fallback şaxəsi yoxdur, tərəflər ayrıla bilmir.
//
// Həll sırası (hamısı deterministik):
//   1) manualImageUrls — admin əl ilə verib (varsa)
//   2) topicImages[day] — mövzuya özəl dəst (əvəz olunmuş açar sözlərlə)
//   3) describeImages   — qlobal ehtiyat dəsti, mövzu hələ doldurulmayıbsa
// `imageKeywords` artıq runtime-da işlədilmir (canlı sorğu desync yaradırdı) —
// yalnız scripts/generate_topic_images.js onu topicImages qurmaq üçün oxuyur.
export async function fetchTopicImages(day, imageKeywords, manualImageUrls = []) {
  // Əl ilə verilmiş URL-lər (varsa) — onlar da hər iki tərəf üçün eynidir.
  if (manualImageUrls && manualImageUrls.length > 0) {
    return manualImageUrls.map((url, i) => ({
      id: `manual-${i}`,
      url,
      alt: 'Topic image',
    }));
  }

  // Mövzuya özəl dəst varsa onu göstər; yoxdursa qlobal ehtiyata düş ki, ekran
  // heç vaxt boş qalmasın. Hər iki mənbə statik → determinizm (və sinxron) qorunur.
  const perTopic = topicImages[day];
  if (Array.isArray(perTopic) && perTopic.length > 0) return perTopic;

  return describeImages;
}
