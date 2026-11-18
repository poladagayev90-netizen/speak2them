import { Capacitor } from '@capacitor/core';

// Profile → «Share SpeakLab» (Polad, 2026-11-19, docs/IDEAS.md item 6).
// The link carries UTM tags so Vercel Analytics (utils/webAnalytics.js keeps
// only utm_* in the URL) can count the visits a share brings.
export const SHARE_URL = 'https://speaklab-app.vercel.app/?utm_source=share&utm_medium=app';
export const SHARE_TITLE = 'SpeakLab';
// What the product gives — never a fear (copy-tone rule).
export const SHARE_TEXT = 'Speak English with real partners on SpeakLab: planned practice calls and a clear report after each one.';

// Which way to share on this device. Pure, so it is tested.
//   native    — the Android app with the @capacitor/share plugin in its build
//               (an AAB built before 2026-11-19 does not have it: Capacitor
//               reports the plugin as unavailable and we fall through);
//   webshare  — the browser's own share sheet (phones, some desktops);
//   copy      — everything else, Android WebView included (it has no
//               navigator.share): the link goes to the clipboard.
export function pickShareMethod({ native, pluginAvailable, hasWebShare }) {
  if (native && pluginAvailable) return 'native';
  if (hasWebShare) return 'webshare';
  return 'copy';
}

const isCancel = (e) => {
  const msg = String(e?.message || e || '').toLowerCase();
  return e?.name === 'AbortError' || msg.includes('cancel') || msg.includes('abort');
};

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall back below */ }
  // Older WebViews: the execCommand route still works there.
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// Shares the app. Resolves to 'shared' | 'copied' | 'cancelled' | 'failed'.
export async function shareApp() {
  const method = pickShareMethod({
    native: Capacitor.isNativePlatform(),
    pluginAvailable: Capacitor.isPluginAvailable('Share'),
    hasWebShare: typeof navigator !== 'undefined' && typeof navigator.share === 'function',
  });

  if (method === 'native') {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: SHARE_URL, dialogTitle: 'Share SpeakLab' });
      return 'shared';
    } catch (e) {
      if (isCancel(e)) return 'cancelled';
      // A plugin failure should still leave the learner with the link.
    }
  } else if (method === 'webshare') {
    try {
      await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: SHARE_URL });
      return 'shared';
    } catch (e) {
      if (isCancel(e)) return 'cancelled';
    }
  }

  return (await copyText(`${SHARE_TEXT} ${SHARE_URL}`)) ? 'copied' : 'failed';
}
