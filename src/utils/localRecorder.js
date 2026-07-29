let mediaRecorder = null;
let audioChunks = [];
let audioContext = null;
let mixedDestination = null;
let localSource = null;
let remoteGainNode = null;

// ─── Sükut kəsmə (VAD) ────────────────────────────────────────────────
// Yazıya YALNIZ istifadəçinin öz mikrofonu düşür (aşağıdakı remote-mix
// qəsdən söndürülüb), yəni partnyor danışarkən bizim yazımız sükutdur.
// Real söhbətdə adam vaxtın ~40-50%-ini danışır — qalanı boş səsdir və
// biz onun hər saniyəsi üçün Deepgram-a pul veririk. Uzun sükut
// aralıqlarında MediaRecorder-i pause edirik: fayl qısalır, atılan
// hissədə onsuz da söz olmadığı üçün analiz keyfiyyəti dəyişmir.
//
// Ölçmə setInterval ilə YOX, ScriptProcessor ilə audio thread-də aparılır.
// Arxa fona düşən Android WebView JS timer-lərini boğur (capacitor-expert
// skill) — timer əsaslı VAD orada gecikib sözün əvvəlini kəsərdi.
let vadProcessor = null;
let vadSink = null;
let voicedSamples = 0;
let noiseFloor = 0.01;
let lastSpeechAt = 0;
let onVisibility = null;

// Yalnız BU müddətdən uzun sükut kəsilir. Cümlə arası nəfəs və söz arası
// fasilələr toxunulmaz qalır — kəsilən şey partnyorun danışdığı növbədir.
// Qısa tutsaq sözün quyruğu gedər, uzun tutsaq qənaət azalar.
const SILENCE_HANGOVER_MS = 1500;
// Səs-küy döşəməsinə nisbətən nə qədər yüksək səs "danışıq" sayılır.
// Meyl bilərəkdən audio saxlamağa yönəlib: yanlış "danışıq" bir neçə
// saniyəlik xərcdir, yanlış "sükut" isə itmiş sözdür.
const SPEECH_OVER_FLOOR = 2.5;
const ABSOLUTE_FLOOR_RMS = 0.004;
const VAD_BUFFER_SIZE = 2048; // ~46 ms @44.1 kHz — sözün başlanğıcını tutmaq üçün kifayət qədər tez

function recorderIsRecording() {
  return mediaRecorder && mediaRecorder.state === 'recording';
}

function resumeRecording() {
  if (mediaRecorder && mediaRecorder.state === 'paused') {
    try { mediaRecorder.resume(); } catch (e) {}
  }
}

function pauseRecording() {
  if (recorderIsRecording()) {
    try { mediaRecorder.pause(); } catch (e) {}
  }
}

function startVad() {
  // pause/resume olmayan brauzerdə (köhnə Safari) VAD-ı ümumiyyətlə qurmuruq
  // — hər şey əvvəlki kimi, tam yazılır.
  if (typeof mediaRecorder.pause !== 'function' || typeof mediaRecorder.resume !== 'function') {
    console.log('[Recorder] pause/resume yoxdur — sükut kəsmə söndürüldü');
    return;
  }

  vadProcessor = audioContext.createScriptProcessor(VAD_BUFFER_SIZE, 1, 1);
  // ScriptProcessor bəzi brauzerlərdə yalnız destination-a qoşulanda işə düşür.
  // Gain 0 → dinamikə heç nə çıxmır, əks-səda riski yoxdur.
  vadSink = audioContext.createGain();
  vadSink.gain.value = 0;
  localSource.connect(vadProcessor);
  vadProcessor.connect(vadSink);
  vadSink.connect(audioContext.destination);

  lastSpeechAt = audioContext.currentTime * 1000;

  vadProcessor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
    const rms = Math.sqrt(sum / input.length);

    // Uyğunlaşan səs-küy döşəməsi: mikrofon səviyyələri cihazdan cihaza
    // onlarla dəfə fərqlənir, sabit həddi hamıya uyğunlaşdırmaq mümkün deyil.
    // Aşağı sürətlə düşür (yeni sakitliyi dərhal qəbul edir), yuxarı çox
    // yavaş qalxır ki, davamlı nitq döşəməni öz səviyyəsinə çəkməsin.
    if (rms < noiseFloor) noiseFloor = rms;
    else noiseFloor += (rms - noiseFloor) * 0.0005;

    const threshold = Math.max(noiseFloor * SPEECH_OVER_FLOOR, ABSOLUTE_FLOOR_RMS);
    const nowMs = e.playbackTime * 1000;

    if (rms > threshold) {
      lastSpeechAt = nowMs;
      resumeRecording();
    } else if (nowMs - lastSpeechAt > SILENCE_HANGOVER_MS) {
      pauseRecording();
    }

    // Yazılan saniyələr = faylın əsl uzunluğu. Divar saatı deyil, məhz bu
    // rəqəm ticket-ə gedir, çünki serverdəki qismən-analiz düsturu bayt
    // nisbətini faylın uzunluğuna bölür.
    if (recorderIsRecording()) voicedSamples += input.length;
  };

  // Arxa fon qorunması: WebView arxa plana keçəndə AudioContext dayana bilər,
  // onaudioprocess susar və recorder "pause" vəziyyətində ilişib qalar —
  // qayıdanda istifadəçinin ilk cümləsi tamamilə itərdi. Görünürlük dəyişən
  // kimi şərtsiz resume edirik; bir neçə saniyəlik sükut itkidən ucuzdur.
  onVisibility = () => {
    resumeRecording();
    lastSpeechAt = audioContext ? audioContext.currentTime * 1000 : 0;
  };
  document.addEventListener('visibilitychange', onVisibility);
}

function stopVad() {
  if (onVisibility) {
    document.removeEventListener('visibilitychange', onVisibility);
    onVisibility = null;
  }
  if (vadProcessor) {
    vadProcessor.onaudioprocess = null;
    try { vadProcessor.disconnect(); } catch (e) {}
    vadProcessor = null;
  }
  if (vadSink) {
    try { vadSink.disconnect(); } catch (e) {}
    vadSink = null;
  }
}

export function startLocalRecording(localAgoraTrack) {
  try {
    audioChunks = [];
    voicedSamples = 0;
    noiseFloor = 0.01;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    mixedDestination = audioContext.createMediaStreamDestination();

    // Local mic from Agora track
    const localStream = new MediaStream([localAgoraTrack.getMediaStreamTrack()]);
    localSource = audioContext.createMediaStreamSource(localStream);
    localSource.connect(mixedDestination);

    // Remote audio mixing has been disabled so the AI analysis only evaluates the local user's speech.
    // remoteGainNode = audioContext.createGain();
    // remoteGainNode.connect(mixedDestination);

    // Bitrate AÇIQ təyin olunur: brauzerin default dəyəri (bəzi cihazlarda
    // 128 kbps) 1 saatlıq zəngdə ~57 MB verir və storage.rules limitini keçib
    // yükləməni səssizcə sındırır — analiz heç vaxt gəlmir. 32 kbps mono Opus
    // nitq üçün kifayətdir (WhatsApp səsli mesajları ~16-24 kbps) və 1 saat
    // ≈ 14 MB edir. STT dəqiqliyinə təsiri yoxdur.
    const AUDIO_BITS_PER_SECOND = 32000;

    let options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: AUDIO_BITS_PER_SECOND };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'audio/webm', audioBitsPerSecond: AUDIO_BITS_PER_SECOND };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'audio/mp4', audioBitsPerSecond: AUDIO_BITS_PER_SECOND };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { audioBitsPerSecond: AUDIO_BITS_PER_SECOND };
    }

    mediaRecorder = new MediaRecorder(mixedDestination.stream, options);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.start(1000);
    // VAD ayrıca qorunur: sükut kəsmə bir bonusdur, yazının özü deyil.
    // Burada atılan istisna recorder-i də sındırsaydı, analiz tamamilə itərdi.
    try {
      startVad();
    } catch (vadError) {
      console.warn('[Recorder] VAD qurula bilmədi, tam yazılır:', vadError);
      stopVad();
    }
    console.log('[Recorder] Started recording local audio only');
  } catch (e) {
    console.error('[Recorder] Failed to start recording:', e);
  }
}

export function addRemoteStream(remoteAudioTrack) {
  try {
    // Disabled to prevent the remote user's speech from being analyzed by the AI as the local user's speech
    // if (!audioContext || !remoteGainNode) return;
    // const remoteStream = new MediaStream([remoteAudioTrack.getMediaStreamTrack()]);
    // const remoteSource = audioContext.createMediaStreamSource(remoteStream);
    // remoteSource.connect(remoteGainNode);
    // console.log('[Recorder] Remote audio added to recording');
  } catch (e) {
    console.error('[Recorder] Failed to add remote stream:', e);
  }
}

// `voicedSeconds` faylın ƏSL uzunluğudur (sükut kəsildikdən sonra qalan).
// Divar saatı ilə eyni deyil və ticket-də ondan ayrıca daşınmalıdır.
export function stopLocalRecording() {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      stopVad();
      resolve({ blob: null, voicedSeconds: 0 });
      return;
    }
    mediaRecorder.onstop = async () => {
      const actualMime = mediaRecorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunks, { type: actualMime });
      audioChunks = [];
      const voicedSeconds = audioContext ? voicedSamples / audioContext.sampleRate : 0;
      // Cleanup
      stopVad();
      try { localSource?.disconnect(); } catch (e) {}
      try { remoteGainNode?.disconnect(); } catch (e) {}
      try { audioContext?.close(); } catch (e) {}
      audioContext = null;
      mixedDestination = null;
      localSource = null;
      remoteGainNode = null;
      mediaRecorder = null;

      console.log(`[Recorder] Stopped. Size: ${audioBlob.size}, Mime: ${actualMime}, voiced: ${voicedSeconds.toFixed(1)}s`);
      if (audioBlob.size < 100) {
        return resolve({ blob: null, voicedSeconds: 0 });
      }

      // Sending raw audio blob to reduce file size
      // This prevents hitting the Groq 25MB API limit for long calls
      resolve({ blob: audioBlob, voicedSeconds });
    };
    // pause vəziyyətindən də stop() işləyir və toplanmış chunk-lar qalır.
    mediaRecorder.stop();
  });
}
