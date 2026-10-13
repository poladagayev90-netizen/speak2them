#!/usr/bin/env bash
# Finishes podcast episodes after podcast-tts.cjs / podcast-images.cjs:
#   bash scripts/podcast-finish.sh 39 40        (NOUP=1 → everything but the upload)
# Pictures (+ a new ~/Downloads/sl_epNN.wav) → content/materials/NN; with new audio it also
# aligns the lines (Whisper), fills a missed line between its neighbours and writes the timings.
# Then uploads to Storage and writes src/data/topicMaterials/NN.json — commit + push after.
cd "$(dirname "$0")/.."
for NN in "$@"; do
  echo "=== $NN"
  NEWAUDIO=0; [ -f ~/Downloads/sl_ep$NN.wav ] && NEWAUDIO=1
  bash scripts/ingest-materials.sh $NN | tr '\n' ' '; echo
  if [ $NEWAUDIO = 1 ]; then
    M=content/materials/$NN/podcast.mp3
    DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $M)
    AT=$(python scripts/align-listening.py $M content/materials/$NN.podcast.json 2>/dev/null | tail -1)
    FILLED=$(node -e '
      const a=JSON.parse(process.argv[1]); const d=+process.argv[2];
      for(let i=0;i<a.length;i++) if(a[i]==null){let p=i-1;while(p>=0&&a[p]==null)p--;let n=i+1;while(n<a.length&&a[n]==null)n++;
        const lo=p>=0?a[p]:0, hi=n<a.length?a[n]:d; a[i]=+(lo+(hi-lo)*(i-p)/(n-p)).toFixed(2); console.error("  null filled at line",i);}
      for(let i=1;i<a.length;i++) if(a[i]<=a[i-1]) console.error("  NONMONOTONIC at",i);
      console.log(JSON.stringify(a));' "$AT" "$DUR")
    node scripts/set-timings.cjs $NN "$FILLED" $(printf '%.1f' $DUR)
  fi
  [ "$NOUP" = 1 ] || node scripts/upload-materials.cjs $NN 2>&1 | tail -2
done
