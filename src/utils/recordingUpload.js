import { ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase';

// Uploads the post-call recording to Storage and returns its path.
// The analysis worker (Cloud Function) downloads it from there, so the
// client never ships multi-MB base64 payloads to a function again.
export async function uploadCallRecording(blob, uid, callDocId, sessionId) {
  const ext = (blob.type || "").includes("mp4") ? "mp4" : "webm";
  const storagePath = `callRecordings/${uid}/${callDocId}_${sessionId}.${ext}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob, { contentType: blob.type || "audio/webm" });
  console.log('[Recorder] Uploaded recording to', storagePath);
  return storagePath;
}
