let mediaRecorder = null;
let audioChunks = [];
let audioContext = null;
let mixedDestination = null;
let localSource = null;
let remoteGainNode = null;


export function startLocalRecording(localAgoraTrack) {
  try {
    audioChunks = [];
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    mixedDestination = audioContext.createMediaStreamDestination();

    // Local mic from Agora track
    const localStream = new MediaStream([localAgoraTrack.getMediaStreamTrack()]);
    localSource = audioContext.createMediaStreamSource(localStream);
    localSource.connect(mixedDestination);

    // Remote audio mixing has been disabled so the AI analysis only evaluates the local user's speech.
    // remoteGainNode = audioContext.createGain();
    // remoteGainNode.connect(mixedDestination);

    let options = { mimeType: 'audio/webm;codecs=opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'audio/webm' };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'audio/mp4' };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = {};
    }

    mediaRecorder = new MediaRecorder(mixedDestination.stream, options);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.start(1000);
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

export function stopLocalRecording() {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      resolve(null);
      return;
    }
    mediaRecorder.onstop = async () => {
      const actualMime = mediaRecorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunks, { type: actualMime });
      audioChunks = [];
      // Cleanup
      try { localSource?.disconnect(); } catch (e) {}
      try { remoteGainNode?.disconnect(); } catch (e) {}
      try { audioContext?.close(); } catch (e) {}
      audioContext = null;
      mixedDestination = null;
      localSource = null;
      remoteGainNode = null;
      mediaRecorder = null;
      
      console.log(`[Recorder] Stopped. Size: ${audioBlob.size}, Mime: ${actualMime}`);
      if (audioBlob.size < 100) {
        return resolve(null);
      }
      
      // Sending raw audio blob to reduce file size
      // This prevents hitting the Groq 25MB API limit for long calls
      resolve(audioBlob);
    };
    mediaRecorder.stop();
  });
}
