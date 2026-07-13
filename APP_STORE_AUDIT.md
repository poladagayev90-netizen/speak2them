# APP_STORE_AUDIT.md — SpeakLab Android / Play Store Hazırlıq Auditi

**Tarix:** 2026-07-12
**Audit növü:** Yalnız araşdırma — heç bir kod dəyişdirilməyib.
**Paket:** `com.speaklab.app` · Capacitor 8.4.1 · versionCode `1` / versionName `1.0`
**Yoxlanılan mühit:** Bu maşında JDK, Android SDK və ya Android Studio **yoxdur** (aşağıda 2.2-yə bax) — buna görə statik təhlil + `npx cap sync` icra edildi, `gradlew assembleDebug` icra edilə bilmədi.

---

## 0. XÜLASƏ — Ən kritik nəticə

**Bütün push/bildiriş sistemi yalnız WEB FCM üzərində qurulub (Firebase JS SDK + `firebase-messaging-sw.js` service worker). Native Android FCM ÜMUMİYYƏTLƏ YOXDUR.** Capacitor Android WebView-də Web Notifications/Push API dəstəklənmir, ona görə **Play Store-dan yüklənən APK-da bildirişlər 100% işləməyəcək**. "Bildiriş bəzən gəlir, bəzən gəlmir" şikayətinin kökü budur (ətraflı izah 1-ci bölmədə).

**Play Store bloklayıcıları (release-i dayandırır):**
| # | Bloker | Bölmə |
|---|--------|-------|
| B1 | Native push heç yoxdur (google-services.json + plugin + POST_NOTIFICATIONS) | 1 |
| B2 | Release signing / keystore konfiqurasiyası yoxdur | 3.1 |
| B3 | Privacy Policy (məxfilik siyasəti) linki yoxdur | 3.2 |
| B4 | Hesab silmə funksiyası yoxdur (Google Play tələbi) | 3.3 |

---

## 1. FCM / Push Notification — KÖK SƏBƏB (ƏSAS PROBLEM)

### 1.1 `android/app/google-services.json` — YOXDUR · **Bloker**
Fayl bütün `android/` ağacında mövcud deyil (`find` təsdiqlədi). `android/app/build.gradle` özü bunu etiraf edir:

```gradle
try {
    def servicesJSON = file('google-services.json')
    if (servicesJSON.text) { apply plugin: 'com.google.gms.google-services' }
} catch(Exception e) {
    logger.info("google-services.json not found ... Push Notifications won't work")
}
```

Fayl olmadığından `com.google.gms.google-services` plugini **tətbiq olunmur**. Native FCM üçün lazım olan Firebase infrastrukturu (sender ID, API açarları native tərəfdə) build-ə heç düşmür. *Qeyd: root `build.gradle`-də `com.google.gms:google-services:4.4.4` classpath var — yəni "hazır"dır, sadəcə fayl əlavə edilməyib.*

### 1.2 `@capacitor/push-notifications` plugini — QURAŞDIRILMAYIB · **Bloker**
- `package.json`-da yoxdur (yalnız safe-area, speech-recognition, keyboard, splash-screen, status-bar).
- `npx cap sync android` çıxışı yalnız **5 plugin** tapdı — push plugini siyahıda yoxdur.
- Yəni native Android tərəfdə `PushNotifications.register()`, token alma, `pushNotificationReceived` listener — heç biri yoxdur.

### 1.3 `AndroidManifest.xml` — POST_NOTIFICATIONS icazəsi YOXDUR · **Bloker**
`android/app/src/main/AndroidManifest.xml`-də yalnız bu icazələr var:
```
INTERNET · RECORD_AUDIO · MODIFY_AUDIO_SETTINGS
```
Android 13+ (API 33+) üçün məcburi olan `android.permission.POST_NOTIFICATIONS` **yoxdur**. Native push əlavə edilsə belə, Android 13+ cihazlarda bildiriş göstərilə bilməz.

### 1.4 KÖK SƏBƏBİN İZAHI — nə üçün "bəzən gəlir, bəzən gəlmir"

Bütün push məntiqi **web** tərəfdədir (`src/firebase.js`, `public/firebase-messaging-sw.js`). Bunun iki nəticəsi var:

**(A) Native APK istifadəçiləri üçün — heç vaxt gəlməz.**
Capacitor Android System WebView-də `window.Notification` **undefined**-dir və Web Push API dəstəklənmir. Kod bunu özü yoxlayır və səssizcə dayanır:
- `src/components/NotificationPrompt.jsx:36` → `if (typeof Notification === 'undefined') return;` — banner heç görünmür.
- `src/firebase.js:90,111` → `isSupported()` false qaytarır → `refreshFcmToken`/`enableNotifications` heç token yazmır.
- Nəticə: APK istifadəçisinin Firestore `users/{uid}.fcmToken` sahəsi **heç vaxt yazılmır**, ona push getmir.

**(B) Web / PWA istifadəçiləri üçün — gəlir, amma kövrəkdir (əsas "bəzən" səbəbi).**
1. **Tək token, üstünə yazılır.** `src/firebase.js:61` → `setDoc(..., { fcmToken: token }, { merge:true })` istifadəçi başına **bir** `fcmToken` sahəsi saxlayır. İkinci cihaz/brauzer girəndə köhnə token üzərinə yazılır → əvvəlki cihaz səssizcə bildiriş almağı dayandırır. Çoxlu cihaz = yalnız sonuncu işləyir.
2. **Token köhnəlməsi (rotation) proaktiv idarə olunmur.** FCM tokenləri vaxtaşırı yenilənir/etibarsızlaşır. Yenilənmə YALNIZ tətbiq açılanda baş verir (`src/App.js:162` → `refreshFcmToken(uid)`). Token tətbiq bağlı ikən rotasiya olarsa və istifadəçi tətbiqi açmazsa, Firestore-dakı token **köhnə** qalır → göndəriş səssizcə uğursuz olur. `onTokenRefresh` tipli aktiv listener yoxdur.
3. **Uğursuz göndərişdə token silinir.** `functions/index.js` (məs. `:243, :321, :1632, :1857`) uğursuz göndərişdən sonra `fcmToken: FieldValue.delete()` edir. Yəni bir dəfə köhnə tokenlə uğursuzluq → token tamamilə silinir → istifadəçi tətbiqi **yenidən açana** qədər heç bir bildiriş almır. Bu, "bir müddət gəlmir" hissini birbaşa yaradır.
4. **Service worker scope kövrəkliyi.** `src/firebase.js:38-43` şərhi özü izah edir: Workbox SW ilə messaging SW eyni scope-da toqquşduqda push abunəliyi dağılır. Ayrı scope verilib, amma bu, brauzerin SW-ni "evict" etməsi (xüsusən mobil Chrome/iOS-da) riskini aradan qaldırmır.
5. **iOS PWA məhdudiyyətləri.** iOS-da yalnız "Add to Home Screen" edilmiş PWA-da push var; adi Safari tabında yoxdur — istifadəçilərin bir hissəsi heç vaxt almır.

> **Praktik nəticə:** Əgər şikayət edən istifadəçilər **APK** işlədirsə → bildiriş heç vaxt işləməyib (kök: 1.1–1.3, web-only arxitektura). Əgər **PWA/brauzer** işlədirsə → 1.4(B)-dəki token idarəçiliyi problemlərinə görə "bəzən" işləyir. Hər iki halda düzəliş üçün native `@capacitor/push-notifications` + `google-services.json` + POST_NOTIFICATIONS lazımdır.

---

## 2. Build Sağlamlığı

### 2.1 `npx cap sync android` — TƏMİZ keçdi · **problem yoxdur**
```
√ copy android · √ update android · Sync finished in 0.191s
Found 5 Capacitor plugins: safe-area, speech-recognition, keyboard, splash-screen, status-bar
```
Xəta/xəbərdarlıq yoxdur. (Push plugininin siyahıda olmaması 1.2-də qeyd olunub.)

### 2.2 `./gradlew assembleDebug` — İCRA EDİLƏ BİLMƏDİ · **Orta (yoxlama boşluğu)**
Bu maşında build zənciri quraşdırılmayıb, ona görə build-in keçib-keçmədiyi **təsdiqlənə bilmədi**:
- `java` PATH-da yoxdur; `JAVA_HOME` boşdur.
- `ANDROID_HOME` / `ANDROID_SDK_ROOT` boşdur; `%LOCALAPPDATA%\Android\Sdk` yoxdur.
- Android Studio quraşdırılmayıb (`Program Files\Android\Android Studio\jbr` yoxdur).
- `android/local.properties` yoxdur (SDK yolu təyin edilməyib).

**Tövsiyə:** Build-i JDK 21 + Android SDK (API 36) olan maşında yoxlamaq lazımdır. `capacitor.build.gradle` Java 21 tələb edir (`VERSION_21`) — build maşınında JDK 21 olmalıdır.

### 2.3 Statik build konfiqurasiya müşahidələri
- **Konfiqurasiya versiyaları uyğundur (problem yox):** AGP `8.13.0`, Capacitor `8.4.1`, `minSdkVersion 24`, `compileSdk/targetSdk 36`, cordova-android `14.0.1`. minSdk 24 və target 36 Play-in cari (API 35+) tələbini ödəyir. Köhnəlmiş plugin/minSdk uyğunsuzluğu **tapılmadı**.
- **`usesCleartextTraffic="true"`** — `AndroidManifest.xml:11` + `capacitor.config.ts` `cleartext:true`. HTTP (şifrəsiz) trafikə icazə verir. Funksional bloker deyil, amma Play təhlükəsizlik baxışında flaq ola bilər və lazımsızdır (bütün backend HTTPS-dir). · **Kiçik**
- **`android:allowBackup="true"`** — `AndroidManifest.xml:5`. İstifadəçi datası cihaz backup-ında sıza bilər. · **Kiçik**
- **`minifyEnabled false`** — `android/app/build.gradle:20`. Release-də kod kiçildilməsi/ProGuard yoxdur; APK/AAB böyük olur. Bloker deyil. · **Kiçik**

---

## 3. Play Store Bloklayıcıları

### 3.1 Release signing / keystore — YOXDUR · **Bloker**
`android/app/build.gradle` `release` blokunda `signingConfig` **yoxdur**; layihədə heç bir `.jks`/`.keystore` və ya `signingConfigs` tapılmadı. İmzasız (yaxud yalnız debug ilə imzalanmış) AAB Play Console-a yüklənə bilməz. **Lazım:** upload keystore yaradıb `signingConfigs.release` təyin etmək (və Play App Signing-ə qoşulmaq).

### 3.2 Privacy Policy (Məxfilik siyasəti) — YOXDUR · **Bloker**
- Tətbiq daxilində heç bir "Privacy/Məxfilik" linki tapılmadı (`src/` üzrə axtarış boş).
- `public/`-də `privacy`/`terms`/`policy` faylı yoxdur.
Play Console listing üçün ictimai Privacy Policy URL-i **məcburidir** (xüsusən mikrofon + hesab məlumatı toplandığı üçün). Həm store listing-də, həm tətbiq daxilində link olmalıdır.

### 3.3 Hesab silmə funksiyası — YOXDUR · **Bloker**
`src/pages/Profile.jsx`-də yalnız `handleLogout` var; hesab silmə YOXDUR. `functions/index.js`-də `admin.auth().deleteUser` və ya hesab/data silmə endpoint-i yoxdur (yalnız `verifyIdToken`). Google Play, hesab yaradan tətbiqlər üçün **həm tətbiq daxilində, həm də veb üzərindən** hesab (və data) silmə yolu tələb edir. · **Bloker**

### 3.4 Data Safety bəyanı üçün toplanan data / icazə siyahısı
Aşağıdakılar kodda təsdiqləndi — Play "Data Safety" formasında bəyan edilməlidir:

| Data / icazə | Mənbə (kod) | Data Safety kateqoriyası |
|---|---|---|
| Mikrofon / audio | `RECORD_AUDIO` (Manifest + speech-recognition plugin), Agora RTC (`agora-rtc-sdk-ng`) | Audio (səsli zənglər), real-time danışıq |
| Ad, e-poçt, foto | Google Sign-In → `src/App.js:153-160` Firestore `users/{uid}` | Personal info (name, email), Photos |
| FCM token | `src/firebase.js:61` `users/{uid}.fcmToken` | Device/other IDs |
| İstifadə/aktivlik | streak, history, ranking (Firestore) | App activity |
| Şəbəkə | `INTERNET`, `MODIFY_AUDIO_SETTINGS` | — (infrastruktur) |
| İstifadəçi mətn/nitq → AI | `@google/generative-ai` (Gemini), `src/pages/AIChat.jsx` | Üçüncü tərəfə ötürülən məzmun |

**Üçüncü tərəflər (bəyan edilməli):** Firebase/Google (Auth, Firestore, FCM, Functions), Agora (audio RTC), Google Generative AI / Gemini (istifadəçi mətni/nitqi emal olunur). Mikrofon + audio üçün istifadəçiyə niyə lazım olduğu izah edilməli (runtime permission rationale).

---

## 4. versionCode / versionName — Hazırkı vəziyyət
`android/app/build.gradle`:
```
versionCode 1
versionName "1.0"
```
İlk release üçün qəbul edilə bilər. Qeyd: Capacitor default dəyərləridir, hələ heç artırılmayıb — hər Play yükləməsində `versionCode` artırılmalıdır (əks halda ikinci yükləmə rədd edilir).

---

## 5. Ümumi Prioritet Siyahısı

**Release-dən əvvəl mütləq (Bloker):**
1. Push arxitekturasını həll et: native `@capacitor/push-notifications` + `google-services.json` + `POST_NOTIFICATIONS` (bax 1) — həm də mövcud web token idarəçiliyindəki multi-device/rotation problemlərini (1.4B) düzəlt.
2. Release keystore + `signingConfigs.release` (3.1).
3. Privacy Policy URL + tətbiq daxili link (3.2).
4. Hesab silmə (tətbiq içi + veb) (3.3).

**Orta:**
5. Build-i real JDK21/SDK36 mühitində `assembleRelease` ilə yoxla (2.2).
6. Data Safety formasını 3.4-ə əsasən doldur.

**Kiçik:**
7. `usesCleartextTraffic` / `cleartext` sil (2.3), `allowBackup="false"` düşün, release üçün `minifyEnabled` düşün, hər yükləmədə `versionCode` artır.

---
*Bu audit yalnız statik təhlil + `cap sync`-ə əsaslanır. `gradlew` build-i bu mühitdə icra edilə bilmədi (2.2) — funksional build təsdiqi ayrıca lazımdır.*
