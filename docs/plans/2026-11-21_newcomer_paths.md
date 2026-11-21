# Yeni gələnin üç yolu: partnyor · müəllim · AInur — plan (2026-11-21)

> Təsdiqdən sonra ilk addım: bu faylı olduğu kimi `docs/plans/2026-11-21_newcomer_paths.md`-ə köçürmək. Polad təsdiq etməyincə kod yazılmır.

## Kontekst

Polad yeni gələnləri bu gün əl ilə, WhatsApp-da qəbul edir. Onlara «ödənişsiz müəllim dəstəyi» təklif edir və vaxt soruşur. Bunun üç problemi var:
- **Baq.** Polad təzə test hesabı açdı və hesab dərhal real istifadəçi Khadija ilə cütləşdi (B1, bu gün 23:00). Halbuki Polad Khadija-ya WhatsApp-da müəllim dəstəyi vəd etmişdi. Səbəb budur: wizard bitən kimi `notifyAdminOnboarding` → `requestRefill` işləyir. directBook yeni gələni 3 gün ərzində «in» sayır (`committedFor`) və onu dərhal bron edir. «Müəllim gözləyir» halını bilən heç bir sahə yoxdur. Test hesabını da heç nə işarələmir.
- Today kartında bronu dəyişmək olmur. «Həftəm» düyməsi Plan-a aparır. Kart telefonda çox hündürdür.
- Bir hissə istifadəçi real partnyordan utanır («AI ilə praktika üstün tuturam»). AInur isə hazırda yalnız bir dəfəlik isinmədir.

Bu dörd işin hamısı **pulsuz və sakit seçim** qalmalıdır: popup yoxdur, upsell yoxdur, qorxunun adı çəkilmir.

---

## Bənd 2 — Müəllim gözləyən və test hesabları peer-matching-dən kənarda (ƏVVƏL bu: baqdır)

### Data
- **Yeni kolleksiya `newcomerPath/{uid}`.** Yalnız server yazır. Sahibi oxuyur, admin oxuyur. Sahələr:
  - `path: 'partner' | 'teacher' | 'ai'`
  - `hold: true|false` — peer cütləşməsi dayanıb
  - `state: 'choosing' | 'waiting_time' | 'booked' | 'done' | 'released'`
  - `chosenAt`, `bookingId`, `doneAt`, `releasedBy: 'learner'|'admin'|'session'`

  Client bu sənədə yaza bilmir. Seçimi callable `chooseStartPath` yazır (bənd 1). Bayraq yalnız öz uid-ini kənara çıxarır, buna görə onun saxtalaşdırılması başqasına zərər vermir. Amma «müəllim seansı oldu» vəziyyətini yalnız server qoyur.
- **Test hesabı: `users.testAccount: true`.** Rules-protected sahədir, `isPremium` kimi: client-in update siyahısında yoxdur. Admin onu Admin → Students → «Test account» ilə qoyur (`adminAccess setTest`). `verify` skill-in admin SDK ilə yaratdığı hesablar da bu bayrağı alır.

### Qayda
- **`pairVerdict` (functions/index.js:3263)** yeni oxumalar alır: `newcomerPath/{A,B}` (+2 get).
  - `held` qaydası: tərəflərdən birində `hold === true` varsa və digər tərəf host / admin / həmin şagirdin müəllimi deyilsə (`isSupervisedPair` + `newcomerHosts` uid-ləri), cütləşmə rədd edilir.
  - `testClash` qaydası: `a.testAccount !== b.testAccount` olarsa və digər tərəf admin deyilsə, rədd edilir.
  - Hər ikisi `ok`-a girir. Cavab yenə səbəb demir.
- **Planner (`weeklyPlanner.pairAllowed`, pure, :112)**:
  - `loadPlannerInputs` (:5258) learner obyektinə `hold`, `test` qoyur.
  - `pairAllowed` `hold` olanı yalnız `b.host === true` ilə buraxır. `test` olanı yalnız test ilə buraxır.
  - `newcomers.hostPairs` (newcomers.js:124) host obyektinə `host: true` verir. Belə olanda müəllim yolunu seçən yenə Polad-a bron oluna bilir.
- **`committedFor` / directBook:** `hold`-da olan yeni gələn «3 gün in» sayılmır. Peer üçün `committed: false` olur.
- **Online now (`onlineNow`, :3434):** `hold` və `test` olanlar siyahıdan çıxır. Bu filtr pairVerdict-dən ayrı yazılıb, buna görə orada da əlavə olunmalıdır.
- **Avtomatik açılma:** `recordCallPractice` hostla / müəllimlə `attended` qeyd edəndə `newcomerPath.hold = false, state: 'done'` olur. Bundan sonra şagird adi dövrəyə girir.
- **Mövcud bronlar:** müəllim yolu seçiləndə şagirdin indiki peer bronları «platformanın ləğvi» kimi bağlanır (`cancelled`, penalti yoxdur). Partnyor adi «vaxt boşaldı» mesajını alır, refill işə düşür. Khadija-nın halı belə həll olur.

### Fayllar
`functions/index.js` (pairVerdict, loadPlannerInputs, onlineNow, recordCallPractice, adminAccess), `functions/weeklyPlanner.js` (+test), `functions/newcomers.js` (+test), `firestore.rules` (`newcomerPath` match, `users.testAccount` qorunan siyahıya), `src/pages/Admin*` (test düyməsi, «Müəllim gözləyir» siyahısı), `.claude/skills/verify` (yaradılan hesaba bayraq), `docs/domain/booking.md` + `planner.md`.

### Risklər
- **Hər pairVerdict çağırışı +2 oxuma.** Slot board `choosePartnerTx` 12 namizəd × 2 = +24 read edir. Bu qəbul ediləndir. Lazım olsa `known` ilə keşlənir.
- **Rules:** yeni kolleksiya catch-all deny-ə düşür. `match` yazılmasa, client-in öz sənədini oxuması da bağlı qalır.
- **«Test hesabı» Polad-ın 2026-10-15 qərarına ziddir** («fake hesab əlavə etməyək»). İndi real baq göstərdi ki, ehtiyac var. Bu bayraq hesab yaratmır, sadəcə işarə qoyur. **Polad təsdiq etməlidir.**
- `hold` uzun qalarsa, şagird heç vaxt cütləşməyə bilər. Bunun üçün iki çıxış var: şagirdin özünün «Partnyorla başlamaq istəyirəm» düyməsi (`releasedBy: learner`) və admin siyahısı. 7 gün keçəndə avtomatik açılma YOXDUR, adminə push gedir.

### Ops (koddan asılı deyil, Polad-dan icazə ilə)
Polad-ın test hesabının Khadija ilə bugünkü bronunu admin ləğvi ilə bağlamaq. Bunu dərhal etmək olar.

---

## Bənd 3 — Today «Növbəti məşqin» kartı: dəyiş + yığcam (müstəqildir, paralel gedə bilər)

### Dəyişiklik (`src/components/plan/NextPracticeCard.jsx`, `kind === 'next'`, :88)
- **«Həftəm» düyməsi «Dəyiş» olur** (`next.change`). Toxunanda kartın altında BookingRow-un «More» hissəsi kimi kiçik bir sıra açılır: «Vaxtı dəyiş» (`SlotPicker`), «Təqvimə əlavə et», «Ləğv et» (qırmızı link). Plan tabına getmək lazım olmur.
- **Təkrar kod yazılmır.** `BookingRow.jsx`-dən `cancel` / `move` məntiqi (`leavePracticeSlot`, `proposeSlotChange`, gec-ləğv təsdiqi, «What happened?» `askWhy`) `src/hooks/useBookingActions.js`-ə çıxarılır. BookingRow və kart bu hook-u birlikdə işlədir.
- **Yığcamlıq (375 px-də ~40% az hündürlük hədəfi):**
  - «bu gün 23:00» və partnyor eyni sətirdə olur: `Bu gün 23:00 · Khadija B1`.
  - «Qoşul düyməsi beş dəqiqə qalmış görünəcək» sətri silinir. Onun yerinə Join yerində boz, deaktiv pill dayanır: «Qoşul · 22:55».
  - «Add to calendar» «Dəyiş» menyusuna köçür.
  - Kart üç sıra olur: kicker + countdown · vaxt/partnyor · [Qoşul-pill] [Yaz] [Dəyiş].
- **Copy:** yeni açarlar `src/data/practiceCopy.js`-ə az/tr/ru/en dillərində yazılır (`next.change`, `next.reschedule`, `next.cancel`, `next.cancelAsk`, `next.cancelAskLate`, `next.joinAt`, `next.requestSent`, `next.cancelled`). `practiceCopy.test.js` açar paritetini yoxlayır. Bu sahədə saat adı çəkən hər hansı ritual mətni olmamalıdır.

### Risklər
- Gec ləğv (<2 saat) mətni partnyoru günahlandırmamalıdır. BookingRow-dakı mövcud mətn tərcümə olunur.
- Today-in ilk turu (`tour-next`) id-yə bağlıdır. id dəyişmir.
- `plan.css`-də kart hündürlüyünü dəyişən qaydalar Plan-a toxunmamalıdır. Yeni dəyişən sinif `pl-card--compact` olacaq.

---

## Bənd 1 — Tətbiq içində «necə başlamaq istəyirsən?» + müəllim vaxtı (bənd 2-dən sonra)

### Yer
- **Wizard-ın yeni addımı `start`.** `STEPS`-də `target`-dən sonra, `summary`-dən əvvəl gəlir (Onboarding.jsx:46). Addım yalnız `callCount === 0` olanda və hələ seçim edilməyəndə göstərilir. Bu, `notify` addımının keçid məntiqi kimi işləyir, buna görə `ONBOARDING_VERSION` artmır. Wizard bitməzdən ƏVVƏL seçildiyi üçün refill-in directBook-u gələndə `hold` artıq qoyulmuş olur. Baqın kökü budur.
- **Today-də** seçim etməmiş köhnə yeni gələnlər üçün (bu buraxılışdan əvvəl qeydiyyatdan keçən, `callCount 0`) warm-up kartının yerində bir sakit kart görünür: «Necə başlamaq istəyirsən?». Eyni üç seçim burada da var. Popup yoxdur. «İndi yox» düyməsi kartı gizlədir.

### Ekran (bir slayd, üç kart, standart seçim yoxdur)
1. **Partnyorla** — «Səviyyənə uyğun real partnyorla danış.»
2. **Əvvəlcə müəllimlə (ödənişsiz)** — «Müəllim ilk praktikana səninlə qoşulur, səviyyəni müəyyən edir, platformanı addım-addım göstərir. Sonra özün davam edirsən.» Bu, WhatsApp mətninin özüdür.
3. **Əvvəlcə AInur ilə** — bənd 4-ün A fazasına bağlıdır. A fazası hazır olmayana qədər bu kart GÖSTƏRİLMİR.

Müəllim seçiləndə həmin slaydda vaxt seçimi açılır:
- Hostun növbəti 7 gündəki boş başlanğıcları şagirdin öz saat qurşağında göstərilir (`timezone.js`). Məsələn, Türkiyə üçün Bakı saatından −1 saat.
- Şagird birini seçir → bron olunur.
- Heç biri uyğun deyilsə: «Uyğun vaxt yoxdur — WhatsApp-da yazaq» seçilir. Bu, `state: waiting_time` qoyur və adminə push gedir.

### Data / server
- **`chooseStartPath` (us-central1, callable/HTTP).** `setCors`, `verifyAuth`, `enforceRateLimit(uid,'chooseStartPath',10,1h)`. `newcomerPath`-ı yazır, `teacher`/`ai` üçün `hold: true` qoyur, mövcud peer bronlarını bağlayır (bənd 2). Şagird sonradan fikrini dəyişib `partner` seçsə, `hold: false, releasedBy: learner` olur.
- **`teacherIntroSlots`.** `appConfig/planner.newcomerHosts` (hostun saatları) ilə `bookings.overlappingBookingsTx` birləşir və 7 gün içindəki boş başlanğıclar qaytarılır. Host kimliyi yalnız ad olaraq verilir. Yeni kolleksiya yaradılmır.
- **`bookTeacherIntro(startSlotId)`.** `bookPairTx` çağırılır: `source: 'team_intro'`, `marker {host, team:true}`, `oneADay:false`. Bron paketlərdə və reliability hesabında sayılmır (mövcud qayda belədir). `newcomerPath.state: 'booked'` olur. Xatırlatmalar, T−15 call doc, no-show — hamısı mövcud yolla işləyir. Kartda host «Müəllim» etiketi ilə görünür (`headline.peerRole`).
- **Köhnə `bookIntro`/`teamSlots`/`introBookings` istifadə OLUNMUR.** O axın 2026-09-28-dən söndürülüb və adi bron sisteminə bağlı deyil.
- **Copy:** `src/data/firstRunCopy.js`-ə `start.*` açarları, 4 dildə. Test hər dili yoxlayır. Hostun saatları Polad-ındır (memory: Ç/Ç/C 10, P 10–11, Ş 10–13+16–18, B 10–13+18–20). Bu saatlar az olduğu üçün WhatsApp fallback mütləqdir.

### Fayllar
`src/pages/Onboarding.jsx`, yeni `src/components/firstRun/StartPathStep.jsx` və `StartPathCard.jsx` (Today), `src/pages/Home.jsx`, `src/utils/planState.js` (host bronu = `next`, `peerRole`), `functions/index.js` (3 endpoint), `firestore.rules`, `docs/domain/onboarding.md`.

### Risklər
- **Hostun yükü.** Polad gündə 1 hostluq qəbul edib (2026-10-15). İndi şagird özü seçəcək, ona görə gündəlik limit `newcomerHosts`-da `maxPerDay` sahəsi ilə saxlanılır.
- Türk istifadəçinin «18:00-dan sonra uyğunam» cavabı ilə Polad-ın səhər saatları üst-üstə düşmür. Ya ikinci host olmalıdır (WhatsApp-da «21:30 üçün öğretmenimiz var» deyilib — **o müəllim kimdir? uid?**), ya da fallback.
- Wizard-a addım əlavə etmək huni itkisi deməkdir. Addım bir slayddır, «Partnyorla» bir toxunuşdur.

---

## Bənd 4 — Utanan üçün AInur yolu (ən böyüyü, ayrı fazalar)

### Əsas ziddiyyət — Polad qərar verməlidir
`functions/warmupCall.js`-də Polad-ın qaydası yazılıb: «warm-up heç vaxt AI praktikasına çevrilmir», «SpeakLab-ı AI praktikası kimi təsvir etmə». «Free talk» da bu səbəbdən silinib (11.10). Bu bənd həmin qaydanı yumşaldır. Təklif olunan çərçivə belədir: **AInur körpüdür, son məqsəd deyil.** Hədəf hələ də real partnyordur, amma şagird oraya öz tempi ilə gedir.

### Faza A — mövcud alətlərlə yol (ucuz, ~2 gün)
- Onboarding-də 3-cü kart «Əvvəlcə AInur ilə» olur. `newcomerPath.path = 'ai', hold: true` qoyulur. Planner bu şagirdi peer-ə planlamır.
- **Today:** `planHeadline` yeni `kind: 'ai_path'` alır. Kart: «Bu gün AInur ilə» → warm-up zəngi (birinci dəfə), sonra mövzu üzrə Describe pictures/videos. Altında sakit bir link: «Partnyora hazıram» (`chooseStartPath partner`) və «Müəllimlə başla».
- **Körpü:** 3 AInur sessiyası bitəndən sonra kart yalnız BİR dəfə soruşur: «Növbəti addım: müəllimlə 15 dəqiqə?». Mətndə «qorxma» kimi sözlər yoxdur.
- **Xərc:** yeni model yoxdur. Warm-up artıq limitlidir: 2 cəhd, `warmupStartV2` 4/gün, aylıq $15 büdcə. Activities `aiTurn`-u 120/saatdır (Groq, ölçülür, cap yoxdur).

### Faza B — «AInur ilə söhbət»: günün mövzusunda səsli zəng (~4–5 gün)
- Warm-up infrastrukturu təkrar istifadə olunur (Gemini Live, server-də sabitlənmiş prompt ilə ephemeral token).
  - Yeni `ainurTalkStart/End` endpoint-ləri yazılır.
  - `functions/ainurTalk.js` pure + test.
  - Prompt günün mövzusundan qurulur (`dailyQuestions.json` + `weeklyContent.js`).
  - Uzunluq 8 dəqiqədir.
  - Həmin L1 yardımı və səviyyə qaydaları tətbiq olunur.
- **Hesabat:** Live transkripsiyası (`inputAudioTranscription`) `analyzeAiSession` → `callAnalysis/{uid}_ai_{id}` axınına gedir. Mövcud History və müəllim görünüşü işləyir (müəllim yalnız `callAnalysisTeacher` görür, qayda dəyişmir).
- **Limitlər:**
  - `enforceRateLimit(uid,'ainurTalkStart',2,24h)`
  - adam başına aylıq cap: `appConfig/ainurTalk.perUserMonthly`, default 12
  - ümumi aylıq büdcə: `appConfig/ainurTalk.monthlyUsd` → `agentUsage/{month}.ainurTalkUsd`
  - büdcə dolanda push `admin_ainur_budget`
- **Xərc hesabı:**
  - Gemini Live: $0.005/dəq giriş + $0.018/dəq çıxış. Kontekst hər turda yenidən hesablanır, sliding window 8k token.
  - 8 dəqiqə ≈ $0.10–0.40, rezerv $0.35/zəng.
  - Analiz ~$0.01.
  - 12 zəng/ay ≈ $1.5–4.5/adam. Ən kiçik paket 6 AZN ≈ $3.5-dir.
  - **Nəticə: limitsiz pulsuz AI praktikası verilə bilməz.**

### Faza C — paket və məhsul qərarları (Polad)
- AI söhbəti paketin «praktika»sı sayılırmı? Təklif: **yox, ayrı sayğac**. Ayda N pulsuz AI söhbəti, paket alanlara daha çox. `packages.js` toxunulmaz qalır, `accessState` AI söhbətini saymır.
- AInur tabında «Free talk» geri qayıtmır. Faza B mövzuya bağlıdır, buna görə «boş söhbət» deyil.

### Fayllar
`functions/ainurTalk.js` (+test), `functions/index.js`, `src/pages/AinurHub.jsx`, `src/pages/WarmupCall.jsx` (ümumi Live client-i `src/hooks/useGeminiLive.js`-ə çıxarılır), `src/utils/planState.js`, `practiceCopy.js` / `firstRunCopy.js`, `docs/domain/calls.md`.

### Risklər
- **Xərc.** Live kontekst hesablanması proqnozdan çox ola bilər. Əvvəl 5 nəfərlik shadow pilot keçirilir, `agentUsage` ölçülür.
- **Məhsul.** Şagird AI-da qalıb heç vaxt partnyora keçməyə bilər. Ölçü: AI yolunu seçənlərin 30 gündə real zəngə çatma faizi. Admin bunu görür.
- Model adı (`gemini-3.8-live`) və qiymətlər 2026-11-06 tarixinə aiddir. Faza B başlamazdan əvvəl yenidən yoxlanır.

---

## İş sırası
1. **Bənd 2** (server + rules + pure testlər): `newcomerPath`, `testAccount`, pairVerdict/pairAllowed/onlineNow/directBook. Deploy functions + rules. Polad-ın test hesabı dərhal işarələnir.
2. **Bənd 3** (yalnız frontend). Bənd 2 ilə paralel gedə bilər, fayllar kəsişmir.
3. **Bənd 1** (bənd 2-yə söykənir): `start` addımı, 3 endpoint, Today kartı. Bu mərhələdə yalnız «Partnyor» və «Müəllim» kartları var.
4. **Bənd 4 A** → 3-cü kart açılır. **4 B** → 5 nəfərlik pilot, xərc ölçülür → **4 C** Polad-ın qiymət qərarı.

## Yoxlama
- `node --test` (`functions/`): pairVerdict-in pure hissəsi, `pairAllowed` (hold/test/host), `newcomers.hostPairs` host istisnası, `ainurTalk` limitləri.
- `CI=true npx react-scripts test --watchAll=false` (practiceCopy və firstRunCopy açar pariteti, planState `ai_path`/`peerRole`) və `CI=true npx react-scripts build` (Bash).
- **Emulator** (`verify` skill, `firebase.emu.json`): müəllim seçən yeni gələn + aktiv peer. Refill işləyəndə peer-ə bron OLMAMALIDIR, host bronu olmalıdır. Test hesabı + real hesab → heç bir yol cütləşdirməməlidir. `scratchpad/simnew.cjs` təkrarlanır, yeni gələnlərin praktikaya çatma faizi düşməməlidir.
- **UI:** daxili brauzerdə 375 px. Today kartının hündürlüyü əvvəl/sonra müqayisə olunur, «Dəyiş» → vaxt dəyişmə və ləğv emulatorda yoxlanır. Onboarding `start` addımı 4 dildə ekran şəkli ilə yoxlanır.

## Polad-ın qərarları (2026-11-21)
1. **Test hesabı bayrağı — BƏLİ.** `users.testAccount` qoyulur və 2026-10-15-dəki «yox» qərarı ləğv olunur. Səbəb Khadija baqıdır.
2. **«AInur körpüdür» — BƏLİ.** «Warm-up heç vaxt AI praktikası olmur» qaydası bununla əvəz olunur. Onboarding-də 3-cü seçim gəlir, Faza A edilir. Real partnyor hədəf olaraq qalır.
3. **Host — yalnız Polad.** İkinci host yoxdur. Hostun saatları uyğun gəlməyəndə (məs. Türkiyənin axşamı) «WhatsApp-da yazaq» fallback-i işləyir: `state: waiting_time` qoyulur, adminə push gedir. Bu fallback MƏCBURİDİR.
4. **AI söhbəti büdcəsi — sonra.** Faza B (Gemini Live söhbəti) hələ başlamır. Əvvəl Faza A-nın nəticəsinə baxılır. Faza B-yə keçməzdən əvvəl limit və büdcə yenidən soruşulur.
