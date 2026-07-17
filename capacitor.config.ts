import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.speaklab.app',
  appName: 'SpeakLab',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  },
  plugins: {
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
