---
name: speaklab-content
description: Create SpeakLab marketing content — Instagram carousels/reels, WhatsApp posts, promo videos — on-brand and published via Composio. Use for any @speaklab.az social/marketing/graphic/video task.
---

# SpeakLab content & marketing (@speaklab.az)

Account is a **Creator** account managed for Polad. Always apply the brand rules; every post must drive practice at speaklab.az.

## Brand rules (non-negotiable)
- **Visual — Light Mode only.** White `#FFFFFF` bg, glassmorphism cards. Primary text Ink Navy `#0D1B3E` (large, prominent). Accents/glow: Lab Violet `#6D3BEB` + Neon Cyan `#12BBD6`. Tiny `speaklab.az` watermark at the absolute bottom edge. No central purple logo unless asked. Vibe: clean, high-tech, minimalist startup.
- **Copy — Azerbaijani** (English examples ok). Motivational, friendly, frequent emojis (🚀💡👇🎯), bold for emphasis. Start with a strong hook. NEVER just give the answer — end with a mini-quiz/question + "Komentdə yaz! 👇". Remind to practice at speaklab.az.
- **Formats:** IG carousel = 4–5 **square 1:1** slides (S1 hook cover, S2–3 educational w/ AZ translations on-slide, S4 mini-quiz, S5 CTA question). WhatsApp = text + 1 square image. Reels/TikTok = 9:16 (0–3s hook, 3–20s value, 20–30s SpeakLab outro).
- Image-gen base prompt: "glassmorphism card on clean white bg, glowing topic icon in Lab Violet + Neon Cyan, large Ink Navy typography, tiny speaklab.az watermark at absolute bottom."

## Publishing to Instagram (Composio REST, NOT the CLI)
The Composio CLI does not work on Windows — use the REST API directly.
- Keys in root `.env` (deliberately no `REACT_APP_` prefix): `COMPOSIO_API_KEY`, `COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID` (`ac_z9GRf6aJkMrn`), `COMPOSIO_USER_ID` (`polad`). Connected account `ca_ntYLAvlTnBNv`.
- API base `https://backend.composio.dev/api/v3/`, header `x-api-key`.
- **Publish `ig_user_id` = `17841475958781912`** (NOT the 275… id GET_USER_INFO returns). Instagram accepts **JPEG only**.
- Carousel flow: CREATE_MEDIA_CONTAINER per image (`is_carousel_item:true, content_type:"carousel_item"`) → CREATE_CAROUSEL_CONTAINER (children + caption) → poll GET_POST_STATUS → CREATE_POST. Insights want `ig_post_id`.
- **Image hosting trick:** drop JPGs in `public/ig/<date-slug>/`, push to main → live at `https://speaklab-app.vercel.app/ig/<date-slug>/…` in ~2 min. (`public/ig` is excluded from the APK by design.)

## Promo videos
`scripts/video_generator/create_rotato_promo.py` — OpenCV + Pillow + moviepy (v2.x) 3D device-mockup promos. Edit the `timeline` array / text overlays / `anim_type`. Source media from `~/Downloads` or `~/Downloads/Telegram Desktop`; output `promo_fixed.mp4`. Run `python create_rotato_promo.py` in that folder.
