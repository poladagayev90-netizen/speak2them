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

    // Remote audio will be added via addRemoteStream()
    remoteGainNode = audioContext.createGain();
    remoteGainNode.connect(mixedDestination);

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    mediaRecorder = new MediaRecorder(mixedDestination.stream, { mimeType });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.start(1000);
    console.log('[Recorder] Started recording both sides');
  } catch (e) {
    console.error('[Recorder] Failed to start recording:', e);
  }
}

export function addRemoteStream(remoteAudioTrack) {
  try {
    if (!audioContext || !remoteGainNode) return;
    const remoteStream = new MediaStream([remoteAudioTrack.getMediaStreamTrack()]);
    const remoteSource = audioContext.createMediaStreamSource(remoteStream);
    remoteSource.connect(remoteGainNode);
    console.log('[Recorder] Remote audio added to recording');
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
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
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
      console.log('[Recorder] Stopped. Blob size:', blob.size);
      resolve(blob.size > 100 ? blob : null);
    };
    mediaRecorder.stop();
  });
}
