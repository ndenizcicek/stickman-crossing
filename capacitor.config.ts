import type { CapacitorConfig } from '@capacitor/cli';

// The bundle ID is permanent once the app is on the App Store. Change it now if you want a different one
// (reverse-domain style, only letters, digits and dots).
const config: CapacitorConfig = {
  appId: 'com.stickmancrossing.game',
  appName: 'Stickman Crossing',
  webDir: 'dist',
  backgroundColor: '#f5f8fa',
  ios: {
    contentInset: 'never',
    backgroundColor: '#f5f8fa',
  },
  android: {
    backgroundColor: '#f5f8fa',
  },
};

export default config;
