// Şəkil açar sözlərinin lüğətini qurur → src/data/keywordGlossary.js
//
// NİYƏ LAZIMDIR: şəklin altındakı sözlər şagirdə "bunları işlət" deyir, amma
// A2 səviyyəsində sözün özü anlaşılmaya bilər. Üstünə BİR DƏFƏ basanda tərcümə
// görünür (KeywordChips). Tərcümə dili — öyrənənin L1-i (users.preferredLanguage,
// analiz hesabatı ilə eyni mənbə), telefonun sistem dili DEYİL: sistem dili rus
// və ya ingilis olanda tərcümə ümumiyyətlə olmazdı.
//
// NİYƏ RUNTIME DEYİL: 720 şəkil × 5 söz = 3600 istifadə, amma unikal söz çox
// azdır. Build vaxtı bir dəfə tərcümə edib fayla yazmaq = sıfır gecikmə, sıfır
// xərc, oflayn işləyir və nəticə hamıda eynidir.
//
// İSTİFADƏ:
//   node scripts/build_keyword_glossary.js            # çatışmayanları tərcümə et
//   node scripts/build_keyword_glossary.js --rebuild  # hamısını yenidən
//
// Maşın tərcüməsi tək sözdə çoxmənalılıqda səhv edir ("spring", "bank"). Ona
// görə OVERRIDES əl ilə yazılır və maşın nəticəsini həmişə üstələyir.

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../src/data/keywordGlossary.js');
const SOURCES = [
  path.join(__dirname, '../src/data/topicImages.js'),
  path.join(__dirname, '../src/data/describeImages.js'),
  path.join(__dirname, '../src/data/describeVideos.js'),
];

// Kontekstdən asılı sözlər — şəkil altındakı mənası ilə.
const OVERRIDES = {
  // Pexels batch (2026-09-25): "counter" came back as a meter, "fingerpicking"
  // as picking things up, and "steamed milk" as cooked milk.
  'chef apron': { az: 'aşbaz önlüyü', tr: 'şef önlüğü' },
  'tossing vegetables': { az: 'tərəvəzi tavada çevirmək', tr: 'sebzeleri havada çevirmek' },
  'kitchen counter': { az: 'mətbəx tezgahı', tr: 'mutfak tezgahı' },
  'coffee counter': { az: 'qəhvə piştaxtası', tr: 'kahve tezgahı' },
  'running in circles': { az: 'dairə vurub qaçmaq', tr: 'daireler çizerek koşmak' },
  'steamed milk': { az: 'köpüklənmiş süd', tr: 'köpürtülmüş süt' },
  'shaping vase': { az: 'vaza formalaşdırmaq', tr: 'vazo şekillendirmek' },
  'spinning wheel': { az: 'fırlanan dulus çarxı', tr: 'dönen çömlekçi çarkı' },
  'fingerpicking': { az: 'barmaqla çalmaq', tr: 'parmakla çalmak' },
  // Pexels batch 2 (2026-09-25, 43 clips). Worst misses: "rubbish" → zırva
  // (nonsense), "batter" → meyilli, "present" → indiki, "goal" → məqsəd.
  'rubbish': { az: 'zibil', tr: 'çöp' },
  'batter': { az: 'maye xəmir', tr: 'sulu hamur' },
  'present': { az: 'hədiyyə', tr: 'hediye' },
  'goal': { az: 'qapı', tr: 'kale' },
  'roller coaster': { az: 'sürət attraksionu', tr: 'hız treni' },
  'steep track': { az: 'dik rels yolu', tr: 'dik ray' },
  'big wheel': { az: 'şeytan çarxı', tr: 'dönme dolap' },
  'clothes rail': { az: 'paltar stendi', tr: 'elbise askılığı' },
  'high five': { az: 'əl-ələ vurmaq', tr: 'beşlik çakmak' },
  'grabber': { az: 'zibil maşası', tr: 'çöp toplama maşası' },
  'phone held high': { az: 'yuxarı qaldırılmış telefon', tr: 'yukarı kaldırılmış telefon' },
  'red machine': { az: 'qırmızı motoblok', tr: 'kırmızı çapa makinesi' },
  'dry field': { az: 'quru tarla', tr: 'kuru tarla' },
  'farmer walking': { az: 'yeriyən fermer', tr: 'yürüyen çiftçi' },
  'trees behind': { az: 'arxadakı ağaclar', tr: 'arkadaki ağaçlar' },
  'looking at the photo': { az: 'fotoya baxmaq', tr: 'fotoğrafa bakmak' },
  'people walking': { az: 'yeriyən insanlar', tr: 'yürüyen insanlar' },
  'hand pouring': { az: 'tökən əl', tr: 'döken el' },
  'splash': { az: 'sıçrama', tr: 'sıçrama' },
  'pink shop front': { az: 'çəhrayı vitrin', tr: 'pembe vitrin' },
  'dancers in white': { az: 'ağ geyimli rəqqaslar', tr: 'beyazlı dansçılar' },
  'people filming': { az: 'video çəkən insanlar', tr: 'video çeken insanlar' },
  'vinyl records': { az: 'vinil vallar', tr: 'plaklar' },
  'album covers': { az: 'albom üzlükləri', tr: 'albüm kapakları' },
  'white spray': { az: 'ağ su tozu', tr: 'beyaz su serpintisi' },
  'scoreboard': { az: 'hesab lövhəsi', tr: 'skor tabelası' },
  'bounce': { az: 'sıçrayış', tr: 'zıplama' },
  'white kitten': { az: 'ağ pişik balası', tr: 'beyaz kedi yavrusu' },
  'stitches': { az: 'ilmələr', tr: 'ilmekler' },
  'brown scarf': { az: 'qəhvəyi şərf', tr: 'kahverengi atkı' },
  'pancakes': { az: 'pankeyklər', tr: 'pankekler' },
  'market table': { az: 'bazar masası', tr: 'pazar tezgâhı' },
  'sizzling pan': { az: 'cızıldayan tava', tr: 'cızırdayan tava' },
  'person alone': { az: 'tək adam', tr: 'yalnız biri' },
  'umbrellas': { az: 'çətirlər', tr: 'şemsiyeler' },
  'flower stall': { az: 'gül piştaxtası', tr: 'çiçek tezgâhı' },
  'old couple': { az: 'yaşlı cütlük', tr: 'yaşlı çift' },
  'arm around her': { az: 'qolu onun çiynində', tr: 'kolu onun omzunda' },
  'teacher': { az: 'müəllim', tr: 'öğretmen' },
  'hand moving': { az: 'hərəkət edən əl', tr: 'hareket eden el' },
  'orange jumper': { az: 'narıncı sviter', tr: 'turuncu kazak' },
  'doughnuts': { az: 'ponçiklər', tr: 'donutlar' },
  'clapping': { az: 'əl çalmaq', tr: 'alkışlamak' },
  'city view': { az: 'şəhər mənzərəsi', tr: 'şehir manzarası' },
  'smiles': { az: 'təbəssümlər', tr: 'gülümsemeler' },
  'bank': { az: 'çay sahili', tr: 'nehir kıyısı' },
  'spring': { az: 'yaz', tr: 'ilkbahar' },
  'light': { az: 'işıq', tr: 'ışık' },
  'kind': { az: 'mehriban', tr: 'nazik' },
  'still': { az: 'sakit', tr: 'durgun' },
  'watch': { az: 'qol saatı', tr: 'kol saati' },
  'match': { az: 'oyun', tr: 'maç' },
  'crane': { az: 'kran', tr: 'vinç' },
  'trunk': { az: 'ağac gövdəsi', tr: 'ağaç gövdesi' },
  'court': { az: 'meydança', tr: 'saha' },
  'fair': { az: 'yarmarka', tr: 'panayır' },
  'stall': { az: 'bazar piştaxtası', tr: 'pazar tezgâhı' },
  'change': { az: 'xırda pul', tr: 'bozuk para' },
  'plate': { az: 'boşqab', tr: 'tabak' },
  'pitch': { az: 'futbol meydançası', tr: 'futbol sahası' },
  // Şəkil altında yanlış çıxan maşın tərcümələri (2026-09-20 gözlə yoxlama).
  'close up': { az: 'yaxın plan', tr: 'yakın çekim' },
  'toasting': { az: 'sağlıq deyir', tr: 'kadeh kaldırma' },
  'notebook': { az: 'dəftər', tr: 'not defteri' },
  'cap': { az: 'kepka', tr: 'kasket' },
  'leaning': { az: 'söykənmiş', tr: 'yaslanmış' },
  'packing': { az: 'çamadan yığır', tr: 'bavul hazırlıyor' },
  'moving': { az: 'daşınma', tr: 'taşınma' },
  'black and white': { az: 'ağ-qara', tr: 'siyah beyaz' },
  'friends': { az: 'dostlar', tr: 'arkadaşlar' },
  'counter': { az: 'piştaxta', tr: 'tezgâh' },
  'steps': { az: 'pilləkən', tr: 'basamaklar' },
  'field': { az: 'tarla', tr: 'tarla' },
  'platform': { az: 'perron', tr: 'peron' },
  'rooftop': { az: 'dam', tr: 'çatı' },
  'bus shelter': { az: 'avtobus dayanacağı', tr: 'otobüs durağı' },
  'wooden jetty': { az: 'taxta körpü', tr: 'ahşap iskele' },
  'sleeping': { az: 'yatıb', tr: 'uyuyor' },
  'waiting': { az: 'gözləyir', tr: 'bekliyor' },
  'thinking': { az: 'fikirləşir', tr: 'düşünüyor' },
  'holding': { az: 'tutub', tr: 'tutuyor' },
  'standing': { az: 'ayaq üstə', tr: 'ayakta' },
  'serving': { az: 'süfrəyə verir', tr: 'servis yapıyor' },
  'scales': { az: 'tərəzi', tr: 'terazi' },
  // Video dəsti (describeVideos.js) — hamısı ƏL İLƏ yazılıb: bu sözlərin çoxu
  // söz birləşməsidir və maşın onları hərfi tərcümə edir ("open palm" →
  // "açıq xurma", yəni palma meyvəsi).
  'open palm': { az: 'açıq ovuc', tr: 'açık avuç' },
  'standing still': { az: 'tərpənmədən dayanıb', tr: 'kıpırdamadan duruyor' },
  'blanket': { az: 'ədyal', tr: 'battaniye' },
  'falling': { az: 'aşağı düşür', tr: 'düşüyor' },
  'soaked': { az: 'başdan-ayağa islanıb', tr: 'sırılsıklam' },
  'rooster': { az: 'xoruz', tr: 'horoz' },
  'vegetable patch': { az: 'tərəvəz ləki', tr: 'sebze bahçesi' },
  'cross-legged': { az: 'bardaş qurub', tr: 'bağdaş kurmuş' },
  'rope swing': { az: 'kəndir yelləncək', tr: 'ip salıncak' },
  'pond': { az: 'gölməçə', tr: 'gölet' },
  'let go': { az: 'əlini buraxmaq', tr: 'bırakmak' },
  'splash': { az: 'suyun sıçraması', tr: 'su sıçraması' },
  'reeds': { az: 'qamışlıq', tr: 'sazlık' },
  'gorilla': { az: 'qorilla', tr: 'goril' },
  'chewing leaves': { az: 'yarpaq çeynəyir', tr: 'yaprak çiğniyor' },
  'bird feeder': { az: 'quş yemliyi', tr: 'kuş yemliği' },
  'squirrel': { az: 'dələ', tr: 'sincap' },
  // Veo clips (2026-10-13)
  'robot vacuum': { az: 'robot tozsoran', tr: 'robot süpürge' },
  'apron': { az: 'önlük', tr: 'önlük' },
  'ride': { az: 'minmək', tr: 'binmek' },
  'bonnet': { az: 'kapot', tr: 'kaput' },
  'slice of pizza': { az: 'bir dilim pizza', tr: 'bir dilim pizza' },
  'car roof': { az: 'maşının damı', tr: 'arabanın tavanı' },
  'dove': { az: 'göyərçin', tr: 'güvercin' },
  'seeds': { az: 'dən', tr: 'yem tanesi' },
  'deer': { az: 'maral', tr: 'geyik' },
  'estate agent': { az: 'əmlak agenti', tr: 'emlakçı' },
  'staircase': { az: 'pilləkən', tr: 'merdiven' },
  'carpet': { az: 'xalça', tr: 'halı' },
  'slip': { az: 'sürüşmək', tr: 'kaymak' },
  'empty house': { az: 'boş ev', tr: 'boş ev' },
  'hen': { az: 'toyuq', tr: 'tavuk' },
  'stroke': { az: 'sığallamaq', tr: 'okşamak' },
  'feathers': { az: 'lələklər', tr: 'tüyler' },
  'kangaroo': { az: 'kenquru', tr: 'kanguru' },
  'stand upright': { az: 'dik dayanmaq', tr: 'dik durmak' },
  'muscles': { az: 'əzələlər', tr: 'kaslar' },
  'stare': { az: 'gözünü zilləmək', tr: 'dik dik bakmak' },
  'white birds': { az: 'ağ quşlar', tr: 'beyaz kuşlar' },
  'treeline': { az: 'meşənin kənarı', tr: 'ağaç sınırı' },
  'leopard': { az: 'bəbir', tr: 'leopar' },
  'dirt track': { az: 'torpaq yol', tr: 'toprak yol' },
  'safari vehicle': { az: 'safari maşını', tr: 'safari aracı' },
  'dry grass': { az: 'quru ot', tr: 'kuru ot' },
  'spots': { az: 'xallar', tr: 'benekler' },
  'huge knife': { az: 'nəhəng bıçaq', tr: 'kocaman bıçak' },
  'flatbread': { az: 'yastı çörək', tr: 'yassı ekmek' },
  'salads': { az: 'salatlar', tr: 'salatalar' },
  'pier': { az: 'taxta körpü', tr: 'iskele' },
  'big fish': { az: 'iri balıq', tr: 'büyük balık' },
  'put back': { az: 'geri qoymaq', tr: 'geri koymak' },
  'lose balance': { az: 'müvazinətini itirmək', tr: 'dengesini kaybetmek' },
  'eagle': { az: 'qartal', tr: 'kartal' },
  'spread wings': { az: 'qanadlarını açmaq', tr: 'kanatlarını açmak' },
  'mound': { az: 'torpaq təpəciyi', tr: 'toprak tümsek' },
  'open field': { az: 'açıq sahə', tr: 'açık arazi' },
  'take off': { az: 'uçub qalxmaq', tr: 'havalanmak' },
  'wipers': { az: 'şüşəsilənlər', tr: 'silecekler' },
  'city below': { az: 'aşağıdakı şəhər', tr: 'aşağıdaki şehir' },
  'wake up': { az: 'oyanmaq', tr: 'uyanmak' },
  'news studio': { az: 'xəbər studiyası', tr: 'haber stüdyosu' },
  'presenter': { az: 'aparıcı', tr: 'sunucu' },
  'crawl': { az: 'sürünmək', tr: 'sürünmek' },
  'live tv': { az: 'canlı efir', tr: 'canlı yayın' },
  'screen': { az: 'ekran', tr: 'ekran' },
  'canal': { az: 'su arxı', tr: 'sulama kanalı' },
  'rice field': { az: 'çəltik tarlası', tr: 'pirinç tarlası' },
  'toy boat': { az: 'oyuncaq qayıq', tr: 'oyuncak tekne' },
  'current': { az: 'suyun axını', tr: 'akıntı' },
  // Telegram partiyası (2026-09-26)
  'contortionist': { az: 'kauçuk adam (akrobat)', tr: 'kontorsiyonist' },
  'baby goat': { az: 'çəpiş', tr: 'oğlak' },
  'metal chute': { az: 'metal nov', tr: 'metal oluk' },
  'barn': { az: 'tövlə', tr: 'ahır' },
  'stable': { az: 'tövlə', tr: 'ahır' },
  'branches': { az: 'budaqlar', tr: 'dallar' },
  'wooden staff': { az: 'taxta əsa', tr: 'tahta asa' },
  'wizard cloak': { az: 'sehrbaz plaşı', tr: 'büyücü pelerini' },
  'splashing': { az: 'su sıçradır', tr: 'su sıçratıyor' },
  'hopping sideways': { az: 'yana hoppanır', tr: 'yana zıplıyor' },
  'open arms': { az: 'açılmış qollar', tr: 'açık kollar' },
  'chick': { az: 'cücə', tr: 'civciv' },
  'laundry': { az: 'sərilmiş paltar', tr: 'asılı çamaşır' },
  'reading': { az: 'kitab oxuyur', tr: 'kitap okuyor' },
  'running': { az: 'qaçır', tr: 'koşuyor' },
  'spines': { az: 'tikanlar', tr: 'dikenler' },
  'tiny legs': { az: 'balaca ayaqlar', tr: 'minik bacaklar' },
  'kittens': { az: 'pişik balaları', tr: 'yavru kediler' },
  'rolling': { az: 'diyirlənir', tr: 'yuvarlanıyor' },
  'waving hands': { az: 'əllərini yelləyir', tr: 'ellerini sallıyor' },
  'moose': { az: 'sığın', tr: 'Kanada geyiği' },
  'orange spots': { az: 'narıncı xallar', tr: 'turuncu benekler' },
  'bricks': { az: 'kərpiclər', tr: 'tuğlalar' },
  'mortar': { az: 'sement məhlulu', tr: 'harç' },
  'thumbs up': { az: 'baş barmaq yuxarı', tr: 'başparmak yukarı' },
  // Telegram partiyası 2 (2026-10-01)
  'delivery rider': { az: 'kuryer', tr: 'kurye' },
  'fish tank': { az: 'akvarium', tr: 'akvaryum' },
  'leaning over': { az: 'əyilir', tr: 'eğiliyor' },
  'soaking wet': { az: 'sırsıklam', tr: 'sırılsıklam' },
  'ginger cat': { az: 'sarı pişik', tr: 'sarman kedi' },
  'riding': { az: 'minib gedir', tr: 'biniyor' },
  'carrying': { az: 'daşıyır', tr: 'taşıyor' },
  'knocking': { az: 'qapını döyür', tr: 'kapıyı çalıyor' },
  'slipping': { az: 'sürüşür', tr: 'kayıyor' },
  'sloth': { az: 'ləngimə (tənbəl heyvan)', tr: 'tembel hayvan' },
  'pushing': { az: 'itələyir', tr: 'itiyor' },
  'jumping': { az: 'tullanır', tr: 'zıplıyor' },
  'floating log': { az: 'suda üzən kötük', tr: 'yüzen kütük' },
  'balance': { az: 'tarazlıq', tr: 'denge' },
  'spinning': { az: 'fırlanır', tr: 'dönüyor' },
  'bushy tail': { az: 'qalın tüklü quyruq', tr: 'gür kuyruk' },
  // Telegram batch (2026-10-13): written by hand — the translator was rate-limited.
  'glass door': { az: 'şüşə qapı', tr: 'cam kapı' },
  handle: { az: 'qapı dəstəyi', tr: 'kapı kolu' },
  jump: { az: 'tullanmaq', tr: 'zıplamak' },
  computer: { az: 'kompüter', tr: 'bilgisayar' },
  pot: { az: 'qazan', tr: 'tencere' },
  lid: { az: 'qapaq', tr: 'kapak' },
  'big eyes': { az: 'iri gözlər', tr: 'iri gözler' },
  'air conditioner': { az: 'kondisioner', tr: 'klima' },
  carry: { az: 'daşımaq', tr: 'taşımak' },
  'security camera': { az: 'təhlükəsizlik kamerası', tr: 'güvenlik kamerası' },
  carrot: { az: 'yerkökü', tr: 'havuç' },
  stick: { az: 'çubuq', tr: 'sopa' },
  'black dog': { az: 'qara it', tr: 'siyah köpek' },
  'grey cat': { az: 'boz pişik', tr: 'gri kedi' },
  'gravel path': { az: 'çınqıllı cığır', tr: 'çakıllı yol' },
  'walk away': { az: 'uzaqlaşmaq', tr: 'uzaklaşmak' },
  'merry-go-round': { az: 'karusel', tr: 'atlıkarınca' },
  'upside down': { az: 'tərsinə, başıaşağı', tr: 'baş aşağı' },
  // Omni clips (2026-10-17).
  'slice of bread': { az: 'bir dilim çörək', tr: 'bir dilim ekmek' },
  'plastic bag': { az: 'sellofan torba', tr: 'naylon poşet' },
  'white goat': { az: 'ağ keçi', tr: 'beyaz keçi' },
  'village yard': { az: 'kənd həyəti', tr: 'köy avlusu' },
  'garden hose': { az: 'su şlanqı', tr: 'bahçe hortumu' },
  'flip-flops': { az: 'barmaqarası tapoçka', tr: 'parmak arası terlik' },
  spin: { az: 'fırlanmaq', tr: 'dönmek' },
  bear: { az: 'ayı', tr: 'ayı' },
  // Batch 2026-11-11 (22 clips).
  'wooden arch': { az: 'taxta tağ (finiş qapısı)', tr: 'ahşap kemer' },
  'holding her head': { az: 'başını tutub', tr: 'başını tutuyor' },
  'arm around shoulder': { az: 'qolu çiynində', tr: 'kolu omzunda' },
  'swinging armchair': { az: 'yellənən kreslo', tr: 'sallanan koltuk' },
  'falling down': { az: 'yıxılır', tr: 'yere düşüyor' },
  'spilled bag': { az: 'dağılmış çanta', tr: 'saçılmış çanta' },
  'spotted boxers': { az: 'xallı şortik', tr: 'benekli şort' },
  'black harness': { az: 'qara sinə qayışı', tr: 'siyah göğüs tasması' },
  'narrow crack': { az: 'dar çat', tr: 'dar çatlak' },
  'black-and-white cat': { az: 'ağ-qara pişik', tr: 'siyah beyaz kedi' },
  'orange-and-white cat': { az: 'narıncı-ağ pişik', tr: 'turuncu beyaz kedi' },
  'flying broomstick': { az: 'uçan süpürgə', tr: 'uçan süpürge' },
  'peace sign': { az: 'sülh işarəsi (iki barmaq)', tr: 'barış işareti' },
  'fishbowl': { az: 'dəyirmi akvarium', tr: 'cam fanus' },
  'trowel': { az: 'mala', tr: 'mala' },
  'tabby cat': { az: 'zolaqlı pişik', tr: 'tekir kedi' },
  'gym bench': { az: 'idman skamyası', tr: 'spor sehpası' },
  'cable machine': { az: 'kanatlı trenajor', tr: 'kablo istasyonu' },
  'tipping over': { az: 'aşır', tr: 'devriliyor' },
  'blonde tail': { az: 'açıq rəngli quyruq', tr: 'açık renk kuyruk' },
  'pink flamingo float': { az: 'çəhrayı flaminqo şarı', tr: 'pembe flamingo simidi' },
  'rooftop pool': { az: 'damdakı hovuz', tr: 'çatı havuzu' },
  'paddling': { az: 'əlləri ilə avar çəkir', tr: 'elleriyle kürek çekiyor' },
  'curled tail': { az: 'burulmuş quyruq', tr: 'kıvrık kuyruk' },
  'sliding down': { az: 'sürüşüb düşür', tr: 'kayar gibi iniyor' },
  'cat waiter': { az: 'ofisiant pişik', tr: 'garson kedi' },
  'floating in air': { az: 'havada süzür', tr: 'havada süzülüyor' },
  'pink tutu': { az: 'çəhrayı balet ətəyi', tr: 'pembe tütü etek' },
  'sack of corn': { az: 'qarğıdalı kisəsi', tr: 'mısır çuvalı' },
  // Batch 2026-11-21 (22 clips).
  'window ledge': { az: 'pəncərə kənarı', tr: 'pencere çıkıntısı' },
  'banknote': { az: 'əskinas (kağız pul)', tr: 'kağıt para' },
  'barbell': { az: 'ştanq', tr: 'halter' },
  'bathroom mirror': { az: 'hamam güzgüsü', tr: 'banyo aynası' },
  'behind its back': { az: 'arxasında gizlədib', tr: 'arkasında saklıyor' },
  'black cord': { az: 'qara kabel', tr: 'siyah kablo' },
  'black mask': { az: 'qara maska', tr: 'siyah maske' },
  'blue sea': { az: 'mavi dəniz', tr: 'mavi deniz' },
  'brown hat': { az: 'qəhvəyi şlyapa', tr: 'kahverengi şapka' },
  'car windscreen': { az: 'maşının ön şüşəsi', tr: 'ön cam' },
  'chopsticks': { az: 'yemək çubuqları', tr: 'yemek çubukları' },
  'city park': { az: 'şəhər parkı', tr: 'şehir parkı' },
  'climbing up': { az: 'yuxarı dırmaşır', tr: 'yukarı tırmanıyor' },
  'dish sponge': { az: 'qab süngəri', tr: 'bulaşık süngeri' },
  'diving in': { az: 'suya baş vurur', tr: 'suya dalıyor' },
  'falling backwards': { az: 'arxası üstə yıxılır', tr: 'geriye doğru düşüyor' },
  'foam fountain': { az: 'köpük fəvvarəsi', tr: 'köpük fıskiyesi' },
  'fried egg': { az: 'qızardılmış yumurta', tr: 'sahanda yumurta' },
  'grass verge': { az: 'yol kənarı otluq', tr: 'yol kenarı çimenlik' },
  'green basin': { az: 'yaşıl ləyən', tr: 'yeşil leğen' },
  'green cup': { az: 'yaşıl fincan', tr: 'yeşil bardak' },
  'grey dog': { az: 'boz it', tr: 'gri köpek' },
  'grey shorts': { az: 'boz şortik', tr: 'gri şort' },
  'grey wall': { az: 'boz divar', tr: 'gri duvar' },
  'guinea pig': { az: 'dəniz donuzu', tr: 'ginepig' },
  'gym mirror': { az: 'idman zalı güzgüsü', tr: 'spor salonu aynası' },
  'gymnastics mat': { az: 'gimnastika döşəyi', tr: 'jimnastik minderi' },
  'handstand': { az: 'əllər üstə durmaq', tr: 'amuda kalkmak' },
  'hanging on': { az: 'asılı qalıb', tr: 'tutunup sallanıyor' },
  'helicopters': { az: 'helikopterlər', tr: 'helikopterler' },
  'hiding cat': { az: 'gizlənən pişik', tr: 'saklanan kedi' },
  'hissing': { az: 'fısıldayır', tr: 'tıslıyor' },
  'iron tower': { az: 'dəmir qüllə', tr: 'demir kule' },
  'jumping up': { az: 'yuxarı tullanır', tr: 'yukarı zıplıyor' },
  'kitchen sink': { az: 'mətbəx çanağı', tr: 'mutfak lavabosu' },
  'marble counter': { az: 'mərmər tezgah', tr: 'mermer tezgâh' },
  'mint sweets': { az: 'nanəli konfet', tr: 'naneli şeker' },
  'noodle bowls': { az: 'əriştə kasaları', tr: 'erişte kaseleri' },
  'owl': { az: 'bayquş', tr: 'baykuş' },
  'paws on hips': { az: 'əlləri belində', tr: 'eller belinde' },
  'peeking out': { az: 'boylanıb baxır', tr: 'gizlice bakıyor' },
  'pepper grinder': { az: 'istiot üyüdən', tr: 'karabiber değirmeni' },
  'pine branches': { az: 'şam budaqları', tr: 'çam dalları' },
  'pink beret': { az: 'çəhrayı beret', tr: 'pembe bere' },
  'pink scarf': { az: 'çəhrayı şərf', tr: 'pembe atkı' },
  'pommel horse': { az: 'gimnastika atı', tr: 'kulplu beygir' },
  'power plug': { az: 'elektrik çəngəli', tr: 'fiş' },
  'red brick': { az: 'qırmızı kərpic', tr: 'kırmızı tuğla' },
  'red curtain': { az: 'qırmızı pərdə', tr: 'kırmızı perde' },
  'red scooter': { az: 'qırmızı skuter', tr: 'kırmızı scooter' },
  'red squirrel': { az: 'kürən dələ', tr: 'kızıl sincap' },
  'running tourists': { az: 'qaçan turistlər', tr: 'koşan turistler' },
  'skyscraper': { az: 'göydələn', tr: 'gökdelen' },
  'sleeping kitten': { az: 'yatan pişik balası', tr: 'uyuyan kedi yavrusu' },
  'small fish': { az: 'kiçik balıq', tr: 'küçük balık' },
  'smartphone': { az: 'smartfon', tr: 'akıllı telefon' },
  'soup ladle': { az: 'şorba çömçəsi', tr: 'çorba kepçesi' },
  'spiky plant': { az: 'tikanlı bitki', tr: 'dikenli bitki' },
  'splashing water': { az: 'su sıçrayır', tr: 'su sıçrıyor' },
  'sponge': { az: 'süngər', tr: 'sünger' },
  'sports car': { az: 'idman maşını', tr: 'spor araba' },
  'spotted cat': { az: 'xallı pişik', tr: 'benekli kedi' },
  'standing upright': { az: 'dik dayanıb', tr: 'dik duruyor' },
  'taking photos': { az: 'şəkil çəkir', tr: 'fotoğraf çekiyor' },
  'toy gun': { az: 'oyuncaq tapança', tr: 'oyuncak tabanca' },
  'wall socket': { az: 'divar rozetkası', tr: 'priz' },
  'washing glass': { az: 'şüşəni silir', tr: 'camı siliyor' },
  'waving paws': { az: 'əllərini yelləyir', tr: 'patilerini sallıyor' },
  'wet floor': { az: 'yaş döşəmə', tr: 'ıslak zemin' },
  'white box': { az: 'ağ qutu', tr: 'beyaz kutu' },
  'white foam': { az: 'ağ köpük', tr: 'beyaz köpük' },
  'white plate': { az: 'ağ boşqab', tr: 'beyaz tabak' },
  'winter jacket': { az: 'qış gödəkçəsi', tr: 'kışlık mont' },
  'wooden hammer': { az: 'taxta çəkic', tr: 'tahta çekiç' },
  'yellow sponge': { az: 'sarı süngər', tr: 'sarı sünger' },
};

function loadKeywords(file) {
  if (!fs.existsSync(file)) return [];
  const src = fs.readFileSync(file, 'utf8');
  return [...src.matchAll(/"keywords":\s*\[([^\]]*)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]))
    .concat([...src.matchAll(/keywords:\s*\[([^\]]*)\]/g)]
      .flatMap((m) => [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1])));
}

async function translate(text, target) {
  const url = 'https://translate.googleapis.com/translate_a/single?'
    + new URLSearchParams({ client: 'gtx', sl: 'en', tl: target, dt: 't', q: text });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`translate ${res.status}`);
  const json = await res.json();
  return json[0].map((x) => x[0]).join('').trim();
}

(async () => {
  const rebuild = process.argv.includes('--rebuild');
  const words = [...new Set(SOURCES.flatMap(loadKeywords).map((w) => w.trim().toLowerCase()))]
    .filter((w) => w && w.length <= 40)
    .sort();

  let existing = {};
  if (!rebuild && fs.existsSync(OUT)) {
    const src = fs.readFileSync(OUT, 'utf8');
    const m = src.match(/export const keywordGlossary = (\{[\s\S]*?\});/);
    if (m) existing = JSON.parse(m[1]);
  }

  const todo = words.filter((w) => !existing[w]);
  console.log(`unikal söz: ${words.length}, tərcümə lazım: ${todo.length}`);

  const out = { ...existing };
  let n = 0;
  for (const w of todo) {
    try {
      const az = await translate(w, 'az');
      const tr = await translate(w, 'tr');
      out[w] = { az, tr };
    } catch (e) {
      console.warn(`  XƏTA "${w}": ${e.message}`);
    }
    n += 1;
    if (n % 100 === 0) console.log(`  ${n}/${todo.length} …`);
    await new Promise((r) => setTimeout(r, 60));
  }

  // Əl ilə yazılanlar maşını həmişə üstələyir.
  const wanted = new Set(words);
  for (const [w, v] of Object.entries(OVERRIDES)) if (out[w] || wanted.has(w)) out[w] = v;

  const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
  const header = `// Şəkil açar sözlərinin lüğəti — söz → { az, tr }.
//
// Şəklin altındakı sözə bir dəfə basanda öyrənənin öz dilindəki qarşılığı
// görünür (KeywordChips). Dil users.preferredLanguage-dən gəlir — analiz
// hesabatı ilə eyni mənbə; telefonun sistem dili İŞLƏNMİR, çünki sistem dili
// rus/ingilis olan telefonda tərcümə heç vaxt görünməzdi.
//
// Bu fayl scripts/build_keyword_glossary.js tərəfindən qurulur. Tək sözün
// maşın tərcüməsi çoxmənalılıqda səhv edir ("bank", "spring") — həmin sözlər
// skriptdəki OVERRIDES-də əl ilə yazılıb və maşını üstələyir. Yeni söz əlavə
// edəndə skripti yenidən işlət: mövcud tərcümələr saxlanılır, yalnız çatışmayan
// sözlər sorğulanır.

export const keywordGlossary = `;
  fs.writeFileSync(OUT, header + JSON.stringify(sorted, null, 0) + ';\n');
  console.log(`lüğət: ${Object.keys(sorted).length} söz → ${OUT}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
