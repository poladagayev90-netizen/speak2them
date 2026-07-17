import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.speaklab.app',
  appName: 'SpeakLab',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    // ROOT CAUSE of the keyboard blank-gap: Capacitor core's own SystemBars
    // plugin pads the webview by the IME height (SystemBars.java:208) AND
    // @capacitor-community/safe-area does the exact same thing, so the webview
    // shrank by the keyboard height TWICE (measured: innerHeight 872→226 with a
    // ~275px keyboard). Disabling core's inset handling — which the safe-area
    // plugin explicitly requires (it logs an error otherwise) — leaves the
    // safe-area plugin as the single owner of the IME, and the gap closes.
    SystemBars: {
      insetsHandling: 'disable',
    },
    // Must stay 'none': @capacitor-community/safe-area already owns the IME.
    // Its window-insets listener pads the decor view by imeInsets.bottom while
    // the keyboard is up (SafeAreaPlugin.java), which is what lifts the content
    // clear of it — and it deliberately keeps the IME out of the safe-area
    // insets it reports to JS (getBottomInset returns systemBars.bottom only).
    // Setting 'native' makes the window ALSO adjustResize, so the view gets
    // pushed up twice and a keyboard-sized blank gap opens above it.
    Keyboard: {
      resize: 'none',
      style: 'dark',
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#0f0f17",
      showSpinner: false
    }
  }
};

export default config;
