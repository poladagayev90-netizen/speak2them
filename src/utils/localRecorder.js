let mediaRecorder = null;
let audioChunks = [];

export function startLocalRecording(stream) {
  audioChunks = [];
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };
  mediaRecorder.start(1000); // collect chunks every 1 second
}

export function stopLocalRecording() {
  return new Promise((resolve) => {
    if (!mediaRecorder) return resolve(null);
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      audioChunks = [];
      resolve(blob);
    };
    mediaRecorder.stop();
  });
}
