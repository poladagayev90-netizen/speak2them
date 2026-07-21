# SpeakLab — Play Store Listinq Paketi

**Məqsəd:** Verifikasiya gözlənilərkən Play Console-a hazır, kopyala-yapışdır mətnlər + qrafika spesifikasiyaları + anket cavabları.
**Paket:** `com.speaklab.app` · versionCode 1 / versionName 1.0
**Default dil:** Azərbaycan (az-AZ). İngilis (en-US) versiyası da aşağıda — istəsən əlavə dil kimi qoşarsan.

---

## 1. HAZIRLIQ DURUMU

| Element | Status | Qeyd |
|---|---|---|
| İmzalı AAB | ✅ Hazır | `android/app/build/outputs/bundle/release/app-release.aab` |
| Privacy Policy URL | ✅ Canlı (200) | https://speaklab-app.vercel.app/privacy.html |
| Hesab silmə URL | ✅ Canlı (200) | https://speaklab-app.vercel.app/delete-account.html |
| App icon 512×512 | ✅ Hazır | `public/logo512.png` (512×512, 32-bit PNG, 50KB) |
| Başlıq / qısa / tam təsvir | ✅ Bu sənəddə | §2 |
| Content rating cavabları | ✅ Bu sənəddə | §4 |
| Data Safety cavabları | ✅ Bu sənəddə | §5 |
| **Feature graphic 1024×500** | ❌ **Lazımdır** | Canva — §3 |
| **Telefon screenshot-ları (min 2)** | ❌ **Lazımdır** | Canva mockup — §3 |

**Nəticə:** yükləmə üçün yalnız **2 vizual** çatışmır (feature graphic + screenshot-lar). Qalan hər şey hazırdır.

---

## 2. MAĞAZA MƏTNLƏRİ (kopyala-yapışdır)

### Başlıq (max 30 simvol)
```
SpeakLab — İngilis Danışıq
```
*(26 simvol)*

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

1. AAB yüklə: `app-release.aab` (versionCode 1).
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
