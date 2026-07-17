import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { saveFcmToken } from './firebase';

// Native (APK) push. The web path in firebase.js cannot serve this build at
// all: the Android WebView has no Notification API and no Web Push, so
// isSupported() is false there and no token was ever written — which is why
// pushes never arrived for APK users. Here the token comes from the native FCM
// SDK instead, and lands in the same users/{uid}/fcmTokens collection the
// sender already reads, tagged platform:'android' so the payload is shaped
// correctly for the system tray.

export function isNativePush() {
  return Capacitor.isNativePlatform();
}

// Normalised to match the web's Notification.permission vocabulary so the UI
// can treat both platforms the same: 'granted' | 'denied' | 'default' | 'unsupported'.
export async function getNativePushPermission() {
  if (!isNativePush()) return 'unsupported';
  try {
    const { receive } = await PushNotifications.checkPermissions();
    if (receive === 'prompt' || receive === 'prompt-with-rationale') return 'default';
    return receive; // 'granted' | 'denied'
  } catch {
    return 'unsupported';
  }
}

// Opt-in from a user gesture. Asks for POST_NOTIFICATIONS (required on Android
// 13+) and then registers with FCM; the token itself arrives asynchronously on
// the 'registration' listener that watchNativePush installs.
export async function enableNativePush(uid) {
  if (!isNativePush() || !uid) return 'unsupported';
  try {
    let { receive } = await PushNotifications.checkPermissions();
    if (receive === 'prompt' || receive === 'prompt-with-rationale') {
      ({ receive } = await PushNotifications.requestPermissions());
    }
    if (receive !== 'granted') return receive === 'denied' ? 'denied' : 'default';
    await PushNotifications.register();
    return 'granted';
  } catch (error) {
    console.error('[NativePush] enable failed:', error);
    return 'unsupported';
  }
}

// Session-long listeners. Registers immediately when permission was already
// granted, so a returning user's token is re-written every launch — this is the
// native equivalent of watchFcmToken and covers token rotation. Returns a
// cleanup function.
export function watchNativePush(uid) {
  if (!isNativePush() || !uid) return () => {};

  const handles = [];
  let stopped = false;

  (async () => {
    try {
      handles.push(await PushNotifications.addListener('registration', (token) => {
        if (!token?.value || stopped) return;
        saveFcmToken(uid, token.value, 'android')
          .catch((e) => console.warn('[NativePush] token save failed:', e.message));
      }));

      handles.push(await PushNotifications.addListener('registrationError', (err) => {
        console.error('[NativePush] registration error:', err);
      }));

      // Tapping a notification opens the app; honour the deep link the sender
      // put in the payload (e.g. "/?daily=1" for the daily-question push).
      handles.push(await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const url = action?.notification?.data?.url;
        if (typeof url === 'string' && url.startsWith('/')) {
          window.location.href = url;
        }
      }));

      const { receive } = await PushNotifications.checkPermissions();
      if (receive === 'granted' && !stopped) await PushNotifications.register();
    } catch (error) {
      console.error('[NativePush] watch failed:', error);
    }
  })();

  return () => {
    stopped = true;
    handles.forEach((h) => h?.remove?.());
  };
}
