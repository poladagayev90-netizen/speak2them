import { getMessaging, isSupported } from 'firebase/messaging';
import app, { enableNotifications } from '../firebase';
import { isNativePush, getNativePushPermission, enableNativePush } from '../nativePush';

// One place that knows whether push can be asked for here and asks for it —
// used by the onboarding step (2026-10-15: 9 of 14 newcomers could get no
// push, so a booked practice never reached them) and the Today banner.

// Keeps getMessaging from throwing on browsers where it half-exists.
async function messagingSupported() {
  try {
    if (!(await isSupported())) return false;
    getMessaging(app);
    return true;
  } catch {
    return false;
  }
}

// 'default' (can be asked) | 'granted' | 'denied' | 'unsupported'.
export async function pushPermission() {
  // Native has no Web Notification API at all: ask the plugin instead.
  if (isNativePush()) return getNativePushPermission();
  // No Web Notifications here (e.g. an iOS browser tab) — InstallGate nudges
  // those users to install first, so there is nothing to ask yet.
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return (await messagingSupported()) ? 'default' : 'unsupported';
}

// Must run from a tap (iOS / installed PWAs refuse it otherwise).
export function askPush(uid) {
  return isNativePush() ? enableNativePush(uid) : enableNotifications(uid);
}
