# Aylıq direktiv — noyabr 2026 (Polad, 2026-11-06)

Hər sessiya bu sənədi bilir. Ümumi qayda: **token israfını azalt** — lazım olanı oxu, böyük faylları hissə-hissə oxu, eyni şeyi iki dəfə yoxlama, uzun hesabat yazma.

## Üç sütun
1. **SpeakLab sosial böyümə:** IG/TikTok @speaklab.az, YouTube @speakllab göstəricilərini izləmək; `marketing/content_calendar.json` ilə hər gün 19:30 Bakı vaxtı paylaşım (növbə boş qalmasın); təsisçi çəkilişlərinin montajı (qızıl standart `speaklab_viral_reel_final.mp4`: 1080x1920, 0.35 s-dən uzun pauza yox, 1.0x↔1.14x snap-zoom, B-roll y=104px headroom, 1–3 sözlük subtitr).
2. **Qat-Qat:** 1 ayda 2–3 aylıq video ehtiyatı. Yalnız STEM/mühəndislik/geologiya/neyro/sənədli hekayə, **100% Azərbaycan əlaqəsi**. Resept: `C:\Users\p\Desktop\qatqat\QATQAT_PLAYBOOK.md`.
3. **Tətbiq (engineering):** PWA + Android sabitliyi, on-demand matching, AInur analizi, Agora zəngləri, Functions/rules.

## Ünsiyyət
Səlis Azərbaycan dili, nəticə + kliklənən fayl yolları. Qeyri-müəyyənlikdə soruş. Yoxlanmamış/render olunmamış işi «hazırdır» adlandırma.

## Dəmir qaydalar
1. Maskotsuz (lazım olsa yalnız orijinal `kolba.js`).
2. B-roll üzü örtmür — y=104px headroom.
3. Subtitr: PIL ink bbox-a simmetrik pad_y=22px (quyruqlu hərflər kəsilmir).
4. Gemini TTS sonundakı C2PA blokunu kəs (`extract_clean_pcm24_from_gemini_tts`).
5. ElevenLabs yox; Gemini 3.8 Flash TTS, Achird/Charon, 1.05x.
6. 21:00 ritualı yoxdur — heç bir videoda/mətndə deyilmir (tətbiqdən silinməsi açıq işdir).
7. `git push origin main` = canlı deploy; `CI=true` build əvvəlcədən.
8. Trigger-lər europe-west4, qalanı us-central1.
9. Quru dərslik quizi yox — emosiya, sirr, hekayə.

## Ünvanlar
- Təsdiqlənmiş videolar: `C:\Users\p\Desktop\SpeakLab_Social_Videos\`
- Xam çəkilişlər/masterlər: `C:\Users\p\Downloads\Telegram Desktop\`
- Qat-Qat: `C:\Users\p\Desktop\qatqat\`
- Video inventarı (mövzu təkrarı olmasın): `SESSION_MEMORY.md`
- Tam əməliyyat bələdçisi: `C:\Users\p\Desktop\CLAUDE_CODE_MASTER_OPERATIONS_HANDOFF.md`
