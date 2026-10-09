import { Capacitor, registerPlugin } from '@capacitor/core';

// The Android app's own CallSetupPlugin (android/.../CallSetupPlugin.java):
// which phone settings stop a call from ringing on a sleeping phone, and the
// way to each settings page. Web and APKs older than v33 have no plugin —
// callSetupStatus() returns null there and the card stays hidden.
const CallSetup = registerPlugin('CallSetup');

export const hasCallSetup = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
  && Capacitor.isPluginAvailable('CallSetup');

export async function callSetupStatus() {
  if (!hasCallSetup()) return null;
  try {
    return await CallSetup.status();
  } catch {
    return null;
  }
}

export async function openCallSetting(target) {
  try {
    await CallSetup.open({ target });
  } catch {
    /* no settings page on this phone */
  }
}

// Makers whose battery savers close apps WhatsApp-style apps are exempted
// from by hand: they also have their own «autostart» switch.
const AUTOSTART_MAKERS = ['xiaomi', 'redmi', 'poco', 'oppo', 'realme', 'oneplus', 'vivo', 'iqoo', 'huawei', 'honor'];

// The checklist, in the order a person should fix it. Pure: takes status().
export function callSetupSteps(status) {
  if (!status) return [];
  const steps = [
    { id: 'notifications', ok: status.notifications !== false, title: 'Notifications on',
      fix: 'Turn on notifications for SpeakLab.' },
    { id: 'channel', ok: status.callChannel !== false, title: 'Calls ring',
      fix: 'Open «Calls» and allow sound and pop-up.' },
    { id: 'fullScreen', ok: status.fullScreen !== false, title: 'Full-screen calls',
      fix: 'Allow full-screen notifications, so a call shows on the lock screen.' },
    { id: 'battery', ok: status.battery !== false, title: 'Not put to sleep',
      fix: 'App info → Battery → «Unrestricted».' },
  ];
  if (AUTOSTART_MAKERS.includes(String(status.manufacturer || '').toLowerCase())) {
    steps.push({ id: 'autostart', ok: null, title: 'Autostart',
      fix: 'Your phone also has an «Autostart» switch — turn it on for SpeakLab.' });
  }
  return steps;
}

// Something that certainly stops the ring (autostart cannot be read: null).
export const callSetupBroken = (status) => callSetupSteps(status).some((s) => s.ok === false);
