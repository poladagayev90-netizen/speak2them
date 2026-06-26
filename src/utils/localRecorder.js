let mediaRecorder = null;
let audioChunks = [];

export function startLocalRecording(stream) {
  try {
    if (!window.MediaRecorder) {
      console.warn('MediaRecorder is not supported in this browser.');
      return;
    }
    
    audioChunks = [];
    let options = { mimeType: 'audio/webm;codecs=opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = {}; // let browser choose default
      }
    }
    
    mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.start(1000);
  } catch (err) {
    console.error('Failed to start local recording:', err);
    mediaRecorder = null;
  }
}

export function stopLocalRecording() {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      mediaRecorder = null;
      return resolve(null);
    }
    
    // Safety timeout to prevent hanging if onstop never fires
    const timeout = setTimeout(() => {
      console.warn('MediaRecorder stop timed out');
      mediaRecorder = null;
      resolve(null);
    }, 2000);

    mediaRecorder.onstop = () => {
      clearTimeout(timeout);
      try {
        const mime = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunks, { type: mime });
        audioChunks = [];
        mediaRecorder = null;
        resolve(blob);
      } catch (err) {
        console.error('Error creating audio blob:', err);
        resolve(null);
      }
    };

    try {
      mediaRecorder.stop();
    } catch (err) {
      console.error('Error stopping MediaRecorder:', err);
      clearTimeout(timeout);
      mediaRecorder = null;
      resolve(null);
    }
  });
}
