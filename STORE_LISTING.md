# SpeakLab — Play Store Listinq Paketi

**Məqsəd:** Verifikasiya gözlənilərkən Play Console-a hazır, kopyala-yapışdır mətnlər + qrafika spesifikasiyaları + anket cavabları.
**Paket:** `com.speaklab.app` · versionCode 3 / versionName 1.2 (1 və 2 hər ikisi Play tərəfindən yandırıldı — draft release-i silmək versionCode-u geri qaytarmır)
**Default dil:** Azərbaycan (az-AZ). **Türkcə (tr-TR)** əlavə dil kimi §2.1-də hazırdır — grafikalar dublikat etmək lazım deyil, Play tərcümə edilmiş dildə şəkil yoxdursa default dilin qrafikasını avtomatik işlədir. (Qeyd: bu sətir əvvəl "İngilis versiyası aşağıda" deyirdi — bu, heç vaxt yazılmamış boş vəd idi, silindi. İngilis mağaza səhifəsi qəsdən əlavə edilmir, çünki tətbiqin UI-si yalnız az/tr dəstəkləyir — ingiliscə mağaza + azərbaycanca UI mənfi rəylərə səbəb olardı.)

**Ad qərarı (2026-08-06):** App Store-da "AI English Tutor - SpeakLab" adlı canlı rəqib var (İLM/Istanbul Language Center, speaklabai.com) — AI ilə İngilis danışıq praktikası, konsept demək olar eynidir. Polad bu adla qarışdırılmaq istəmir, çünki SpeakLab-ın əsas məhsulu **real insan-insan praktikasıdır**, AInur yalnız yardımçı funksiyadır. Ona görə Play başlığı bare "SpeakLab" yox, domenə bağlı **"SpeakLab.az"** oldu — bu, həm hüquqi/qarışıqlıq riskini azaldır, həm "canlı/real" fərqini önə çıxarır. Gələcəkdə App Store-a müraciət ediləndə də eyni adla getmək tövsiyə olunur.

---

## 1. HAZIRLIQ DURUMU

| Element | Status | Qeyd |
|---|---|---|
| İmzalı AAB | ✅ Hazır | Desktop-da `SpeakLab-play-v3.aab` |
| Privacy Policy URL | ✅ Canlı (200) | https://speaklab-app.vercel.app/privacy.html |
| Hesab silmə URL | ✅ Canlı (200) | https://speaklab-app.vercel.app/delete-account.html |
| App icon 512×512 | ✅ Hazır | `store_assets/app-icon-512.png` (dolu, alfasız — `public/logo512.png`-i YÜKLƏMƏ, o 85% şəffafdır) |
| Feature graphic 1024×500 | ✅ Hazır | `store_assets/feature-graphic-1024x500.png` |
| Telefon screenshot-ları | ✅ Hazır (5 ədəd) | `store_assets/screenshot-01..05.png` — əsl tətbiqdən, canlı zəng daxil |
| Başlıq / qısa / tam təsvir | ✅ Bu sənəddə | §2 |
| Content rating cavabları | ✅ Bu sənəddə | §4 |
| Data Safety cavabları | ✅ Bu sənəddə | §5 |

**Nəticə:** yükləmə üçün lazım olan hər şey hazırdır. Qalan: Console-da forma doldurma.

**App access test hesabı (2026-08-06 yaradıldı, SİLMƏ):**
```
Email:  speaklab.playreview@example.com
Şifrə:  PlayReview2026!
```
Google Sign-In native buildda gizlədilir (`Login.jsx`), reviewer yalnız bu email/parolla girə bilər. `@example.com` — IANA-rezerv domendir (RFC 2606), real insana məxsus deyil, Firebase e-poçt təsdiqi tələb etmədiyi üçün işləyir. Login-dən Home-a qədər Playwright ilə təsdiqləndi. **Bu hesabı digər `TestVerify*` test hesabları ilə birlikdə TƏMİZLƏMƏ** — Play review istənilən vaxt yenidən yoxlaya bilər.

---

## 2. MAĞAZA MƏTNLƏRİ (kopyala-yapışdır)

### Başlıq (max 30 simvol)
```
SpeakLab.az
```
*(Yekun qərar 2026-08-06: Polad sadə adı seçdi — hər iki dildə (az/tr) eyni, "Real İnsanlarla" əlavəsi lazım deyil. `.az` domeni özü artıq İLM-in "SpeakLab AI" adından fərqləndirir, bu, ad qərarının məqsədini ödəyir. "Real insanlarla" fərqi qısa təsvirdə qalır.)*

### Qısa təsvir (max 80 simvol)
```
Canlı səsli zənglərlə İngilis dili danışıq praktikası — real partnyorlarla.
```
*(75 simvol)*

### Tam təsvir (max 4000 simvol)
```
İngilis dilini danışaraq öyrənməyin ən sürətli yolu — SpeakLab. 🎙️

Qrammatika kitablarını bir kənara qoy. SpeakLab səni səviyyənə (A1–C2) uyğun REAL insanlarla canlı səsli zəngə bağlayır — bir toxunuşla partnyor tapılır və danışıq dərhal başlayır.

🎯 NƏ ÜÇÜN SPEAKLAB?
• Bir düymə — canlı partnyor. Səviyyənə uyğun danışan tapılır, zəng avtomatik başlayır.
• Hər gün yeni mövzu. Səyahət, iş, dostluq, texnologiya — hazır suallar, sözlük və idiomlarla zəngə hazır gəl.
• AI təhlili. Zəngdən sonra tələffüzün, söz ehtiyatın və qrammatikan üzrə şəxsi tövsiyələr al.
• AInur ilə praktika. Real insana hazır deyilsənsə, AI müəllimlə istənilən vaxt səsli məşq et.
• Streak və reytinq. Hər gün danış, seriyanı böyüt, liderlər cədvəlində yüksəl.
• Günün tapmacası və quizlər. Oyunla yeni sözlər öyrən.

🧪 STRUKTURLU KURS
Kohort əsaslı 30 mövzuluq danışıq kursu — həftədə bir neçə canlı sessiya, aydın irəliləyiş və finiş xətti. Kursu tamamlayanlar üçün xüsusi mükafat.

💬 KİMLƏR ÜÇÜNDÜR?
İngiliscə oxuyub-yaza bilən, amma DANIŞMAĞA çəkinən hər kəs üçün. Danışıq bloklarını real təcrübə ilə aşırıq.

Bu gün danışmağa başla — SpeakLab səni gözləyir. 🚀

speaklab.az
```
*(~1050 simvol — istəsən uzada bilərik)*

### Kateqoriya və teqlər
- **Kateqoriya:** Education (və ya Communication — Education tövsiyə olunur)
- **Teqlər:** language learning, English, speaking practice, conversation, education
- **Email (dəstək):** *(qeydiyyat emailin — məs. poladagayev90@gmail.com)*
- **Vebsayt:** https://speaklab-app.vercel.app

---

## 2.1 TÜRKCƏ MAĞAZA SƏHİFƏSİ (tr-TR, 2026-08-06 əlavə edildi)

Niyə: tətbiqin UI-si həqiqətən türkcəni dəstəkləyir (`src/i18n.js`), ona görə Türkiyə istifadəçisi
quraşdıranda gördüyü ilə mağaza vədi üst-üstə düşür — ingiliscədən fərqli olaraq saxta gözlənti yaratmır.
Qrafika (icon, feature graphic, screenshot-lar) TƏKRARLANMIR — Play tərcümə edilmiş dildə qrafika
yoxdursa default dilinkini avtomatik göstərir.

### Başlıq (max 30 simvol)
```
SpeakLab.az
```
*(Polad qərarı: iki dildə eyni sadə ad)*

### Qısa təsvir (max 80 simvol)
```
Canlı sesli aramalarla İngilizce konuşma pratiği — gerçek partnerlerle.
```
*(71 simvol)*

### Tam təsvir (max 4000 simvol)
```
İngilizce konuşarak öğrenmenin en hızlı yolu — SpeakLab. 🎙️

Gramer kitaplarını bir kenara bırak. SpeakLab seni seviyene (A1–C2) uygun GERÇEK insanlarla canlı sesli bir aramaya bağlar — tek dokunuşla partner bulunur ve konuşma hemen başlar.

🎯 NEDEN SPEAKLAB?
• Tek tuş — canlı partner. Seviyene uygun biriyle eşleşirsin, arama otomatik başlar.
• Her gün yeni bir konu. Seyahat, iş, arkadaşlık, teknoloji — hazır sorular, kelime ve deyimlerle aramaya hazır gel.
• Yapay zeka analizi. Aramadan sonra telaffuzun, kelime dağarcığın ve gramerin hakkında kişisel öneriler al.
• AInur ile pratik. Gerçek biriyle konuşmaya henüz hazır değilsen, yapay zeka öğretmenle istediğin zaman sesli pratik yap.
• Seri ve sıralama. Her gün konuş, serini büyüt, liderlik tablosunda yüksel.
• Günün bulmacası ve kısa testler. Oyunla yeni kelimeler öğren.

🧪 YAPILANDIRILMIŞ KURS
Kohort tabanlı 30 konulu konuşma kursu — haftada birkaç canlı oturum, net bir ilerleme ve bitiş çizgisi. Kursu tamamlayanlara özel ödül.

💬 KİMLER İÇİN?
İngilizce okuyup yazabilen ama KONUŞMAKTAN çekinen herkes için. Konuşma engelini gerçek deneyimle aşıyoruz.

Bugün konuşmaya başla — SpeakLab seni bekliyor. 🚀

speaklab.az
```
*(~900 simvol)*

---

## 3. VİZUAL ASSET SPESİFİKASİYALARI (Canva üçün)

### App icon (512×512) — ✅ HAZIR
- Fayl: `public/logo512.png`, 512×512, 32-bit PNG. Birbaşa yüklənə bilər.
- ⚠️ Play özü künc yuvarlaqlaşdırması əlavə edir — icon tam kvadrat (full-bleed) olmalıdır, şəffaf künc lazım deyil.

### Feature graphic (1024×500) — ❌ LAZIMDIR
- Ölçü: **tam 1024×500 px**, JPG və ya 24-bit PNG (şəffaflıq YOX).
- Brend: ağ fon + glassmorphism kart, Ink Navy `#0D1B3E` başlıq, Lab Violet `#6D3BEB` + Neon Cyan `#12BBD6` işıqlanma.
- Mətn təklifi: **"Danışaraq öyrən"** + kiçik alt sətir "Real partnyorlarla canlı İngilis praktikası". Sağ altda kiçik `speaklab.az`.
- ⚠️ Mərkəzə çox söz yığma — bəzi cihazlarda üstünə Play düymələri düşür.

### Telefon screenshot-ları — ❌ LAZIMDIR (min 2, max 8)
- Ölçü: 9:16 (dik), min tərəf 320px, max 3840px. Real cihaz: 1080×2400 uyğundur.
- Bizdə real APK screenshot-ları var — Canva-da brend çərçivəsinə + qısa başlığa salıb 4–6 ədəd hazırla:
  1. **Lobby / "Find Random Partner"** → başlıq: "Bir toxunuşla canlı partnyor"
  2. **Zəng + mövzu paneli** → "Hər zəngə hazır mövzu, söz və suallar"
  3. **AI təhlil nəticəsi** → "Zəngdən sonra şəxsi AI təhlili"
  4. **Kurs proqresi / finiş xətti** → "30 mövzuluq strukturlu kurs"
  5. **Streak / reytinq** → "Hər gün danış, seriyanı böyüt"
- Tablet screenshot-ları YALNIZ tablet hədəfləyirsənsə lazımdır — telefon üçün buraxıla bilər.

---

## 4. CONTENT RATING (IARC anketi) — CAVABLAR

Bu app **istifadəçilər arasında moderasiya olunmayan canlı səsli ünsiyyət** təklif edir → adətən "Teen" reytinqi alır. Dürüst cavablar:

| Sual | Cavab |
|---|---|
| Zorakılıq (violence) | Xeyr |
| Qorxu/dəhşət | Xeyr |
| Cinsi məzmun | Xeyr |
| Nalayiq dil (app-ın öz məzmununda) | Xeyr |
| Narkotik/alkoqol/tütün | Xeyr |
| Qumar (real və ya simulyasiya) | Xeyr |
| **İstifadəçilər bir-biri ilə ünsiyyət qura bilir?** | **BƏLİ** (canlı səsli zəng + mətn çat) |
| Ünsiyyət moderasiya olunur? | Xeyr (real-time, avtomoderasiya yoxdur) — dürüst bəyan et |
| İstifadəçi məkanı paylaşılır? | Xeyr |
| İstifadəçi yaratdığı məzmun paylaşılır? | Bəli (səs, profil məlumatı) |
| Rəqəmsal alış-veriş (in-app billing) | Xeyr (hazırda ödəniş WhatsApp üzərindən manual) |

⚠️ "İstifadəçilər ünsiyyət qura bilir" = BƏLİ cavabı reytinqi qaldırır, amma **dürüstlük vacibdir** — yanlış bəyan sonradan app-ın silinməsinə səbəb ola bilər.

---

## 5. DATA SAFETY FORMU — CAVABLAR

Kodda təsdiqlənmiş data toplama (APP_STORE_AUDIT.md §3.4-dən):

| Data növü | Toplanır? | Paylaşılır (3-cü tərəf)? | Məqsəd |
|---|---|---|---|
| Ad, e-poçt | Bəli | Firebase/Google | Hesab, autentifikasiya |
| Profil foto | Bəli | Firebase | Profil |
| Audio (səs) | Bəli | Agora (RTC ötürülməsi) | Canlı zəng — **saxlanılır** (AI təhlili üçün müvəqqəti) |
| Səs/mətn → AI | Bəli | Google Gemini | AI təhlili və praktika |
| Cihaz ID (FCM token) | Bəli | Firebase (FCM) | Push bildiriş |
| İstifadə/aktivlik | Bəli | Firebase | Streak, tarixçə, reytinq |

**Bəyan ediləcək əsas nöqtələr:**
- Data **şifrələnmə ilə (in transit)** ötürülür → Bəli (hamısı HTTPS/TLS).
- İstifadəçi datanın silinməsini tələb edə bilir → **Bəli** (tətbiq içi "Hesabı Sil" + https://speaklab-app.vercel.app/delete-account.html).
- Audio toplanır → "Cinaha/audio" bölməsində bəyan et; niyə lazım olduğunu izah et (canlı zəng + AI təhlili).
- 3-cü tərəflər: Firebase/Google, Agora, Google Gemini.

---

## 6. YÜKLƏMƏ GÜNÜ CHECKLIST (verifikasiya bitəndən sonra)

1. AAB yüklə: Desktop-da `SpeakLab-play-v3.aab` (versionCode 3). Hər növbəti dəfə versionCode-u BİR DƏFƏ görülən kimi Play əbədi yandırır — draft release-i silmək bunu geri qaytarmır, ona görə hər cəhddə yeni ədəd lazımdır.
2. Store listing: §2 mətnləri + §3 qrafika.
3. Privacy Policy URL: https://speaklab-app.vercel.app/privacy.html
4. Content rating anketi: §4.
5. Data Safety formu: §5.
6. Target audience: 13+ (Teen — canlı ünsiyyətə görə).
7. Internal testing track-də əvvəlcə real cihazda push + zəng yoxla, sonra production.
8. ⚠️ Sonrakı hər yükləmədə `android/app/build.gradle`-də `versionCode`-u artır.
```
```
```

---

## 8. BURAXILIŞ 2026-09-21 — versionCode 19 / 1.9

### 8.1 Nə dəyişdi (mətnə təsir edən)
- Mövzular **30 → 60**, hər mövzuda 8 söz + 3 idiom + 20 sual + 12 foto.
- **Dərslər** (yeni): 4 modul, 17 qısa dərs — necə təsvir etməli, söhbəti necə davam etdirməli, Taboo, debat.
- **Dərs rejimi** (yeni, kompüter): müəllim ekran paylaşanda mövzunu böyük ekranda slayd-slayd keçir.
- Tanışlıq zəngi artıq **WhatsApp-da** razılaşdırılır (tətbiqdəki slot lövhəsi ikinci seçim kimi qalır).
- **⚠️ İNTERFEYS ARTIQ İNGİLİSCƏDİR** (2026-08-21-dən; `i18next` silinib). §2.1-dəki «UI türkcəni dəstəkləyir» əsaslandırması KÖHNƏLİB. Mağaza səhifəsi az/tr qalır — tətbiqi az/tr danışan öyrənən üçün TƏSVİR edir, amma UI-nin özünün ingiliscə olduğunu tam təsvirdə bir sətirlə demək lazımdır ki, saxta gözlənti yaranmasın.

### 8.2 Yenilənmiş tam təsvir (az-AZ, kopyala-yapışdır)
```
İngilis dilini danışaraq öyrənməyin ən sürətli yolu — SpeakLab. 🎙️

Qrammatika kitablarını bir kənara qoy. SpeakLab səni səviyyənə (A1–C2) uyğun REAL insanlarla canlı səsli zəngə bağlayır — bir toxunuşla partnyor tapılır və danışıq dərhal başlayır.

🎯 NƏ ÜÇÜN SPEAKLAB?
• Bir düymə — canlı partnyor. Səviyyənə uyğun danışan tapılır, zəng avtomatik başlayır.
• 60 gündəlik mövzu. Hər mövzuda 8 söz, 3 idiom, 20 hazır sual və 12 foto — zəngə hazır gəl.
• Qısa dərslər. «Nə deyəcəyimi bilmirəm» probleminin cavabı: zəngi davam etdirən hazır cümlələr.
• AI təhlili. Zəngdən sonra tələffüzün, söz ehtiyatın və qrammatikan üzrə şəxsi hesabat al.
• AInur ilə praktika. Real insana hazır deyilsənsə, AI müəllimlə istənilən vaxt səsli məşq et.
• Zəngin içində oyunlar. Taboo və debat — danışmağı asanlaşdıran aktivliklər.
• Streak və reytinq. Hər gün danış, seriyanı böyüt, liderlər cədvəlində yüksəl.

🧪 NECƏ BAŞLAYIRSAN?
Qeydiyyatdan sonra komanda ilə 15 dəqiqəlik tanışlıq söhbəti — səviyyəni və həftəlik ritmini birlikdə müəyyən edirik. Ondan sonra canlı partnyor praktikası açılır.

💬 KİMLƏR ÜÇÜNDÜR?
İngiliscə oxuyub-yaza bilən, amma DANIŞMAĞA çəkinən hər kəs üçün.

Qeyd: tətbiqin interfeysi ingiliscədir — dil öyrənərkən ingiliscə mühitdə qalmaq üçün. Zəngdən sonrakı hesabat sənin dilində (az/tr) gəlir.

Bu gün danışmağa başla — SpeakLab səni gözləyir. 🚀

speaklab.az
```

### 8.3 Qrafika
- Telefon screenshot-ları: **`store_assets/phone/01..07`** (1080×1920, 2026-09-21, əsl tətbiqdən).
  Sıra: Today · Lessons · bir dərs · mövzu lüğəti · AInur şəkil təsviri · Live · Leaderboard.
- İkon və feature graphic dəyişməyib (`store_assets/app-icon-512.png`, `feature-graphic-1024x500.png`).

### 8.4 Yükləmə addımları (Play Console)
1. **Test → Internal testing** (və ya birbaşa Production) → *Create new release*.
2. AAB yüklə: **`SpeakLab-play-v19.aab`** (Desktop-da). versionCode 19 — əvvəlkindən böyük olmalıdır, yoxsa rədd edilir.
3. **Release name:** `1.9 (19)`. **Release notes (az-AZ):**
   ```
   • 60 mövzu — hər birində yeni sözlər, idiomlar, suallar və 12 foto
   • Yeni «Dərslər» bölməsi: zəngi davam etdirən hazır cümlələr
   • Tanışlıq zəngi artıq WhatsApp-da razılaşdırılır
   • Sürətli düzəlişlər: siyahıların sonu artıq alt menyunun altında qalmır
   ```
4. **Store listing → Phone screenshots:** köhnə 5-i sil, `store_assets/phone/`-dan 7-ni sıra ilə yüklə.
5. **Tam təsviri** §8.2-dəki mətnlə əvəz et (az-AZ; tr-TR səhifəsi istəsən sonra).
6. **App access** bölməsində test hesabı DƏYİŞMƏYİB: `speaklab.playreview@example.com` / `PlayReview2026!` — hesab canlıdır, girişi 2026-09-21-də yoxlanılıb.
7. *Review release* → *Start rollout*.

### 8.5 Yükləməzdən əvvəl telefonda
`SpeakLab-test-v19.apk` sideload üçündür və **upload açarı ilə** imzalanıb; Play versiyası Play-in açarı ilə imzalanır. Play buraxılışını quraşdırmazdan ƏVVƏL test APK-nı telefondan sil, yoxsa imza uyğunsuzluğu xətası verir.
