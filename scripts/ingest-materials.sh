#!/usr/bin/env bash
# Moves the AI Studio downloads for topic NN into content/materials/NN and converts them:
#   bash scripts/ingest-materials.sh 03
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
if [ -f "$w" ]; then
  mv -f "$w" "$D/podcast.raw.wav"
  # 3.8 TTS speaks ~175 wpm; rubberband keeps pitch/formants while slowing to ~150 wpm.
  ffmpeg -hide_banner -loglevel error -y -i "$D/podcast.raw.wav" -af "rubberband=tempo=0.86:pitchq=quality:formant=preserved:transients=smooth,loudnorm=I=-16:TP=-1.5:LRA=11" -ac 1 -ar 44100 -b:a 80k "$D/podcast.mp3"
  echo "  podcast.mp3 $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$D/podcast.mp3")s"
fi
