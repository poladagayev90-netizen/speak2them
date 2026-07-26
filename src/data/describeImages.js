// Zəngdəki "şəkli birlikdə təsvir edin" mərhələsi üçün SEÇİLMİŞ şəkil dəsti.
//
// NİYƏ ƏL İLƏ SEÇİLİB:
// Əvvəl şəkillər picsum.photos-dan seed ilə gəlirdi. Picsum TƏSADÜFİ foto
// qaytarır — seed yalnız "eyni seed → eyni təsadüfi foto" deməkdir, açar sözlə
// heç bir əlaqəsi yoxdur. Nəticədə ekranda morj görünürdü, altındakı sözlər isə
// mövzunun lüğətindən gəlirdi: bir-biri ilə tamamilə əlaqəsiz. Üstəlik təsadüfi
// fotoların çoxu boş mənzərə olurdu — onları detallı təsvir etmək mümkün deyil.
//
// SEÇİM MEYARI: kadrda insan + hərəkət + obyekt olsun ki, şagird həqiqətən
// danışa bilsin (kim nə edir, harada, nə geyinib). Boş mənzərə YOXDUR.
//
// AÇAR SÖZLƏR şəklin ÖZ məzmunundandır — mövzu lüğətindən yox. Şagird morj
// görürsə, altında "walrus" yazır.
//
// SİNXRON: siyahı statik və deterministikdir, ona görə iki tərəf həmişə eyni
// şəkli eyni sırada görür (indeks zəng sənədindəki imageStage ilə sinxronlanır).
// fallbackUrl EYNİ fotonun başqa ünvanıdır — biri yüklənməsə də tərəflər fərqli
// şəkil görmür.
export const describeImages = [
  {
    id: "market",
    url: "https://api.openverse.org/v1/images/95fc6877-b269-4be7-a6e0-2601b8f9afac/thumb/",
    fallbackUrl: "https://live.staticflickr.com/5142/5639996708_85fd8ca246_b.jpg",
    alt: "Küçə satıcısı meyvə qutuları ilə",
    keywords: ["vendor","beard","crate","cardboard box","pineapple"],
  },
  {
    id: "dinner",
    url: "https://api.openverse.org/v1/images/f62681ee-98f6-4ed4-aeaf-05d522634fe7/thumb/",
    fallbackUrl: "https://live.staticflickr.com/2730/4252069473_43c09feee5_b.jpg",
    alt: "Ailə süfrə arxasında nahar edir",
    keywords: ["family","dinner table","plate","candle","drink"],
  },
  {
    id: "classroom",
    url: "https://api.openverse.org/v1/images/3385d8d0-49a5-4999-adc4-06e9514d8a9d/thumb/",
    fallbackUrl: "https://live.staticflickr.com/2152/2243054452_0af8f36d5e_b.jpg",
    alt: "Sinifdə müəllim və şagirdlər",
    keywords: ["blackboard","teacher","pupil","uniform","chalk"],
  },
  {
    id: "kitchen",
    url: "https://api.openverse.org/v1/images/78a96ecc-d66b-44e7-81f8-0805d7d7d91c/thumb/",
    fallbackUrl: "https://live.staticflickr.com/7060/6831547684_350ccaeb68_b.jpg",
    alt: "Aşpaz peşəkar mətbəxdə",
    keywords: ["chef","apron","chef hat","plates","kitchen"],
  },
  {
    id: "builders",
    url: "https://api.openverse.org/v1/images/01470c80-0477-411e-ad61-56f244fe2951/thumb/",
    fallbackUrl: "https://live.staticflickr.com/8439/7826368726_ec5e2d6fa5_b.jpg",
    alt: "Tikinti işçiləri dayaq üzərində",
    keywords: ["worker","helmet","crane","scaffolding","site"],
  },
  {
    id: "doctor",
    url: "https://api.openverse.org/v1/images/19bdeab7-ac52-4206-aae2-073dd29e74f1/thumb/",
    fallbackUrl: "https://live.staticflickr.com/2500/4058808950_11be8e4061_b.jpg",
    alt: "İki həkim xəstəni müayinə edir",
    keywords: ["doctor","white coat","stethoscope","patient","examine"],
  },
  {
    id: "park",
    url: "https://api.openverse.org/v1/images/a2e51591-4977-43ee-99e1-3b236d11bc8b/thumb/",
    fallbackUrl: "https://live.staticflickr.com/7232/7246875624_a33303bbdd_b.jpg",
    alt: "Uşaq oyun meydançasında yellənəndə",
    keywords: ["playground","seesaw","slide","children","smile"],
  },
  {
    id: "barber",
    url: "https://api.openverse.org/v1/images/581535c9-4ddc-4378-ba2a-89c76a08076b/thumb/",
    fallbackUrl: "https://live.staticflickr.com/3618/3438908301_a6bec336f0_b.jpg",
    alt: "Bərbər müştərinin saçını kəsir",
    keywords: ["barber","clippers","mirror","clock","customer"],
  },
  {
    id: "zoo",
    url: "https://api.openverse.org/v1/images/838af3b3-614c-46b6-a5c9-942f347cce73/thumb/",
    fallbackUrl: "https://live.staticflickr.com/4152/5037017936_39c40f0c59_b.jpg",
    alt: "Morj sürüsü — dişlər və bığlar",
    keywords: ["walrus","tusk","whiskers","herd","wrinkled skin"],
  },
  {
    id: "bakery",
    url: "https://api.openverse.org/v1/images/8499543f-2b5c-485f-94fa-4301adb37b28/thumb/",
    fallbackUrl: "https://live.staticflickr.com/4002/4391867806_bb65ac2a41_b.jpg",
    alt: "Çörək dükanında satıcı və piştaxta",
    keywords: ["baker","counter","display case","pastry","shelf"],
  },
  {
    id: "street",
    url: "https://api.openverse.org/v1/images/cb3aec7f-039a-48ac-b3f1-e2f8496b62d9/thumb/",
    fallbackUrl: "https://live.staticflickr.com/65535/54535408885_3a089d86dc_b.jpg",
    alt: "Dar şəhər küçəsində gündəlik həyat",
    keywords: ["street","scooter","shop sign","laundry","cross"],
  },
  {
    id: "fishing",
    url: "https://api.openverse.org/v1/images/c436ef51-fec7-4724-9dd8-9655b821cb5e/thumb/",
    fallbackUrl: "https://live.staticflickr.com/3717/13793964063_02a386632c_b.jpg",
    alt: "Balıqçı sahildə tor daşıyır",
    keywords: ["fisherman","rope","beach","wave","smile"],
  },
];

export default describeImages;
