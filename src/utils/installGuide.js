// Which browser is this, and how does one add a web app to the home screen in
// it? Pure (takes the user agent), so InstallGate stays a view and the
// detection is tested (installGuide.test.js).
//
// Every browser hides «Add to Home Screen» somewhere else — Safari behind
// Share, Chrome behind ⋮, Samsung Internet behind ≡ at the bottom, Edge behind
// ⋯ at the bottom. A single generic «open the menu» step lost people, so each
// one gets its own steps, named the way that browser names them, and `where`
// says where its button sits so the gate can point at it.

export function iosVersion(ua) {
  const m = /OS (\d+)[_.](\d+)/.exec(ua || '');
  return m ? Number(m[1]) + Number(m[2]) / 100 : null;
}

export function detectBrowser(ua = '', { platform = '', maxTouchPoints = 0 } = {}) {
  const ios = /iP(hone|ad|od)/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  if (/FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|musical_ly|BytedanceWebview|Snapchat|MicroMessenger|; wv\)/i.test(ua)) return 'inapp';
  if (ios) {
    if (/CriOS/.test(ua)) return 'ios-chrome';
    if (/FxiOS/.test(ua)) return 'ios-firefox';
    if (/EdgiOS/.test(ua)) return 'ios-edge';
    if (/OPiOS|YaBrowser|GSA\//.test(ua)) return 'ios-other';
    return 'ios-safari';
  }
  if (android) {
    if (/SamsungBrowser/.test(ua)) return 'samsung';
    if (/Firefox/.test(ua)) return 'android-firefox';
    if (/EdgA/.test(ua)) return 'android-edge';
    if (/OPR\/|Opera/.test(ua)) return 'opera';
    if (/YaBrowser|YaSearchBrowser/.test(ua)) return 'yandex';
    if (/MiuiBrowser|XiaoMi/.test(ua)) return 'miui';
    if (/Chrome\//.test(ua)) return 'android-chrome';
    return 'android-other';
  }
  return 'desktop';
}

// Before iOS 16.4 only Safari could add a web app to the home screen.
export const iosNeedsSafari = (ua) => {
  const v = iosVersion(ua);
  return v !== null && v < 16.04;
};

// icon: a lucide name the gate maps to a component (no JSX here).
// where: where that browser's button is — 'top-right' | 'bottom' | 'bottom-right'.
const GUIDES = {
  'ios-safari': {
    name: 'Safari',
    where: 'bottom',
    steps: [
      { icon: 'Share', text: 'Tap the Share button', hint: 'The square with an arrow, in the bar at the bottom. On iOS 26, tap ⋯ first.' },
      { icon: 'SquarePlus', text: 'Choose «Add to Home Screen»', hint: 'Scroll the list down if you do not see it.' },
      { icon: 'Check', text: 'Tap «Add»', hint: 'Keep «Open as Web App» on.' },
    ],
  },
  'ios-chrome': {
    name: 'Chrome',
    where: 'top-right',
    steps: [
      { icon: 'Share', text: 'Tap the Share button', hint: 'At the right end of the address bar.' },
      { icon: 'SquarePlus', text: 'Choose «Add to Home Screen»', hint: 'If it is not listed, tap «More» or «Edit Actions».' },
      { icon: 'Check', text: 'Tap «Add»' },
    ],
  },
  'ios-firefox': {
    name: 'Firefox',
    where: 'bottom-right',
    steps: [
      { icon: 'Menu', text: 'Tap the menu ☰', hint: 'Bottom right.' },
      { icon: 'Share', text: 'Tap «Share»' },
      { icon: 'SquarePlus', text: 'Choose «Add to Home Screen», then «Add»' },
    ],
  },
  'ios-edge': {
    name: 'Edge',
    where: 'bottom',
    steps: [
      { icon: 'MoreHorizontal', text: 'Tap ⋯', hint: 'In the middle of the bottom bar.' },
      { icon: 'Share', text: 'Tap «Share»' },
      { icon: 'SquarePlus', text: 'Choose «Add to Home Screen», then «Add»' },
    ],
  },
  'ios-other': {
    name: 'this browser',
    where: 'bottom',
    steps: [
      { icon: 'Share', text: 'Open the Share menu' },
      { icon: 'SquarePlus', text: 'Choose «Add to Home Screen», then «Add»', hint: 'Not there? Open this page in Safari and do the same.' },
    ],
  },
  'android-chrome': {
    name: 'Chrome',
    where: 'top-right',
    steps: [
      { icon: 'MoreVertical', text: 'Tap the menu ⋮', hint: 'Top right, next to the address bar.' },
      { icon: 'Download', text: 'Choose «Add to Home screen» or «Install app»' },
      { icon: 'Check', text: 'Tap «Install»' },
    ],
  },
  samsung: {
    name: 'Samsung Internet',
    where: 'bottom-right',
    steps: [
      { icon: 'Menu', text: 'Tap the menu ≡', hint: 'Bottom right.' },
      { icon: 'SquarePlus', text: 'Choose «Add page to»', hint: 'On some versions: «Add to».' },
      { icon: 'Check', text: 'Choose «Home screen», then «Add»' },
    ],
  },
  'android-firefox': {
    name: 'Firefox',
    where: 'top-right',
    steps: [
      { icon: 'MoreVertical', text: 'Tap the menu ⋮', hint: 'Next to the address bar — top or bottom.' },
      { icon: 'SquarePlus', text: 'Choose «Add app to Home screen»', hint: 'Older versions: «Install» or «Add to Home screen».' },
      { icon: 'Check', text: 'Tap «Add»' },
    ],
  },
  'android-edge': {
    name: 'Edge',
    where: 'bottom',
    steps: [
      { icon: 'MoreHorizontal', text: 'Tap ⋯', hint: 'In the middle of the bottom bar.' },
      { icon: 'Smartphone', text: 'Choose «Add to phone»' },
      { icon: 'Check', text: 'Tap «Install»' },
    ],
  },
  opera: {
    name: 'Opera',
    where: 'top-right',
    steps: [
      { icon: 'MoreVertical', text: 'Tap the menu ⋮', hint: 'Top right.' },
      { icon: 'SquarePlus', text: 'Choose «Add to…»' },
      { icon: 'Check', text: 'Choose «Home screen», then «Add»' },
    ],
  },
  yandex: {
    name: 'Yandex Browser',
    where: 'bottom-right',
    steps: [
      { icon: 'MoreVertical', text: 'Tap the menu ⋮', hint: 'In the bar with the address.' },
      { icon: 'SquarePlus', text: 'Choose «Add shortcut»', hint: 'Or «Add to Home screen».' },
      { icon: 'Check', text: 'Tap «Add»' },
    ],
  },
  miui: {
    name: 'Mi Browser',
    where: 'bottom-right',
    steps: [
      { icon: 'Menu', text: 'Tap the menu ≡', hint: 'Bottom right.' },
      { icon: 'SquarePlus', text: 'Choose «Add to» → «Home screen»' },
      { icon: 'Check', text: 'Tap «Add»', hint: 'Not working? Open this page in Chrome.' },
    ],
  },
  'android-other': {
    name: 'this browser',
    where: 'top-right',
    steps: [
      { icon: 'MoreVertical', text: 'Open the browser menu' },
      { icon: 'SquarePlus', text: 'Choose «Add to Home screen» or «Install app»', hint: 'Not there? Open this page in Chrome.' },
    ],
  },
  inapp: {
    name: 'an in-app browser',
    where: 'top-right',
    steps: [
      { icon: 'MoreHorizontal', text: 'Tap ⋯ or ⋮ in the top corner' },
      { icon: 'ExternalLink', text: 'Choose «Open in browser»', hint: 'Or copy the link below and paste it into Safari or Chrome.' },
      { icon: 'SquarePlus', text: 'Add SpeakLab to the home screen from there' },
    ],
  },
};

// The browsers a person can pick by hand when the guess is wrong.
export const PICKABLE = {
  ios: ['ios-safari', 'ios-chrome', 'ios-firefox', 'ios-edge'],
  android: ['android-chrome', 'samsung', 'android-firefox', 'android-edge', 'opera', 'yandex', 'miui'],
};

export function guideFor(browser, ua = '') {
  if (browser.startsWith('ios-') && browser !== 'ios-safari' && iosNeedsSafari(ua)) {
    return {
      name: GUIDES[browser]?.name || 'this browser',
      where: 'top-right',
      needsSafari: true,
      steps: [
        { icon: 'Copy', text: 'Copy the link below', hint: 'On this iOS version only Safari can add apps to the home screen.' },
        { icon: 'Globe', text: 'Open Safari and paste it' },
        { icon: 'Share', text: 'Share → «Add to Home Screen» → «Add»' },
      ],
    };
  }
  return GUIDES[browser] || GUIDES['android-other'];
}
