#!/usr/bin/env bash
# Moves the AI Studio downloads for topic NN into content/materials/NN and converts them:
#   bash scripts/ingest-materials.sh 03          (REDO=1 bash … 03 re-encodes the kept raw audio)
# Expects ~/Downloads/sl_NN_{cover,ch1,ch2,ch3}.jpg and (optional) sl_epNN.wav.
set -e
NN=$1; D="$(dirname "$0")/../content/materials/$NN"; DL="$HOME/Downloads"
mkdir -p "$D"
for n in cover ch1 ch2 ch3; do
  f="$DL/sl_${NN}_$n.jpg"
  if [ -f "$f" ]; then
    ffmpeg -hide_banner -loglevel error -y -i "$f" -vf "scale='min(1600,iw)':-2" -c:v libwebp -quality 82 "$D/$n.webp"
    mv -f "$f" "$D/$n.src.jpg"; echo "  $n.webp"
  fi
done
w="$DL/sl_ep$NN.wav"
# REDO=1 re-encodes an episode from its kept podcast.raw.wav (then re-run align + set-timings).
if [ -f "$w" ] || { [ "$REDO" = 1 ] && [ -f "$D/podcast.raw.wav" ]; }; then
  [ -f "$w" ] && mv -f "$w" "$D/podcast.raw.wav"
  # Natural TTS speed, no time-stretch (Polad 2026-10-12: the rubberband 0.86 slow-down
  # made the voices sound degraded). Learners who want it slower use the player's 0.9× / 0.8×.
  ffmpeg -hide_banner -loglevel error -y -i "$D/podcast.raw.wav" -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ac 1 -ar 44100 -b:a 128k "$D/podcast.mp3"
  echo "  podcast.mp3 $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$D/podcast.mp3")s"
fi
