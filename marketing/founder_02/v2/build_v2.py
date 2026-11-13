"""F02_v2_RefStyle — F02 re-cut to the reference-reel spec (Claude_Videos/Edit_Study_Research/REF_DdtBbI0AIt_rhythm.md).
Same takes and words as F02 (no new voice). What differs from ../build.py:
  - the face is always full frame: three zoom states (1.00 / 1.15 / 1.30, anchored on the eyes), slow pushes before a
    keyword, a 4-frame punch on it, and the zoom is only ever reset by a flash or a hard cut;
  - app screens are full-screen cutaways with zoom cuts (no split screen, no progress bar);
  - captions are two layers: a running line whose words drift in on their onsets, and one keyword slam per sentence;
  - a short designed sound on every flash, punch, keyword and cutaway cut (sfx.wav), under the voice.
Polad frames himself much closer than the reference speaker (face ≈ 55 % of the width at 1.00), so the text sits
under the chin (y 1400+) instead of at y 51 %, and 1.30 is the tightest state instead of 1.55.
Intermediates go to F02V2_WORK (default D:/f02v2). usage: python build_v2.py [master|timeline|stills t,…|overlay|sfx|final|sheet]
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
F02 = os.path.dirname(HERE)
SRC = r"C:\Users\p\Desktop\SpeakLab_Reels_Polad_Cekilisi\{}.mp4"   # 4K, autorotated 2160x3840
WORK = os.environ.get("F02V2_WORK", r"D:\f02v2"); os.makedirs(WORK, exist_ok=True)
KIT = os.path.join(F02, "..", "motion_kit")
MUSIC = os.path.join(F02, "..", "promo_hybrid_01", "music", "bed_warm_lofi.wav")   # the bed approved on F01_v4 / F02
OUT = os.path.join(WORK, "F02_v2_RefStyle.mp4")
TL = os.path.join(WORK, "timeline_v2.json")
MZ = 1.30   # master scale = tightest zoom state, so no state upscales
TH = ["-threads", "4"]   # the laptop overheats: half the cores

# ---- EDL on the WAV clock. F02's verified cuts, plus two pauses tightened (both jumps are hidden by a zoom change):
# 65185 5.84–6.21 (after «dinləyirik,») 0.37 s -> 0.21 s, and the hesitation 8.25–9.10 inside «əlbəttə ki» -> 0.23 s.
# Sentence-end tails stay ≥ 0.35 s (F01 lesson: quiet final syllables).
PIECES = [
    ("65185", 0.72, 4.25),    # 0  hook: hər bacarığı praktika edərək öyrənirik
    ("65185", 4.25, 5.96),    # 1  listening üçün dinləyirik
    ("65185", 6.12, 8.40),    # 2  reading üçün oxuyuruq və speaking əlbəttə
    ("65185", 9.02, 10.36),   # 3  ki, danışırıq
    ("65185", 10.36, 13.58),  # 4  amma əksər insanlar speaking etməkdən ya çəkinir
    ("65185", 13.58, 16.13),  # 5  ya da əlverişli bir mühit tapa bilmirlər
    ("65185", 16.13, 19.92),  # 6  elə buna görə də … SpeakLab platformasına dəvət edirik
    ("65186", 0.70, 6.77),    # 7  vaxt, səviyyə, partnyor
    # 65190: an audible breath (−35 dB, noisy) runs 0.56–1.16 and «Üstəlik» starts at 1.20 (whisper's 0.80 is wrong).
    # F02 cut in at 0.45 and kept the whole breath — Polad heard it (2026-11-14). IN = speech − 0.08.
    ("65190", 1.12, 3.73),    # 8  üstəlik «nə danışacam» problemi də yaşamırsız
    ("65190", 3.73, 9.95),    # 9  mövzu, suallar, təsvir, oyunlar
    ("65191", 0.46, 8.86),    # 10 (IN after the quiet breath 0.14–0.40; speech starts 0.58) süni intellekt … detallı analiz … izləyə biləsiniz
    ("65194", 0.72, 2.72),    # 11 məncə artıq bir bəhanəmiz qalmayıb
    ("65194", 2.72, 8.97),    # 12 şərhlərdə SpeakLab yazın
]
def _frame_align(P):   # whole 30 fps frames per piece (concat drift trap, see ../build.py)
    out = []
    for i, (t, a, b) in enumerate(P):
        if i and P[i - 1][0] == t and abs(P[i - 1][2] - a) < 1e-6: a = out[-1][2]
        out.append((t, a, round(a + round((b - a) * 30) / 30, 4)))
    return out
PIECES = _frame_align(PIECES)

def _audio_start(take):   # TRAP: phone audio starts 0.40–0.51 s after the video; cut both streams at +start_time
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=start_time",
                        "-of", "csv=p=0", SRC.format(take)], capture_output=True, text=True)
    return float(r.stdout.strip() or 0)
_acc, O = 0.0, []
for p in PIECES:
    O.append(_acc); _acc += p[2] - p[1]
D = round(_acc, 3)

def run(cmd):
    print(">", " ".join(map(str, cmd))[:200], flush=True); subprocess.run(cmd, check=True)

WORDS = {t: json.load(open(os.path.join(F02, "work", f"{t}_words.json"), encoding="utf-8")) for t in sorted({p[0] for p in PIECES})}
# whisper stretched «əlbəttə» over the hesitation; the envelope says it ends at 8.25 and «ki» starts at 9.10
for w in WORDS["65185"]:
    if w[0] == "əlbəttə": w[2] = 8.25
    if w[0] == "ki,": w[1] = 9.10

def wtime(take, a, b):
    """output time of a word (a..b on the WAV clock); None if it was cut out. A word whose start fell into a removed
    pause is placed at the start of the piece that holds its end."""
    for (tk, pa, pb), o in zip(PIECES, O):
        if tk == take and pa <= b - 0.03 <= pb: return round(o + max(a, pa) - pa, 3)
    return None

def W(take, word, k=1, off=0.0):
    hits = [w for w in WORDS[take] if w[0].lower().startswith(word.lower())]
    return round(wtime(take, hits[k - 1][1], hits[k - 1][2]) + off, 3)

FIX = {"bacarıqı": "bacarığı", "əlvirişli": "əlverişli", "intelekt": "intellekt", "şəhlərdə": "şərhlərdə",
       "partnerlərlə": "partnyorlarla", "danışacam": "danışacam", "yaşamırsız.": "yaşamırsız."}

def build():
    """everything on the output clock: zoom keyframes, cutaway shots, captions, slams, chips, CTA pill, flashes, sfx cues"""
    n = json.load(open(os.path.join(KIT, "frames", "index.json")))
    sfx, flashes = [], []
    # ---- zoom keyframes (t, z, 'cut'|'lin'): 'lin' ramps from the previous key, 'cut' holds then jumps
    K = [(0.0, 1.0, "cut")]
    def push(t, z=1.12):                       # slow push that ends 0.08 s before the keyword…
        K.append((t - 0.08, z, "lin"))
    def punch(t, z=MZ, snd=True):              # …then the 4-frame punch, landing 1 frame after the word starts
        K.append((t - 0.08, K[-1][1], "lin")); K.append((t + 0.05, z, "lin"))
        if snd: sfx.append((t - 0.10, "whoosh"))
    def reset(t, z=1.0, fl=True):
        K.append((t, z, "cut"))
        if fl: flashes.append(t); sfx.append((t - 0.03, "flash"))
    slams, labels, cuts, caps_break = [], [], [], set()
    def slam(beats, e, y=1458, hit="pop", size=128):
        slams.append({"s": beats[0][0], "e": e, "y": y, "size": size, "beats": [{"t": t, "text": x} for t, x in beats]})
        for i, (t, _) in enumerate(beats): sfx.append((t, hit if i == 0 else "pop"))
    def shot(s, e, d, t0, i, z=1.0, fx=0.5, fy=0.45, snd="cut"):
        cuts.append({"s": s, "e": e, "dir": d, "t0": t0, "in": i, "n": n[d], "z": z, "fx": fx, "fy": fy})
        if snd: sfx.append((s - 0.03, snd))
    def lab(s, e, text, y=1268):
        labels.append({"s": s, "e": e, "text": text, "y": y}); sfx.append((s, "pop"))

    # 0 hook
    t = W("65185", "praktika"); push(t, 1.10); punch(t); slam([(t, "PRAKTİKA")], O[1])
    # 1–3 the skills: chips on the words; the two tightened pauses are zoom cuts
    reset(O[1])
    K.append((O[2], 1.15, "cut")); sfx.append((O[2] - 0.03, "cut"))
    K.append((O[3], MZ, "cut")); sfx.append((O[3] - 0.03, "cut"))
    td = W("65185", "danışırıq"); slam([(td, "DANIŞIRIQ")], O[4], hit="hit")
    chips = [{"s": O[1], "e": O[4], "y": 1612, "items": [
        {"at": W("65185", "Listening"), "text": "Listening", "icon": "headphones"},
        {"at": W("65185", "reading"), "text": "Reading", "icon": "book"},
        {"at": W("65185", "speaking"), "text": "Speaking", "icon": "mic", "hot": td}]}]
    for c in chips[0]["items"]: sfx.append((c["at"], "chip"))
    # 4 amma … çəkinir
    reset(O[4]); t = W("65185", "çəkinir"); push(t); punch(t); slam([(t, "ÇƏKİNİR")], O[5])
    # 5 ya da … mühit (hard cut back to wide, no flash: same thought)
    reset(O[5], fl=False); sfx.append((O[5] - 0.03, "cut")); t = W("65185", "mühit"); push(t); punch(t); slam([(t, "MÜHİT")], O[6])
    # 6 SpeakLab
    reset(O[6]); t = W("65185", "SpeakLab"); push(t, 1.10); punch(t); slam([(t, "SPEAKLAB")], O[7], hit="hit")
    # 7 cutaway A: time / level / partner on the real Plan screen, then back to the face on «praktika edirsiniz»
    a1, a2, a3, a4 = O[7], W("65186", "səviyyənizə"), W("65186", "partnerlərlə"), W("65186", "praktika")
    shot(a1, a2, "plan", a1, 0.0, snd="hit"); shot(a2, a3, "plan", a1, 0.0, 1.28, 0.5, 0.30); shot(a3, a4, "plan", a1, 0.0, 1.14, 0.5, 0.62)
    lab(W("65186", "istədiyiniz"), a2, "İSTƏDİYİNİZ VAXT"); lab(a2, a3, "SƏVİYYƏNİZƏ UYĞUN"); lab(a3, a4, "PARTNYORLARLA")
    K.append((O[7], 1.0, "cut")); reset(a4); K.append((O[8], 1.08, "lin"))
    # 8 «nə danışacam»
    K.append((O[8], 1.15, "cut")); sfx.append((O[8] - 0.03, "cut"))
    t = W("65190", "nə"); punch(t); slam([(t, "NƏ"), (W("65190", "danışacam"), "DANIŞACAM?")], O[9])
    # 9 cutaway B: topic / questions / pictures / games — the shortest shots of the reel
    b = [O[9], W("65190", "sualları"), W("65190", "təsvir"), W("65190", "materialları", off=0.4), W("65190", "interaktiv"), O[10]]
    shot(b[0], b[1], "call_activities", b[0], 0.0, snd="hit"); shot(b[1], b[2], "call_activities", b[1], 6.3, 1.12, 0.5, 0.5)
    shot(b[2], b[3], "sheet_pictures", b[2], 2.05); shot(b[3], b[4], "sheet_videos", b[3], 1.6, 1.12, 0.5, 0.42)
    shot(b[4], b[5], "call_activities", b[4], 4.2, 1.06, 0.5, 0.5)
    lab(W("65190", "mövzusu"), b[1], "MÖVZU"); lab(b[1], b[2], "SUALLAR"); lab(b[2], b[4], "TƏSVİR"); lab(b[4], b[5], "OYUNLAR")
    K.append((O[9], 1.0, "cut"))
    # 10 «bununla da bitmir» + süni intellekt, then cutaway C: the real report
    reset(O[10]); t = W("65191", "bitmir"); K.append((t, 1.0, "lin")); K.append((t + 0.13, 1.15, "lin")); sfx.append((t - 0.03, "cut"))
    t = W("65191", "süni"); punch(t); c0 = W("65191", "hər"); slam([(t, "SÜNİ"), (W("65191", "intelekt"), "İNTELLEKT")], c0)
    c1, c2, c3 = W("65191", "detallı"), W("65191", "inkişafınızı"), W("65191", "davamlı")
    shot(c0, c1, "lab", c0, 0.6, snd="hit"); shot(c1, c2, "lab", c0, 0.6, 1.26, 0.5, 0.26)
    shot(c2, c3, "report", c2, 0.0); shot(c3, O[11], "report", c2, 0.0, 1.2, 0.5, 0.42)
    lab(c1, c2, "DETALLI ANALİZ"); lab(c2, O[11], "İNKİŞAFINIZI")
    K.append((c0, 1.0, "cut"))
    # 11 bəhanəmiz qalmayıb
    # 65194 is framed closer and lower than the other takes: 1.30 puts the chin on the caption, so its tight state is 1.22
    reset(O[11]); t = W("65194", "bəhanəmiz"); push(t, 1.08); punch(t, 1.22)
    slam([(t, "BƏHANƏMİZ"), (W("65194", "qalmayıb"), "QALMAYIB")], O[12], hit="hit")
    # 12 CTA: comment pill types «SpeakLab», the cursor clicks, slow push to the tightest state, last keyword
    reset(O[12]); ps = W("65194", "şəhlərdə", off=-0.1); ty, cl = W("65194", "SpeakLab"), W("65194", "yazmağınızdır", off=0.45)
    pills = [{"s": ps, "e": D, "y": 1530, "text": "SpeakLab", "typeS": ty, "typeE": ty + 0.6, "click": cl}]
    sfx.append((ps, "chip")); sfx.append((cl, "click"))
    K.append((cl, 1.0, "lin")); K.append((W("65194", "tətbiqin"), 1.22, "lin"))
    tg = W("65194", "göndərək"); slam([(tg, "GÖNDƏRƏK")], D, y=1392, size=112)
    K.sort(key=lambda k: k[0])

    # ---- zoom segments (t0, t1, z0, z1)
    segs, z = [], 1.0
    for i, (t, zz, kind) in enumerate(K[1:], 1):
        t0 = K[i - 1][0]
        if t > t0 + 1e-6: segs.append((t0, t, z, zz if kind == "lin" else z))
        z = zz
    segs.append((K[-1][0], D + 1, z, z))

    # ---- running caption: 2–4 words, ≤ 22 chars; keyword words are left out (the slam shows them); a line never
    # crosses a flash, a cutaway boundary or a take
    slamw = {("65185", "praktika", 1), ("65185", "danışırıq.", 1), ("65185", "çəkinir,", 1), ("65185", "mühit", 1), ("65185", "SpeakLab", 1),
             ("65190", "nə", 1), ("65190", "danışacam", 1), ("65191", "süni", 1), ("65191", "intelekt", 1),
             ("65194", "bəhanəmiz", 1), ("65194", "qalmayıb.", 1), ("65194", "göndərək.", 1)}
    brk = sorted(set(flashes) | {c["s"] for c in cuts} | {c["e"] for c in cuts} | {O[5], O[8]})
    seg_of = lambda t: sum(1 for x in brk if x <= t + 0.01)   # +0.01: word times are rounded to ms, piece starts are not
    in_cut = lambda t: any(c["s"] <= t + 0.01 < c["e"] for c in cuts)
    caps, chunk = [], []
    def flush():
        if chunk: caps.append({"s": chunk[0]["t"], "words": list(chunk)}); chunk.clear()
    for take in ["65185", "65186", "65190", "65191", "65194"]:
        seen = {}
        for w, a, bb in WORDS[take]:
            t = wtime(take, a, bb)
            if t is None: continue
            seen[w] = seen.get(w, 0) + 1
            if (take, w, seen[w]) in slamw: flush(); continue
            raw = FIX.get(w.rstrip(".,?!"), w.rstrip(".,?!")) + (w[-1] if w[-1] in ",?" else "")
            if chunk and (seg_of(t) != seg_of(chunk[0]["t"]) or len(" ".join(x["w"] for x in chunk) + " " + raw) > 22): flush()
            chunk.append({"w": raw, "t": t})
            if len(chunk) == 4 or w[-1] in ".,?!": flush()
        flush()
    caps.sort(key=lambda c: c["s"])
    merged = []   # a lone short word («ki,», «və») joins the line before it instead of standing alone
    for c in caps:
        p = merged[-1] if merged else None
        if (p and len(c["words"]) == 1 and len(c["words"][0]["w"]) <= 3 and seg_of(p["s"]) == seg_of(c["s"])
                and c["s"] - p["words"][-1]["t"] < 1.2 and len(" ".join(x["w"] for x in p["words"])) <= 22):
            p["words"] += c["words"]
        else: merged.append(c)
    caps = merged
    for i, c in enumerate(caps):
        nxt = caps[i + 1]["s"] if i + 1 < len(caps) else D
        later = [x for x in brk if x > c["words"][-1]["t"] + 0.05]
        c["e"] = min([nxt, D] + later[:1])
        c["pill"] = in_cut(c["s"])
        c["y"] = 1486 if c["pill"] else 1322 if c["s"] >= ps - 0.01 else 1380
    return {"duration": D, "stage": os.path.join(HERE, "stage_v2.html"), "frames": os.path.join(KIT, "frames"),
            "cuts": cuts, "caps": caps, "slams": slams, "labels": labels, "chips": chips, "pills": pills,
            "flashes": flashes, "zoom": segs, "sfx": sorted(sfx)}

def timeline():
    tl = build(); json.dump(tl, open(TL, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    head = D - sum(c["e"] - c["s"] for c in tl["cuts"])
    print(f"timeline {D} s: {len(tl['cuts'])} cutaway shots ({D - head:.1f} s), {len(tl['caps'])} lines, {len(tl['slams'])} slams, "
          f"{len(tl['labels'])} labels, {len(tl['flashes'])} flashes, {len(tl['sfx'])} sfx cues")
    for c in tl["caps"]: print(f"  {c['s']:6.2f}-{c['e']:6.2f} {'P' if c['pill'] else ' '} " + " ".join(w["w"] for w in c["words"]))
    return tl

def master():
    """the cut at 1404x2496 (zoom 1.30 of the frame), voice as PCM — every zoom state is a crop of this, never an upscale"""
    takes = sorted({p[0] for p in PIECES}); idx = {t: i for i, t in enumerate(takes)}
    ST = {t: _audio_start(t) for t in takes}
    cnt = {t: sum(1 for p in PIECES if p[0] == t) for t in takes}
    inputs, fc, cat = [], [], ""
    for t in takes:
        inputs += ["-i", SRC.format(t)]
        i, c = idx[t], cnt[t]
        fc.append(f"[{i}:v]split={c}" + "".join(f"[sv{i}_{j}]" for j in range(c)))
        fc.append(f"[{i}:a]asplit={c}" + "".join(f"[sa{i}_{j}]" for j in range(c)))
    used = {t: 0 for t in takes}
    Wm, Hm = int(1080 * MZ) // 2 * 2, int(1920 * MZ) // 2 * 2
    for k, (tk, a, b) in enumerate(PIECES):
        i, s, j = idx[tk], ST[tk], used[tk]; used[tk] += 1
        N = round((b - a) * 30)
        fc.append(f"[sv{i}_{j}]trim=start={a+s:.3f}:duration={b-a+0.2:.3f},setpts=PTS-STARTPTS,fps=30,trim=end_frame={N},setpts=PTS-STARTPTS,"
                  f"scale={Wm}:{Hm}:flags=lanczos,unsharp=5:5:0.4,setsar=1[v{k}]")
        fc.append(f"[sa{i}_{j}]atrim={a+s:.3f}:{b+s:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st={b-a-0.015:.3f}:d=0.015[a{k}]")
        cat += f"[v{k}][a{k}]"
    fc.append(f"{cat}concat=n={len(PIECES)}:v=1:a=1[v][a]")
    run(["ffmpeg", "-v", "error", "-y", *TH, *inputs, "-filter_complex", ";".join(fc), "-map", "[v]", "-map", "[a]", *TH,
         "-c:v", "libx264", "-crf", "13", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "pcm_s16le",
         os.path.join(WORK, "master.mov")])

def sfx():
    """designed one-shots, synthesised (no library loops): each ≤ 0.35 s, placed on its cue, level tied to the voice"""
    import numpy as np, wave
    sr = 48000; rng = np.random.default_rng(7)
    tl = json.load(open(TL, encoding="utf-8"))
    def bp(x, f0, f1, q=1.2):   # state-variable band-pass with a moving centre
        y = np.zeros_like(x); lo = bd = 0.0; fs = np.linspace(f0, f1, len(x))
        for i in range(len(x)):
            f = 2 * np.sin(np.pi * fs[i] / sr); hi = x[i] - lo - bd / q; bd += f * hi; lo += f * bd; y[i] = bd
        return y
    def env(n, a, d):   # attack a s, exponential decay with time constant d s
        t = np.arange(n) / sr; return np.minimum(1, t / a) * np.exp(-np.maximum(0, t - a) / d)
    def whoosh():   # rising air sweep that peaks at its end (lands on the punch)
        n = int(0.20 * sr); x = bp(rng.standard_normal(n), 500, 3800); e = np.sin(np.linspace(0, np.pi, n)) ** 2 * np.linspace(0.3, 1, n)
        return x * e
    def cut():      # shorter, darker swish for a hard cut
        n = int(0.13 * sr); x = bp(rng.standard_normal(n), 2600, 700); return x * np.sin(np.linspace(0, np.pi, n)) ** 1.5
    def flash():    # bright burst that decays like the picture flash (4 frames) with a soft tail
        n = int(0.30 * sr); x = bp(rng.standard_normal(n), 5200, 2400, 0.9); t = np.arange(n) / sr
        return x * env(n, 0.006, 0.07) + 0.25 * np.sin(2 * np.pi * 1760 * t) * env(n, 0.004, 0.05)
    def pop(f=430):  # keyword: pitched blip dropping an octave + a click
        n = int(0.11 * sr); t = np.arange(n) / sr; fr = f * (0.5 + 0.5 * np.exp(-t / 0.018))
        return np.sin(2 * np.pi * np.cumsum(fr) / sr) * env(n, 0.002, 0.028) + 0.3 * rng.standard_normal(n) * env(n, 0.0005, 0.003)
    def chip(): return pop(760) * 0.8
    def click():
        n = int(0.05 * sr); t = np.arange(n) / sr
        return np.sin(2 * np.pi * 2100 * t) * env(n, 0.0005, 0.006) + 0.5 * rng.standard_normal(n) * env(n, 0.0003, 0.002)
    def hit():      # low thump for the big moves, with the pop on top so it still reads on a phone speaker
        n = int(0.34 * sr); t = np.arange(n) / sr; fr = 48 + 50 * np.exp(-t / 0.03)
        x = np.sin(2 * np.pi * np.cumsum(fr) / sr) * env(n, 0.003, 0.09); p = pop(330); x[:len(p)] += 0.55 * p
        return x
    gen = {"whoosh": whoosh, "cut": cut, "flash": flash, "pop": pop, "chip": chip, "click": click, "hit": hit}
    # level per type relative to the voice's speech RMS (dB): all at least 10 dB under it
    rel = {"whoosh": -18, "cut": -20, "flash": -16, "pop": -15, "chip": -16, "click": -15, "hit": -13}
    vw = os.path.join(WORK, "voice.wav")
    run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(WORK, "master.mov"), "-vn", "-ac", "1", "-ar", str(sr), vw])
    w = wave.open(vw); v = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(float) / 32768
    fr = v[:len(v) // 480 * 480].reshape(-1, 480); r = np.sqrt((fr ** 2).mean(1)); vrms = np.sqrt((fr[r > np.percentile(r, 50)] ** 2).mean())
    # Recorded one-shots replace the synthesised ones when the library is present (Polad 2026-11-14: «professional variants»).
    # FiftySounds (fiftysounds.com) — free for commercial use, attribution optional for sound effects, no redistribution,
    # so the files stay outside the repo: F02V2_SFXLIB (default D:/f02v2/sfxlib/wav, 48 kHz mono WAV).
    # kind -> (file, longest tail kept in s, where the cue lands: "peak" of the sample or its "onset", cue shift in s)
    LIB = os.environ.get("F02V2_SFXLIB", os.path.join(WORK, "sfxlib", "wav"))
    PICK = {"whoosh": ("sfx-swoosh19", 0.55, "peak", 0.12), "cut": ("sfx-swoosh9", 0.40, "peak", 0.05),
            "flash": ("sfx-whoosh3", 0.35, "onset", 0.03), "pop": ("sfx-pop3", 0.25, "onset", 0.0),
            "chip": ("sfx-pop5", 0.25, "onset", 0.0), "click": ("sfx-menu3", 0.25, "onset", 0.0),
            "hit": ("sfx-impact12", 0.70, "onset", 0.0)}
    def sample(kind):
        name, keep, anchor, shift = PICK[kind]
        w = wave.open(os.path.join(LIB, name + ".wav")); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(float) / 32768
        e = np.sqrt((x[:len(x) // 480 * 480].reshape(-1, 480) ** 2).mean(1)); act = np.where(e > e.max() * 0.1)[0]
        s = max(0, act[0] * 480 - 480); pk = int(e.argmax()) * 480 + 240
        x = x[s:s + int(keep * sr)].copy(); n = len(x); f = int(n * 0.35); x[n - f:] *= np.linspace(1, 0, f) ** 2
        lead = (pk - s if anchor == "peak" else act[0] * 480 - s) / sr
        return x, shift - lead   # start offset relative to the cue so that the anchor lands on cue + shift
    use_lib = all(os.path.exists(os.path.join(LIB, v[0] + ".wav")) for v in PICK.values())
    print("sfx source:", "recorded library " + LIB if use_lib else "synthesised (library not found)")
    cache = {k: sample(k) for k in PICK} if use_lib else {}
    # Polad 2026-11-14: «yersiz fit səsləri var» — the two swooshes picked by measurement were tonal (54–56 % of their
    # energy in one 1077 Hz peak = a whistle), on 21 cues. Punches and hard cuts are now silent; the music carries them.
    MUTE = {"whoosh", "cut"}
    out = np.zeros(int((D + 0.5) * sr))
    for t, kind in tl["sfx"]:
        if kind in MUTE: continue
        x, off = cache[kind] if use_lib else (gen[kind](), 0.0)
        x = x / (np.sqrt((x ** 2).mean()) + 1e-9) * vrms * 10 ** (rel[kind] / 20)
        i = max(0, int((t + off) * sr)); x = x[:len(out) - i]; out[i:i + len(x)] += x
    out = np.clip(out, -0.98, 0.98)
    ww = wave.open(os.path.join(WORK, "sfx.wav"), "w"); ww.setnchannels(1); ww.setsampwidth(2); ww.setframerate(sr)
    ww.writeframes((out * 32767).astype(np.int16).tobytes()); ww.close()
    print(f"sfx.wav: {len(tl['sfx'])} cues, voice speech RMS {20*np.log10(vrms):.1f} dBFS, sfx peak {20*np.log10(np.abs(out).max()):.1f} dBFS")

def final(music_vol=0.48):   # 0.34 -> 0.48 (+3 dB): Polad «musiqini bir pillə də qaldır» (2026-11-14)   # was 0.16 with ratio-5 ducking (F01/F02); Polad asked for the bed a bit more audible.
    # 0.26 still measured 24 dB under the voice between words; 0.34 with ratio 3 targets ≈ 18–20 dB (reference: 12–15)
    tl = json.load(open(TL, encoding="utf-8"))
    z = "1"
    for t0, t1, z0, z1 in reversed(tl["zoom"]):   # zoompan zoom 1 = the whole master frame (state 1.00); it clamps below 1
        e = f"{z0:.5f}" if abs(z1 - z0) < 1e-6 else f"({z0:.5f}+{z1-z0:.5f}*(it-{t0:.4f})/{t1-t0:.4f})"
        z = f"if(lt(it,{t1:.4f}),{e},{z})"
    # anchor on the eyes (x 48 %, y 40 % of the frame) so the face does not slide when the zoom changes
    fc = [f"[0:v]zoompan=z='{z}':x='(iw-iw/zoom)*0.48':y='(ih-ih/zoom)*0.40':d=1:s=1080x1920:fps=30,setsar=1[zv]",
          "[zv][1:v]overlay=0:0:format=auto,format=yuv420p[v]",
          "[0:a]aresample=48000,asplit=2[vo][key]",
          f"[2:a]aresample=48000,atrim=0:{D},asetpts=PTS-STARTPTS,volume={music_vol},afade=t=in:d=0.4,afade=t=out:st={D-1.2}:d=1.2[m0]",
          "[m0][key]sidechaincompress=threshold=0.02:ratio=3:attack=30:release=350:makeup=1[mus]",
          "[3:a]aresample=48000[fx]",
          "[vo][mus][fx]amix=inputs=3:normalize=0:duration=first[mix]",
          f"[mix]afade=t=out:st={D-0.25}:d=0.25,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=192000,"
          # limit 0.8 let the denser mix (louder bed) reach +0.4 dBTP after AAC; 0.66 keeps the true peak under −1.5
          "alimiter=limit=0.66:attack=1:release=50:level=false,aresample=48000[a]"]
    run(["ffmpeg", "-v", "error", "-y", *TH, "-i", os.path.join(WORK, "master.mov"), "-i", os.path.join(WORK, "overlay.mov"),
         "-stream_loop", "-1", "-i", MUSIC, "-i", os.path.join(WORK, "sfx.wav"), "-filter_complex", ";".join(fc),
         "-map", "[v]", "-map", "[a]", "-t", str(D), *TH, "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-r", "30",
         "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", OUT])
    print("wrote", OUT)

def node(*a): run(["node", os.path.join(KIT, "render.cjs"), *a])

if __name__ == "__main__":
    step = sys.argv[1] if len(sys.argv) > 1 else "timeline"
    if step == "master": master()
    if step == "timeline": timeline()
    if step == "stills": timeline(); node(TL, os.path.join(WORK, "s.png"), "30", sys.argv[2])
    if step == "overlay": timeline(); node(TL, os.path.join(WORK, "overlay.mov"), "30")
    if step == "sfx": sfx()
    if step == "final": final()
