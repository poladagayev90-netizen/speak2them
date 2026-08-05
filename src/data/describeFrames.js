// "Şəkli təsvir et" üçün danışıq qəlibləri (sentence frames).
//
// NİYƏ LAZIMDIR: şagird şəkli görür, sözləri də bilir, amma CÜMLƏYƏ başlaya
// bilmir — ən çox ilişdiyi yer məhz ilk sözdür. Açar sözlər "nə" sualına cavab
// verir, qəliblər isə "necə deyim" sualına. İkisi bir yerdə lazımdır.
//
// Qəliblər QLOBALdır (şəkildən asılı deyil) — hər şəkildə eyni dörd addım işə
// düşür: gördüyünü de → yerini göstər → təxmin et → fikrini bildir. Şəklə ÖZƏL
// olan hissə isə hər şəklin öz `keywords` və `prompts` sahələrindədir.
//
// Sıralama təsadüfi deyil: yuxarıdan aşağı getdikcə cümlələr çətinləşir, ona
// görə zəif şagird birinci qrupda qalıb yenə danışa bilir, güclüsü aşağı düşür.
export const describeFrames = [
  {
    id: 'see',
    label: 'Nə görürəm',
    frames: [
      'I can see…',
      'There is a…',
      'There are…',
      'In this picture, …',
      'This is a photo of…',
    ],
  },
  {
    id: 'where',
    label: 'Harada',
    frames: [
      'In the foreground…',
      'In the background…',
      'On the left / On the right…',
      'At the top / At the bottom…',
      'Next to… / Behind…',
    ],
  },
  {
    id: 'guess',
    label: 'Təxmin edirəm',
    frames: [
      'It looks like…',
      'It seems to me that…',
      'He / She might be…',
      'They must be…',
      'I think they are …ing',
    ],
  },
  {
    id: 'opinion',
    label: 'Mənim fikrim',
    frames: [
      'In my opinion…',
      "I'd say…",
      'What I find interesting is…',
      'If I were there, I would…',
      'This reminds me of…',
    ],
  },
];

export default describeFrames;
