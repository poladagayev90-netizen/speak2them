# SPEAK2THEM — FAZA 1 AUDİT HESABATI

**Tarix:** 2026-07-07 · **Branch:** `fable-refactor` (tag: `pre-fable-audit`) · **Kod dəyişdirilməyib — yalnız audit.**

Ciddiyyət şkalası: 🔴 **Kritik** · 🟡 **Orta** · 🔵 **Kiçik**

---

## 1. `analyzeWithOpenAI.js` — dead code təsdiqi

**Nəticə: BƏLİ, dead code-dur, silinməsi təhlükəsizdir — AMMA silmək açar sızmasını HƏLL ETMİR (bax bölmə 2).**

| Yoxlama | Nəticə |
|---|---|
| `analyzeWithOpenAI` adına import | Heç bir `.js/.jsx` faylında yoxdur (yalnız `HANDOFF_REPORT.md`-də ad çəkilir — sənəd köhnəlib) |
| Export etdiyi `analyzeCallAudio` funksiyasının importu | Heç yerdə import olunmur. Eyni adlı funksiyanı `src/utils/analyzeWithGemini.js:8` də export edir — **o da import olunmur, o da dead code-dur** |
| Real analiz axını | `src/pages/Chat.jsx:523` → Cloud Function `analyzeCallOpenAI` (`functions/index.js:348`) — server tərəfli Groq proxy. Frontend faylı bypass olunub |

**Əlaqəli dead code (birlikdə silinə bilər):**

| Fayl | Sətir | Ciddiyyət | Qeyd |
|---|---|---|---|
| `src/utils/analyzeWithOpenAI.js` | bütöv fayl | 🟡 Orta | Dead code + içində 2 client-side açar istinadı |
| `src/utils/analyzeWithGemini.js` | bütöv fayl | 🔵 Kiçik | Eyni adlı export, import olunmur |
| `api/analyze-call.js` | bütöv fayl | 🔵 Kiçik | Vercel funksiyası; `src`-də `/api/analyze-call` çağırışı yoxdur |
| `api/generate-quiz.js` | bütöv fayl | 🔵 Kiçik | `src`-də `/api/generate-quiz` çağırışı yoxdur; quiz birbaşa client-dən DeepSeek-ə gedir (bax 2.3) |
| `HANDOFF_REPORT.md` | 13, 45, 77 | 🔵 Kiçik | Sənəd real arxitekturanı əks etdirmir (frontend analiz strategiyası köhnəlib) |

---

## 2. API açarlarının bundle-a sızması

**Nəticə: TƏSDİQLƏNDİ — hər iki açar bugünkü (2026-07-07 09:16) production build-in içindədir.**

### 2.1 Build output-da tapılanlar

`grep` ilə `build/static/js/` yoxlanıldı — **açarların tam dəyərləri** bu fayllardadır:

| Açar | Tapıldığı fayllar | Ciddiyyət |
|---|---|---|
| `REACT_APP_OPENAI_API_KEY` (`sk-proj-AC0h…`) | `build/static/js/main.5813093b.js`, `411.bba49876.chunk.js` | 🔴 **Kritik** |
| `REACT_APP_DEEPSEEK_API_KEY` (`sk-9434…`) | `build/static/js/main.5813093b.js`, `411.bba49876.chunk.js` | 🔴 **Kritik** |
| `REACT_APP_AGORA_APP_ID` | `main.js` + chunk-lar | 🔵 Kiçik (App ID publik ola bilər, token serveri var) |

### 2.2 KRİTİK NÜANS: fayl silmək kifayət etmir

Bundle-da açarlar **tam env obyekti şəklində** inline olunub:
`{…, REACT_APP_OPENAI_API_KEY:"sk-proj-…", …}` — bu, CRA (`react-scripts`) DefinePlugin davranışıdır: build zamanı mövcud olan **BÜTÜN** `REACT_APP_*` dəyişənləri, fayl import olunub-olunmamasından asılı olmayaraq bundle-a düşür. `src`-də bütöv `process.env` istifadəsi yoxdur — yəni `analyzeWithOpenAI.js`-i silsək belə, açar `.env`-də qaldıqca yenidən bundle-a düşəcək.

**Tələb olunan addımlar (FAZA 2 üçün):**
1. `REACT_APP_OPENAI_API_KEY` və `REACT_APP_DEEPSEEK_API_KEY` sətirlərini `.env`-dən (və Vercel env-dən, varsa) **tamamilə sil**.
2. **Hər iki açarı ləğv et (rotate)** — səbəblər:
   - OpenAI açarı git tarixçəsinə düşüb: `62da01b`, `4870ec8` commit-ləri (`git log -S` ilə təsdiqləndi).
   - DeepSeek açarı git-də yoxdur, amma deploy olunmuş publik JS-dədir — artıq sızmış sayılır.
3. Yenidən build + deploy.

### 2.3 Əlaqəli açar problemləri

| Fayl | Sətir | Ciddiyyət | Problem |
|---|---|---|---|
| `functions/index.js` | 14 | 🔴 **Kritik** | Deepgram açarı **hardcoded fallback** kimi mənbə kodadır və git tarixçəsindədir (`9008c3e`). Secret-ə köçürülməli və rotate edilməli |
| `src/utils/aiQuizGenerator.js` | 4, 37 | 🔴 **Kritik** | **Canlı feature** (`PostCallQuizModal.jsx:2` import edir) birbaşa client-dən DeepSeek-ə açarla müraciət edir. Açar silinsə quiz funksiyası sınacaq → server proxy-yə (`chatWithAI` üslubunda) köçürülməlidir |
| `.env.production` | 1-7 | 🔵 Kiçik | Git-də izlənir; hazırda yalnız publik config var (Firebase web config publikdir), amma bu fayla vərdişlə gizli açar əlavə olunma riski var |

---

## 3. Client-side jitter/retry — Groq rate-limit riski

**Kod:** `src/pages/Chat.jsx:516-548` — zəng bitəndə: 0–20 san uniform jitter → `analyzeCallOpenAI` → uğursuzluqda 3 cəhd, sabit 5 san fasilə.

### Ədədi qiymətləndirmə (100 paralel zəngin eyni anda bitməsi)

Vacib vurğu: **100 zəng = 200 istifadəçi** — hər iki tərəf öz yazısını ayrıca göndərir, yəni 200 sorğu.

Groq limitləri (free tier, təxmini — dəqiq rəqəmlər console.groq.com-dan yoxlanmalıdır):
- `whisper-large-v3-turbo`: ~20 RPM, **~7 200 audio-saniyə/saat**
- `llama-3.1-8b-instant`: ~30 RPM, ~6 000 TPM

**a) RPM toqquşması:**
- 200 sorğu / 20 san jitter pəncərəsi = 10 sorğu/san = **600 RPM pik** → 20–30 RPM limitinin **20–30 misli**.
- İlk cəhddə uğur ehtimalı ≈ 20/600 ≈ **3%**.
- Retry-lar da faydasızdır: 3 cəhd × 5 san = bütün trafik ~35 saniyəlik pəncərəyə sıxılır. Bu pəncərədə limit ~12–18 sorğu buraxır → **200 sorğudan ~185-i (≈92%) qəti uğursuz**.

**b) Audio-saniyə limiti (daha sərt məhdudiyyət):**
- 30 dəq zəng = 1 800 audio-san/istifadəçi. 200 istifadəçi = **360 000 audio-san** vs saatlıq limit 7 200.
- Yəni jitter mükəmməl işləsə belə, saatda cəmi **~4 transkripsiya** keçir → **uğur nisbəti ≤2%**. Jitter-i 20 dəqiqəyə qaldırmaq da kömək etmir — limit hesab səviyyəsindədir (bütün istifadəçilər tək GROQ_API_KEY paylaşır).

**Nəticə: 100+ paralel zəng ssenarisində toqquşma ehtimalı praktiki olaraq 100%-dir; free tier-də analizlərin ~90–98%-i itiriləcək.** Dev/paid tier-də audio-saniyə limiti xeyli artır, amma 600 RPM pik yenə mövcud RPM limitlərini aşa bilər.

### Mexanizmin konkret qüsurları

| Fayl | Sətir | Ciddiyyət | Problem |
|---|---|---|---|
| `src/pages/Chat.jsx` | 518 | 🟡 Orta | 20 san jitter pəncərəsi yükə görə ən azı 10× kiçikdir; ümumiyyətlə client-side spreading hesab-səviyyəli limiti həll edə bilməz |
| `src/pages/Chat.jsx` | 531-535 | 🟡 Orta | `!res.ok` olan **hər** statusda retry — 400 (“audio too small”) kimi qəti xətaları da 3 dəfə təkrarlayır; hər cəhddə çox-MB-lıq base64 body yenidən göndərilir |
| `src/pages/Chat.jsx` | 533, 541 | 🟡 Orta | Sabit 5 san backoff, eksponensial artım və retry-jitter yoxdur; Groq-un `Retry-After` başlığı oxunmur (server cavabı `functions/index.js:383-385` onsuz da 429-u 500-ə çevirib məlumatı itirir) |
| `functions/index.js` | 348, 383 | 🟡 Orta | Proxy 429-u ayırd etmir, server tərəfi növbə/queue yoxdur. Düzgün həll: audio-nu Storage-a yükləyib Cloud Tasks/queue ilə emal etmək |
| `src/components/CallInsights.js` | 18 | 🟡 Orta | 60 san timeout vs (20 san jitter + 3×5 san retry + emal) — insights ekranı tez-tez boş görünəcək |

---

## 4. Render xətaları / listener cleanup / memory leak riskləri

### 🔴 Kritik

| # | Fayl | Sətir | Problem |
|---|---|---|---|
| 4.1 | `src/pages/Chat.jsx` | 118-402 (bütün effektlər) | **Unmount cleanup YOXDUR:** istifadəçi zəng zamanı geri düyməsi ilə çıxsa — Agora client kanalda qalır, mikrofon trek-i açıq qalır (yazır!), `MediaRecorder` işləməyə davam edir, istifadəçi Firestore-da `busy` ilişib qalır. 8 `useEffect`-in heç biri aktiv zəngi bağlamır. Mikrofonun gizli açıq qalması həm privacy, həm Play Store rədd riskidir |
| 4.2 | `src/components/GlobalCallListener.jsx` | 46-47 | `acceptCall` mikrofon trek-i yaradıb `window.tempGlobalMicTrack`-a yazır — bu dəyişən **layihədə heç yerdə oxunmur və heç vaxt bağlanmır**. Başqa səhifədən zəng qəbul edən hər istifadəçidə əlavə mikrofon trek-i sonsuz açıq qalır (Chat.jsx `joinCall` öz trek-ini ayrıca yaradır → 2 aktiv mic trek) |

### 🟡 Orta

| # | Fayl | Sətir | Problem |
|---|---|---|---|
| 4.3 | `src/pages/AIChat.jsx` | 26-31, 60-73 | Unmount cleanup yalnız timer və audio-nu dayandırır; **yazılma gedərkən çıxsan `mediaRecorder` və `getUserMedia` stream trek-ləri dayandırılmır** → mikrofon açıq qalır |
| 4.4 | `src/App.js` | 145-157 | `visibilitychange: hidden` → istifadəçi `offline/status:'offline'` yazılır — **aktiv zəng zamanı ekran sönsə də**. `busy` statusunu əzir; zəng davam etdiyi halda istifadəçi başqalarına offline görünür, matchmaking/busy-check pozulur |
| 4.5 | `src/pages/Chat.jsx` | 732-738 | Məntiq xətası: `if (secondsTalked > 3) → insights; else if (secondsTalked >= 180) → rating` — ikinci şərt **heç vaxt işləmir** (>=180 həmişə >3-dür). Rating yalnız `CallInsights.onClose` (sətir 1120) vasitəsilə açılır; 4-179 saniyəlik zənglərdə isə rating də, post-quiz də (sətir 736) heç vaxt göstərilmir |
| 4.6 | `src/pages/Chat.jsx` | 494-586 | `reader.onloadend` içindəki async xətalar (məs. `setDoc` uğursuzluğu) heç bir `try/catch`-ə düşmür → unhandled promise rejection; `auth.currentUser.getIdToken()` (sətir 501) logout olubsa null-dereference |
| 4.7 | `src/pages/Ranking.jsx` | 10 | **Bütün `users` kolleksiyasına** `onSnapshot` — hər ziyarətdə N istifadəçi qədər oxu + hər user dəyişikliyində re-render. 1000 user-də səhifə açılışı 1000 oxu; Firestore xərci və render yükü xətti böyüyür. (`Admin.js:19`-da eyni pattern var, amma admin-only olduğu üçün 🔵) |
| 4.8 | `functions/index.js` + `firestore.rules` | 435-467 / 107-116 | Təhlükəsizlik (render deyil, amma kritik yaxınlığında): **(a)** `updatePeerStats` istənilən login olmuş istifadəçiyə istənilən peer-in `rating/badges/bonusMinutes`-ını **istənilən dəyərlə** yazmağa imkan verir (dəyər validasiyası, zəng-iştirak yoxlaması yoxdur); **(b)** `callAnalysis` write qaydası `request.resource.data.userId == request.auth.uid` şərti ilə **başqasının docId-sinə** yazmağa icazə verir (öz uid-ni body-yə qoymaq kifayətdir) |

### 🔵 Kiçik

| # | Fayl | Sətir | Problem |
|---|---|---|---|
| 4.9 | `src/App.js` | 72-75 | `SafeArea.addListener('safeAreaChanged')` heç vaxt remove olunmur (App bir dəfə mount olduğu üçün təsiri məhdud) |
| 4.10 | `src/pages/Chat.jsx` | 122-127 | Ringtone xarici URL-dən (`assets.mixkit.co`) yüklənir — native app-da offline/CSP halında səssiz sınır; app assets-inə köçürülməlidir (`GlobalCallListener.jsx:15`-də də eyni) |
| 4.11 | `src/pages/Chat.jsx` | 129-133 | `getDoc().then(setPeer)` — unmount-dan sonra setState (React 18-də zərərsiz, amma pattern düzəldilməlidir) |
| 4.12 | `src/pages/Chat.jsx` | 157 | `setTimeout(scrollIntoView, 50)` clear olunmur |
| 4.13 | `src/pages/Home.jsx` | 87 | `cutoff` effekt mount-unda bir dəfə hesablanır — uzun sessiyada “son 3 dəqiqə” pəncərəsi köhnəlir, siyahı yalnız böyüyür |
| 4.14 | `src/pages/Chat.jsx` | 386-401 | Timer effekti `inCall=false` olanda həm else-branch-da, həm cleanup-da `clearInterval` edir — işləyir, amma kövrəkdir; `alert()` (391, 394) interval içində UI thread-i bloklayır |

Qeyd: `Chats.jsx:14-58`, `Home.jsx:93/117`, `Profile.jsx:40-55`, `matchmaking.js:137/147`, `CallInsights.js:19`, `wordHistory.js:19` — bu listener-lərin hamısında unsubscribe düzgün qaytarılır. ✅

---

## 5. Play Store çıxışı üçün əskiklər

### 🔴 Kritik (bloker)

| # | Yer | Problem |
|---|---|---|
| 5.1 | `android/app/build.gradle:19-24` | **Release signing config yoxdur** — keystore faylı da yoxdur. Upload keystore yaradılmalı və `signingConfigs.release` əlavə olunmalıdır (Play App Signing tövsiyə olunur) |
| 5.2 | Layihədə yoxdur | **Privacy Policy yoxdur** (nə URL, nə səhifə). Mikrofon yazısı + audio-nun 3-cü tərəflərə (Groq, Deepgram, DeepSeek) göndərilməsi olan app üçün məcburidir — policy olmadan listing rədd olunur |
| 5.3 | Play Console (kod deyil) | **Data Safety formu**: mic audio → Groq/Deepgram-a göndərilir, transcript Firestore-da saxlanır, email/telegramId toplanır — hamısı bəyan edilməlidir. Yanlış bəyan = app removal |
| 5.4 | Layihədə yoxdur | **Hesab silmə** funksiyası yoxdur (`deleteUser` heç yerdə çağırılmır). Google Play “Account deletion” siyasəti (2024+) hesab yaradan bütün app-lardan in-app + web silmə yolu tələb edir |

### 🟡 Orta

| # | Yer | Problem |
|---|---|---|
| 5.5 | `android/app/build.gradle:21` | `minifyEnabled false` — R8/ProGuard söndürülüb: böyük APK, kod oxunaqlı. `true` + resource shrinking + Capacitor/Agora üçün keep-rules |
| 5.6 | Layihədə yoxdur | **Crashlytics / heç bir crash-reporting yoxdur** (nə `package.json`-da, nə gradle-da). Production-a crash görünürlüyü olmadan çıxmaq riskli |
| 5.7 | `android/app/` | **`google-services.json` YOXDUR** — `build.gradle:47-54` plugin-i şərti tətbiq edir, yəni native build-də FCM işləməyəcək (App.js `registerFcmToken` və `topicReminder` push-ları Android-də ölü olacaq) |
| 5.8 | `android/app/src/main/AndroidManifest.xml:39-43` | `POST_NOTIFICATIONS` icazəsi yoxdur (Android 13+ üçün məcburi) — FCM bildirişləri göstərilməyəcək. Həmçinin Agora üçün tövsiyə olunan `BLUETOOTH_CONNECT` yoxdur |
| 5.9 | `AndroidManifest.xml:10` + `capacitor.config.ts` (`cleartext: true`) | `usesCleartextTraffic="true"` — bütün trafik HTTPS olduğu halda lazımsızdır; təhlükəsizlik yoxlamalarında qırmızı bayraq |
| 5.10 | `src/components/GuidedTour.jsx` (M) + silinmiş splash PNG-lər | Working tree-də commit olunmamış dəyişikliklər var (`android/.../splash.png` silinib, `styles.xml` dəyişib) — release build-dən əvvəl splash ekranının real cihazda yoxlanması lazımdır |

### 🔵 Kiçik

| # | Yer | Problem |
|---|---|---|
| 5.11 | `android/app/build.gradle:10-11` | `versionCode 1` / `versionName "1.0"` hardcoded — hər yükləmədə əl ilə artırılmalı; CI/skriptlə idarə tövsiyə olunur |
| 5.12 | `AndroidManifest.xml:5` | `allowBackup="true"` — auth token-lərin backup-a düşməməsi üçün `false` tövsiyə olunur |
| 5.13 | `capacitor.config.ts` | `appName: 'SpeakLab'` / `appId: com.speaklab.app` vs layihə adı “speak2them” / Firebase `speak2them-64f2b` — brend uyğunsuzluğu listing-də çaşqınlıq yaradar |
| 5.14 | `build/static/js/main.5813093b.js` | Main bundle ~2.2 MB (minified) — Agora SDK və s. daxil; WebView-də ilk açılış yavaşlığı. Lazy-load artıq qismən var, optimallaşdırma mümkündür |

---

## Xülasə — prioritet sırası

1. 🔴 **Açar rotasiyası** (OpenAI, DeepSeek, Deepgram) + `.env`/Vercel-dən silinməsi + `aiQuizGenerator`-ın server proxy-yə köçürülməsi (2.1-2.3)
2. 🔴 **Mikrofon leak-ləri**: Chat.jsx unmount cleanup + `tempGlobalMicTrack` (4.1, 4.2, 4.3)
3. 🔴 **Play bloker-ləri**: signing, privacy policy, data safety, hesab silmə (5.1-5.4)
4. 🟡 **Groq axını**: server-side queue + Retry-After + 4xx-də retry etməmək (bölmə 3)
5. 🟡 **Backend security**: `updatePeerStats` validasiyası, `callAnalysis` write qaydası, hardcoded Deepgram (4.8, 2.3)
6. 🟡 Qalan Orta/Kiçik bəndlər FAZA 2 refactor siyahısına.
