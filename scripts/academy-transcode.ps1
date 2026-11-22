# SpeakLab Academy — transcode the master chapter clips for the web.
#
# Masters are 10.5 Mbps CBR (~56 MB for a 42 s chapter). The tutorials are
# mostly still UI with slow motion graphics, so CRF 24 at native resolution
# lands at ~3 MB per chapter with sharp text (measured 2026-11-22 on T02 ch2).
#
# One ffmpeg at a time, half the cores (affinity 63) at BelowNormal — the
# laptop overheats under a full-core encode.
#
# Output: <OutDir>/<series>/<lang>/chN_916.mp4 | chN_169.mp4 | chN_916.jpg | chN_169.jpg
# Upload: node scripts/academy-upload.cjs <OutDir>
param(
  [string]$Manifest = 'C:\Users\p\Desktop\Claude_Videos\SpeakLab\_work\SPEAKLAB_ACADEMY_MANIFEST.json',
  [string]$OutDir = 'D:\academy_out'
)
$ErrorActionPreference = 'Stop'
$m = Get-Content $Manifest -Raw -Encoding UTF8 | ConvertFrom-Json

function Invoke-Low([string]$argLine) {
  $p = Start-Process ffmpeg -ArgumentList $argLine -PassThru -NoNewWindow
  # PS 5.1: ExitCode stays $null unless the handle is touched before exit.
  $null = $p.Handle
  try { $p.ProcessorAffinity = 63; $p.PriorityClass = 'BelowNormal' } catch {}
  $p.WaitForExit()
  if ($p.ExitCode -ne 0) { throw "ffmpeg failed: $argLine" }
}

foreach ($c in $m.courses) {
  $dir = Join-Path $OutDir (Join-Path $c.series $c.language)
  New-Item -ItemType Directory -Force $dir | Out-Null
  foreach ($ch in $c.chapters) {
    foreach ($v in @(@('916', $ch.video9x16.file), @('169', $ch.video16x9Path))) {
      $mp4 = Join-Path $dir "$($ch.id)_$($v[0]).mp4"
      $jpg = Join-Path $dir "$($ch.id)_$($v[0]).jpg"
      if (-not (Test-Path $mp4)) {
        Invoke-Low "-y -loglevel error -i `"$($v[1])`" -c:v libx264 -preset slow -crf 24 -profile:v high -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart `"$mp4`""
      }
      if (-not (Test-Path $jpg)) {
        # Poster: a frame 1 s in (past the fade-in), half size — it only shows until play.
        Invoke-Low "-y -loglevel error -ss 1 -i `"$mp4`" -frames:v 1 -vf scale=iw/2:-2 -q:v 4 `"$jpg`""
      }
      Write-Output ("done {0}/{1}/{2}_{3} {4:N2} MB" -f $c.series, $c.language, $ch.id, $v[0], ((Get-Item $mp4).Length / 1MB))
    }
  }
}
Write-Output 'ALL DONE'
