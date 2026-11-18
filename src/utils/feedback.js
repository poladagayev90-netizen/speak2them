// Profile → «Help & feedback» (Polad, 2026-11-19, docs/IDEAS.md item 5).
// A learner's message goes to the `feedback` collection: create-only for the
// signed-in owner, read by the admin only (firestore.rules). Nothing from it
// is copied to `users` (world-readable). Pure helpers here are tested.

export const FEEDBACK_TYPES = [
  { id: 'problem', label: 'Problem' },
  { id: 'idea', label: 'Idea' },
  { id: 'other', label: 'Other' },
];

export const FEEDBACK_TEXT_MAX = 2000;
// A screenshot is stored inline as a JPEG data URL (no Storage bucket rules to
// keep in step). The rules cap it at this many characters, so one feedback doc
// stays well under Firestore's 1 MiB and the admin list loads quickly.
export const SCREENSHOT_MAX_CHARS = 350000;

export function feedbackTypeLabel(id) {
  return (FEEDBACK_TYPES.find((t) => t.id === id) || { label: 'Other' }).label;
}

// The doc as the rules expect it (keys().hasOnly in firestore.rules — change
// both together). `createdAt` is added by the caller as serverTimestamp().
export function buildFeedbackDoc({ uid, type, text, appVersion, platform, route, userAgent, screenshot }) {
  const clean = String(text || '').trim().slice(0, FEEDBACK_TEXT_MAX);
  const doc = {
    uid,
    type: FEEDBACK_TYPES.some((t) => t.id === type) ? type : 'other',
    text: clean,
    appVersion: String(appVersion || '').slice(0, 20),
    platform: ['web', 'android', 'ios'].includes(platform) ? platform : 'web',
    route: String(route || '').slice(0, 200),
    status: 'new',
  };
  if (userAgent) doc.userAgent = String(userAgent).slice(0, 300);
  if (screenshot && typeof screenshot === 'string'
    && screenshot.startsWith('data:image/jpeg;base64,')
    && screenshot.length <= SCREENSHOT_MAX_CHARS) {
    doc.screenshot = screenshot;
  }
  return doc;
}

export const canSendFeedback = (text) => String(text || '').trim().length >= 3;

// Shrinks a picked image to a JPEG data URL under SCREENSHOT_MAX_CHARS, or
// resolves null when it cannot (not an image, too big even small). Browser only.
export function shrinkScreenshot(file) {
  return new Promise((resolve) => {
    if (!file || !/^image\//.test(file.type || '')) { resolve(null); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      // Phone screenshots are tall: cap the long side, then lower quality
      // and size step by step until it fits.
      const tries = [[1280, 0.7], [1080, 0.6], [900, 0.5], [720, 0.45]];
      for (const [side, q] of tries) {
        const scale = Math.min(1, side / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) break;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL('image/jpeg', q);
        if (data.length <= SCREENSHOT_MAX_CHARS) { resolve(data); return; }
      }
      resolve(null);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
