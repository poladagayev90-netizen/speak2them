import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.speaklab.app',
  appName: 'SpeakLab',
  webDir: 'build',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  plugins: {
    Keyboard: {
      resize: 'none',
      style: 'dark',
    }
  }
};

export default config;
