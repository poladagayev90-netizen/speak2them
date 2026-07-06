let mediaRecorder = null;
let audioChunks = [];
let audioContext = null;
let mixedDestination = null;
let localSource = null;
let remoteGainNode = null;

async function convertWebmToWav(webmBlob) {
  try {
    const arrayBuffer = await webmBlob.arrayBuffer();
    // Use an offline context to decode, avoiding playback
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    
    // Encode to WAV
    const numOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    let resultBuffer;
    if (numOfChannels === 2) {
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.getChannelData(1);
      const length = left.length + right.length;
      resultBuffer = new Float32Array(length);
      for (let i = 0; i < left.length; i++) {
        resultBuffer[i * 2] = left[i];
        resultBuffer[i * 2 + 1] = right[i];
      }
    } else {
      resultBuffer = audioBuffer.getChannelData(0);
    }
    
    const buffer = new ArrayBuffer(44 + resultBuffer.length * 2);
    const view = new DataView(buffer);
    
    const writeString = (view, offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + resultBuffer.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numOfChannels * 2, true);
    view.setUint16(32, numOfChannels * 2, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, resultBuffer.length * 2, true);
    
    let offset = 44;
    for (let i = 0; i < resultBuffer.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, resultBuffer[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    
    return new Blob([view], { type: 'audio/wav' });
  } catch (err) {
    console.error('Wav conversion failed:', err);
    return webmBlob; // fallback
  }
}

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

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    mediaRecorder = new MediaRecorder(mixedDestination.stream, { mimeType });
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
      const webmBlob = new Blob(audioChunks, { type: 'audio/webm' });
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
      
      console.log('[Recorder] Stopped. WebM size:', webmBlob.size);
      if (webmBlob.size < 100) {
        return resolve(null);
      }
      
      const wavBlob = await convertWebmToWav(webmBlob);
      console.log('[Recorder] Converted to WAV, size:', wavBlob.size);
      resolve(wavBlob);
    };
    mediaRecorder.stop();
  });
}
