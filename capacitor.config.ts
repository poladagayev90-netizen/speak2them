import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.speaklab.app',
  appName: 'SpeakLab',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    // 'none' left the webview at full height when the keyboard opened, so the
    // focused input stayed hidden behind it — you could not see what you were
    // typing. It also meant the window kept ADJUST_NOTHING, which leaves the
    // IME inset in WindowInsets: the safe-area listener then pushed
    // --safe-area-bottom up to the keyboard's height, and every rule using it
    // (App.css) grew a blank gap. 'native' resizes the webview above the
    // keyboard, which fixes both and consumes the IME inset.
    Keyboard: {
      resize: 'native',
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
