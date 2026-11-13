"""Measure a reference reel before copying its edit style.

usage: python measure_reference.py <video> [out_dir]
       (run it at low priority on half the cores:  cmd /c "start /belownormal /affinity 3F /wait /b python measure_reference.py …")

Writes into out_dir (default D:/ref_study/<video name>):
  scene.txt        ffmpeg scene score of every frame that changed (pts_time + lavfi.scene_score)
  f/0001.jpg…      10 fps thumbnails (270x480)
  sheet_N.jpg      contact sheets, 48 thumbnails each (4.8 s), every tile stamped with its time — READ THESE BY EYE
  a.wav            mono 22.05 kHz audio
  onsets.json      50 ms RMS envelope, high/low band onsets, quiet runs, cut candidates
  spec_draft.md    shot table + numbers, with the parts only a human/model reading the sheets can fill left as TODO

The numbers are a starting point, not the spec: a scene score cannot tell a flash from a cut, and an onset cannot tell
a whoosh from a sibilant. Read the sheets, then write the spec (templates/spec_template.md).
"""
import json, os, re, subprocess, sys, wave

BELOW_NORMAL = 0x00004000 if os.name == "nt" else 0


def run(cmd):
    subprocess.run(cmd, check=True, creationflags=BELOW_NORMAL)


def probe(video):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=width,height,r_frame_rate,nb_frames:format=duration", "-of", "json", video],
                       capture_output=True, text=True, check=True)
    j = json.loads(r.stdout); s = j["streams"][0]; a, b = s["r_frame_rate"].split("/")
    return {"w": s["width"], "h": s["height"], "fps": float(a) / float(b), "frames": int(s.get("nb_frames") or 0),
            "duration": float(j["format"]["duration"])}


def extract(video, out):
    """one decode pass: scene scores, 10 fps thumbnails, mono audio"""
    os.makedirs(os.path.join(out, "f"), exist_ok=True)
    scene = os.path.join(out, "scene.txt").replace("\\", "/").replace(":", "\\:")
    fc = (f"[0:v]scale=270:480,split=2[a][b];[a]select='gt(scene,0.08)',metadata=print:file='{scene}'[s];[b]fps=10[f]")
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-threads", "2", "-i", video, "-filter_complex", fc,
         "-map", "[s]", "-f", "null", "-", "-map", "[f]", "-q:v", "4", os.path.join(out, "f", "%04d.jpg"),
         "-map", "0:a", "-ac", "1", "-ar", "22050", os.path.join(out, "a.wav")])


def scene_scores(out):
    rows, t = [], None
    for line in open(os.path.join(out, "scene.txt")):
        m = re.search(r"pts_time:([\d.]+)", line)
        if m: t = float(m.group(1))
        m = re.search(r"scene_score=([\d.]+)", line)
        if m: rows.append((t, float(m.group(1))))
    return rows


def sheets(out, cols=12, rows=4, w=180, h=320):
    import glob
    from PIL import Image, ImageDraw
    fs = sorted(glob.glob(os.path.join(out, "f", "*.jpg"))); per = cols * rows; made = []
    for si in range(0, len(fs), per):
        sh = Image.new("RGB", (cols * w, rows * (h + 14)), "black"); d = ImageDraw.Draw(sh)
        for k, f in enumerate(fs[si:si + per]):
            x, y = (k % cols) * w, (k // cols) * (h + 14)
            sh.paste(Image.open(f).resize((w, h)), (x, y + 14)); d.text((x + 3, y + 1), f"{(si + k) / 10:.1f}s", fill="white")
        p = os.path.join(out, f"sheet_{si // per}.jpg"); sh.save(p, quality=80); made.append(p)
    return made


def audio(out):
    import numpy as np
    w = wave.open(os.path.join(out, "a.wav")); sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768
    hop = int(sr * 0.05); n = len(x) // hop
    db = 20 * np.log10(np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(1)) + 1e-6)
    N = 1024; f = np.fft.rfftfreq(N, 1 / sr)
    def bands(i):
        seg = x[i * hop:i * hop + N]; seg = np.pad(seg, (0, N - len(seg)))
        S = np.abs(np.fft.rfft(seg * np.hanning(N))) ** 2
        return [10 * np.log10(S[(f >= a) & (f < b)].sum() + 1e-9) for a, b in ((20, 150), (300, 3000), (6000, 11000))]
    B = np.array([bands(i) for i in range(n)])
    def onsets(k, jump=9.0):   # a band that rises ≥ 9 dB in 50 ms and ends in its own top 30 %
        d = np.diff(B[:, k]); thr = np.percentile(B[:, k], 70); res = []
        for i in range(len(d)):
            if d[i] > jump and B[i + 1, k] > thr and (not res or i + 1 - res[-1] > 3): res.append(i + 1)
        return [round(i * 0.05, 2) for i in res]
    quiet, st = [], None
    for i, v in enumerate(db < -45):
        if v and st is None: st = i
        if not v and st is not None:
            if i - st >= 3: quiet.append([round(st * 0.05, 2), round(i * 0.05, 2)])
            st = None
    return {"rms_db_overall": round(float(20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-9)), 1),
            "peak_db": round(float(20 * np.log10(np.abs(x).max() + 1e-9)), 1),
            "voice_level_db_p90": round(float(np.percentile(db, 90)), 1), "floor_db_p10": round(float(np.percentile(db, 10)), 1),
            "min_db": round(float(db.min()), 1), "quiet_runs_below_-45dB": quiet,
            "onsets_high_6-11kHz": onsets(2), "onsets_low_20-150Hz": onsets(0),
            "rms_db_50ms": [round(float(v), 1) for v in db]}


def cut_candidates(rows, fps):
    """score ≥ 0.4 = a hard change (cut, flash or full-frame graphic). Frames within 0.2 s are one event."""
    ev = []
    for t, s in rows:
        if s < 0.4: continue
        if ev and t - ev[-1][0] < 0.2: ev[-1] = (ev[-1][0], max(ev[-1][1], s))
        else: ev.append((t, s))
    return [{"t": round(t, 2), "score": round(s, 2)} for t, s in ev]


def draft(video, out, info, cuts, au, sheet_files):
    ts = [0.0] + [c["t"] for c in cuts] + [info["duration"]]
    lens = [round(ts[i + 1] - ts[i], 2) for i in range(len(ts) - 1)]
    srt = sorted(lens); med = srt[len(srt) // 2]
    L = [f"# REF `{os.path.basename(video)}` — rhythm map (DRAFT from measure_reference.py)", "",
         f"Source: `{video}` — {info['w']}×{info['h']}, {info['fps']:.0f} fps, {info['duration']:.2f} s.",
         f"Working files: `{out}` ({len(sheet_files)} contact sheets, scene.txt, onsets.json).", "",
         "**Limits of this map.** TODO: say what was measured and what was only inferred (audio is measured, not listened to).", "",
         "## 1. What the reel is, in one line", "", "TODO — one sentence, written after reading the sheets.", "",
         "## 2. Shot list (hard visual changes)", "",
         "Candidates from scene score ≥ 0.4. TODO: read the sheets — merge flashes into their shot, add zoom cuts and",
         "shrink/morph transitions the score missed, and name each shot and its transition.", "",
         "| # | In (s) | Out (s) | Len (s) | What | Transition in |", "|---|---|---|---|---|---|"]
    for i in range(len(lens)):
        L.append(f"| {i + 1} | {ts[i]:.2f} | {ts[i + 1]:.2f} | {lens[i]:.2f} | TODO | {'—' if i == 0 else 'TODO (score ' + str(cuts[i - 1]['score']) + ')'} |")
    L += ["", f"- {len(lens)} shots in {info['duration']:.1f} s → mean {info['duration'] / len(lens):.2f} s, median {med:.2f} s, min {min(lens):.2f} s, max {max(lens):.2f} s.",
          "", "## 3. Event density inside the talking head", "", "TODO — per shot: every caption start, keyword, overlay in/out and zoom change with its time; mean gap.", "",
          "## 4. Zooms and punch-ins", "", "TODO — face width as % of frame width per state; ramp durations; how the zoom is reset.", "",
          "## 5. Transitions", "", "TODO — frame-by-frame description of the signature transition (opacity per frame, length).", "",
          "## 6. Captions", "", "TODO — position (y %), size (px at 1080), words per card, in/out animation, keyword layer.", "",
          "## 7. Overlays and B-roll", "", "TODO — table: time, element, size/position, in, out.", "",
          "## 8. Sound", "",
          f"- Whole mix {au['rms_db_overall']} dBFS RMS, peak {au['peak_db']} dBFS.",
          f"- 50 ms level: loud parts (p90) {au['voice_level_db_p90']} dB, floor between words (p10) {au['floor_db_p10']} dB, minimum {au['min_db']} dB "
          f"→ the bed sits ≈ {au['voice_level_db_p90'] - au['floor_db_p10']:.0f} dB under the voice." + (" No silence anywhere." if not au["quiet_runs_below_-45dB"] else ""),
          f"- Quiet runs (< −45 dB, ≥ 0.15 s): {au['quiet_runs_below_-45dB'] or 'none'}.",
          f"- High-band onsets ({len(au['onsets_high_6-11kHz'])}): {au['onsets_high_6-11kHz']}",
          f"- Low-band hits ({len(au['onsets_low_20-150Hz'])}): {au['onsets_low_20-150Hz']}",
          "- TODO: table of visual events vs the onset within ±0.1 s. An onset with no visual event is probably speech.", "",
          "## 9. Hook, pacing curve, ending", "", "TODO.", "", "## 10. The reusable spec (numbers to build from)", "", "TODO — 8–12 numbered rules, each with a number.", ""]
    p = os.path.join(out, "spec_draft.md"); open(p, "w", encoding="utf-8").write("\n".join(L)); return p


if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(__doc__)
    video = os.path.abspath(sys.argv[1])
    out = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join("D:\\ref_study", os.path.splitext(os.path.basename(video))[0])
    os.makedirs(out, exist_ok=True)
    info = probe(video); extract(video, out)
    rows = scene_scores(out); cuts = cut_candidates(rows, info["fps"]); sh = sheets(out); au = audio(out)
    json.dump({"video": video, "info": info, "cut_candidates": cuts, **au}, open(os.path.join(out, "onsets.json"), "w"), indent=1)
    d = draft(video, out, info, cuts, au, sh)
    print(f"{info['duration']:.2f} s, {len(rows)} scored frames, {len(cuts)} cut candidates, {len(sh)} sheets, "
          f"{len(au['onsets_high_6-11kHz'])} high / {len(au['onsets_low_20-150Hz'])} low onsets")
    print("read next:", ", ".join(os.path.basename(s) for s in sh)); print("draft:", d)
