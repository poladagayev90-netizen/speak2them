# SpeakLab: Technical Handoff Report

Bu sənəd layihəni təhvil alacaq növbəti AI mühəndis (Claude/Fable) üçün SpeakLab layihəsinin mövcud vəziyyətinin tam texniki xülasəsidir. Layihə React (PWA), Firebase (Auth, Firestore, Cloud Functions), Agora RTC, Capacitor (Android) və müxtəlif süni intellekt xidmətlərindən (Groq, Deepgram, DeepSeek, OpenAI) istifadə edir.

---

## 1. ARXİTEKTURA XÜLASƏSİ

### Əsas Qovluq Strukturu
- **`/src`**: React frontend kodları (SPA/PWA). 
  - `/components`: Təkrar istifadə edilə bilən UI elementləri (`GuidedTour.jsx`, `TranslateWidget.js`, `BottomNav.jsx` və s.).
  - `/pages`: Əsas səhifələr (`Home.jsx`, `Chat.jsx`, `History.jsx`, `MatchMaking.jsx`, `AIChat.jsx` və s.).
  - `/utils`: Köməkçi funksiyalar və API çağırışları (`analyzeWithOpenAI.js`, `matchmaking.js`, `localRecorder.js`).
- **`/functions`**: Firebase Cloud Functions (Node.js). Bütün arxa plan məntiqi (backend) buradadır.
- **`/android`**: Capacitor tərəfindən idarə olunan Native Android proyekt faylları.
- **`/public`**: Statik fayllar (`manifest.json`, PWA ikonları, `index.html`).

### Firebase Firestore Strukturu (Sxemlər)
Layihə `firestore.rules` ilə qorunan aşağıdakı əsas collection-lardan ibarətdir:
- **`users`**: İstifadəçi profilləri. Sahələr: `name`, `email`, `level` (məs. 'B1'), `isPremium` (boolean), `premiumPlan`, `callCount`, `totalMinutes`, `fcmToken`, `tourDone_home`/`tourDone_chat`/`tourDone_profile` (boolean).
- **`premiumRequests`**: Premium olmaq üçün adminə göndərilən sorğular. Sahələr: `uid`, `status` ('pending', 'approved'), `userName`, `userEmail`.
- **`calls`**: Agora zəng seansları. Sahələr: `callerId`, `receiverId`, `userA`, `userB`, `status`, `channelName`.
- **`chats` & `chats/{chatId}/messages`**: P2P mətn mesajlaşması. `chatId` istifadəçi UID-lərinin birləşməsindən (`uid1_uid2`) yaranır.
- **`matchQueue`**: Matching (həmsöhbət axtarışı) növbəsi. Sahələr: `status` ('searching', 'matched'), `matchedWith`, `timestamp`.
- **`callAnalysis`**: Zəng bitdikdən sonra AI tərəfindən edilən təhlillər. Sahələr: `grammarFixes` (array), `vocabularyUsed`, `overallScore`, `fluencyScore`.
- **`wordHistory/{userId}/words/{wordId}`**: İstifadəçinin öyrəndiyi/tərcümə etdiyi sözlərin tarixçəsi.

### Cloud Functions Siyahısı (`functions/index.js`)
- **`getAgoraToken`** (HTTP): Agora zəngi üçün təhlükəsiz RTC token generasiya edir. (Giriş: `channelName`).
- **`telegramWebhook`** (HTTP): Telegram botundan gələn mesajları dinləyir (`/start` komandası) və cavablayır.
- **`broadcastMessage`** (HTTP): Bütün istifadəçilərə (və Telegram kanalına) admin tərəfindən kütləvi mesaj göndərir.
- **`sendCallNotification`** (HTTP): Zəng gəldikdə istifadəçinin Telegram hesabına bildiriş göndərir.
- **`topicReminder`** (Pub/Sub Schedule): Hər gün saat 10:00 və 15:00-da FCM (Push Notification) vasitəsilə "Günün Mövzusu"nu göndərir.
- **`analyzeCallOpenAI`** (HTTP): Audio blobu qəbul edir, Groq Whisper ilə mətnə çevirir və Llama-3.1-8b ilə qrammatika/analiz edir (Müvəqqəti server-side analiz endpointi).
- **`updatePeerStats`** (HTTP): Zəng sonrası istifadəçilərin bir-birinə verdiyi xalları (rating) təhlükəsiz şəkildə bazaya yazır.
- **`chatWithAI`** (HTTP): "AInur" süni intellekt botu ilə səsli söhbət. Giriş: `base64Audio`. Proses: Groq Whisper (STT) → Groq Llama-3.1 (LLM) → Deepgram Aura (TTS) → Çıxış: `audioBase64`.

---

## 2. DATA AXINI (AUDIO ANALİZ VƏ MATCHING NÖVBƏSİ)

### Zəng və Analiz Axını (Call to Analysis)
1. **Matching & Join**: `src/utils/matchmaking.js` Firestore `matchQueue` collection-na yazır. İki uyğun istifadəçi tapıldıqda eyni `channelName` ilə `calls` yaradılır. `AgoraRTC.createClient()` ilə kanala qoşulurlar.
2. **Recording**: `src/utils/localRecorder.js` vasitəsilə istifadəçinin mikrofonundan (MediaRecorder API) səs lokal olaraq `.webm` formatında yazılır.
3. **Transcription & Analysis (Frontend Strategy)**: Zəng bitdikdə `src/utils/analyzeWithOpenAI.js` işə düşür.
   - *STT*: Səs blobu birbaşa OpenAI Whisper API-nə (`https://api.openai.com/v1/audio/transcriptions`) göndərilir.
   - *LLM*: Alınan mətn (transcript) DeepSeek API-nə (`https://api.deepseek.com/v1/chat/completions`) göndərilərək qrammatika, lüğət və xal hesablanması (JSON formatında) istənilir.
4. **Storage**: Əldə edilən JSON nəticəsi birbaşa Firestore `callAnalysis` collection-na yazılır və History (Analiz Tarixçəsi) səhifəsində göstərilir.

### Matching Queue (Növbə Sistemi)
- **Texnologiya**: Xüsusi Cloud Tasks istifadə edilmir; birbaşa **Firestore-based polling** mexanizmidir.
- **Axın**: İstifadəçi `matchQueue` collection-da sənəd yaradır. `onSnapshot` vasitəsilə Firestore dinlənilir. `MatchMaking.jsx` daxilindəki frontend logikası digər gözləyən istifadəçiləri çəkir və uyğunluq (level, dil) tapıldıqda hər iki sənədin `status`-unu 'matched' edir.
- **Retry/Timeout**: Əgər 30-60 saniyə ərzində kimsə tapılmazsa, istifadəçiyə "AInur (AI bot) ilə danışmaq istəyirsənmi?" təklifi çıxır. 

---

## 3. HƏLL OLUNMUŞ PROBLEMLƏR (Son dövrlər)

1. **Vercel CI/CD Build Xətası (ESLint & Export Mismatch)**
   - *Problem*: Vercel deployment uğursuz olurdu.
   - *Səbəb*: `react-joyride` v3 `default export` əvəzinə `named export` istifadə edirdi və `Chat.jsx`-də istifadəsiz dəyişənlər qaldığı üçün CI (Continuous Integration) xəta verirdi.
   - *Həll*: `GuidedTour.jsx` daxilində `import { Joyride }` olaraq düzəldildi, istifadəsiz `WordHistoryPanel` silindi.
2. **Guided Tour (Bələdçi Tur) İlişib Qalma Xətası**
   - *Problem*: Tur bir dəfə göstərildikdən sonra ekranda bloklanırdı və getmirdi.
   - *Səbəb*: React state-nin yenilənməməsi və Firebase-ə `tourDone` flag-nin asinxron gecikməsi.
   - *Həll*: UI yenidən quruldu, Glassmorphism dizayn verildi. Tour state idempotent edildi və bitən kimi lokal state ilə dərhal unmount edilib, Firestore-a `merge: true` ilə yazıldı.
3. **Android (PWA/Capacitor) Ağ Splash Ekranı**
   - *Problem*: Proqram açıldıqda Vercel dizaynından əvvəl ağ, boş bir ekran (Native Splash) görünürdü.
   - *Səbəb*: Capacitor-un default native splash screen konfiqurasiyası ağdır və xüsusi plagin quraşdırılmamışdı.
   - *Həll*: `@capacitor/splash-screen` plagini yükləndi. `capacitor.config.ts`-də `launchShowDuration: 0` və `backgroundColor: "#0f0f17"` edildi. *Qeyd: Bunun telefonda işləməsi üçün Android Studio-dan yeni APK build edilməlidir.*

---

## 4. BİLİNƏN AÇIQ MƏSƏLƏLƏR / TODO (Technical Debt)

1. **Frontend-də Hardcoded API Açarları (Kritik Təhlükəsizlik Borcu)**
   - *Problem*: `src/utils/analyzeWithOpenAI.js` faylında OpenAI və DeepSeek API key-ləri `process.env.REACT_APP_...` kimi birbaşa frontend-dədir. React-də `REACT_APP_` ilə başlayan dəyişənlər müştəri (client) tərəfinə ötürülür və brauzerdə görünə bilir.
   - *TODO*: Bu analiz prosesi tamamilə Cloud Function-a (məsələn hazırda mövcud olan `analyzeCallOpenAI` funksiyasına) keçirilməlidir. Frontend yalnız audio blobu göndərməli, API key-lər yalnız backend-də (`.env` server-side) qalmalıdır.
2. **PWA Splash Ekranı (iOS Safari Problemi)**
   - *Problem*: Safari brauzerində PWA (Add to Home Screen) kimi yüklənəndə `manifest.json`-dakı `background_color` bəzən nəzərə alınmır və ağ ekran verir.
   - *TODO*: `index.html` daxilinə iOS üçün xüsusi `<link rel="apple-touch-startup-image">` taqları generasiya edilib qoyulmalıdır.
3. **Firestore Matching Race Condition**
   - *Problem*: Firestore-based matching eyni anda 3 istifadəçi axtarışa girəndə nadir hallarda race condition (ikili eşləşmə) yarada bilər.
   - *TODO*: Bunu Firestore Triggers (onWrite) və ya Redis bazalı server-side queue ilə əvəz etmək daha dayanıqlı olar.

---

## 5. ASILILIQLAR VƏ VERSİYALAR (`package.json`)

**Frontend:**
- `react` & `react-dom`: **^19.2.5** (Ən son React 19 xüsusiyyətləri üçün)
- `agora-rtc-sdk-ng`: **^4.24.3** (Zənglər və WebRTC üçün ən stabil 4.x versiyası)
- `firebase`: **^12.12.1** (Modular V9+ API)
- `react-joyride`: **^3.1.0** (Tur bələdçisi üçün. Diqqət: v3-də default export ləğv edilib)
- `@capacitor/core` & plaginlər: **^8.4.1** (Mobil native inteqrasiya üçün son versiya)

**Backend (Functions):**
- `firebase-functions`: **^7.0.0** (V2 Cloud Functions üçün)
- `firebase-admin`: **^13.6.0**
- *Qeyd*: Backend-də API zəngləri üçün əlavə SDK (OpenAI/Deepgram) yüklənməyib, çünki birbaşa native `fetch` (Node 18+) istifadə edilir, bu da paket ölçüsünü və cold-start vaxtını azaldır.

**Xarici API-lər:**
- **Agora**: Təkə-tək səsli zənglər.
- **Groq**: AInur botunda Whisper-large-v3-turbo (STT) və Llama-3.1 (LLM) üçün. Çox sürətli olduğu üçün səsli söhbət botunda (latency) istifadə edilir.
- **Deepgram**: Aura Asteria (Voice) TTS modeli. Real-time səs sintezi üçündür.
- **DeepSeek**: Zəng bitdikdən sonra qrammatika təhlili üçün. Səbəb: Qiymət/Performans nisbəti qrammatik analizdə çox yüksəkdir.
- **OpenAI**: Hazırda Whisper STT üçün frontend-də istifadə edilir (Technical Debt).

---

## 6. ENVIRONMENT VƏ DEPLOYMENT

### .env Dəyişənləri (Root/Frontend)
*(Aşağıdakılar Vercel platformasında daxil edilməlidir)*
- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`
- `REACT_APP_AGORA_APP_ID`
- `REACT_APP_OPENAI_API_KEY` (Tezliklə ləğv edilməlidir)
- `REACT_APP_DEEPSEEK_API_KEY` (Tezliklə ləğv edilməlidir)

### Cloud Functions Secrets (Backend)
*(Firebase Secret Manager vasitəsilə saxlanılır: `firebase functions:secrets:set`)*
- `TELEGRAM_BOT_TOKEN`, `AGORA_APP_CERTIFICATE`, `BROADCAST_ADMIN_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `DEEPGRAM_API_KEY`

### Deployment Prosesi
- **Frontend (Vercel)**: GitHub repository (`main` branch) Vercel-ə bağlıdır. Commit push edildikdə avtomatik `npm run build` işləyir və deploy olunur. `CI=true` olduğu üçün istənilən ESLint warning-i build-i qırır.
- **Backend (Firebase)**: `firebase deploy --only functions` komandası ilə lokal kompyuterdən serverə göndərilir.
- **Android/Capacitor**: Web build edildikdən sonra `npx cap sync` edilir. Hazırda debug signing var. Play Store-a çıxmaq üçün:
  1. `build.gradle` içində `versionCode` və `versionName` artırılmalıdır.
  2. Android Studio-da `Generate Signed Bundle / APK` ilə release `.aab` çıxarılmalı və KeyStore ilə imzalanmalıdır.

---

## 7. QƏRAR VERİLMİŞ AMMA RƏDD EDİLMİŞ YANAŞMALAR

1. **NVIDIA Parakeet ASR ilə STT (Speech-to-Text)**
   - *Niyə rədd edildi?*: Dəqiqliyi yüksək olsa da, API gecikməsi (latency) canlı səsli söhbət botu (AInur) üçün çox idi və quraşdırma mürəkkəb idi. Bunun əvəzinə **Groq tərəfindən host edilən Whisper-large-v3-turbo** istifadə edildi. Groq-un LPU arxitekturası sayəsində transkripsiya millisaniyələr ərzində başa çatır.
2. **Firestore Triggers ilə Real-Time Audio Analiz**
   - *Niyə rədd edildi?*: Audioları Storage-ə yükləyib onWrite trigger-i ilə analiz etmək Firestore/Storage xərclərini artırırdı. İndi audio yalnız lazımi vaxtda RAM-da yığılıb birbaşa API-yə atılır, Storage xərcləri 0-a endirilir. (Lakin bu, frontend API key məsələsini yaratdı, hansı ki refactor olunacaq).
3. **Təlimat Turu üçün Yeni Paket (Məs. driver.js)**
   - *Niyə rədd edildi?*: İstifadəçi dizaynı bəyənmədikdə yeni paket əlavə etmək (driver.js) nəzərdən keçirildi. Lakin layihə həcmini artırmamaq üçün mövcud `react-joyride` saxlanıldı və `GuidedTour.css` faylı yaradılaraq tamamilə sıfırdan "Glassmorphism" və "Neon" stilləri ilə Custom Tooltip yazıldı.
