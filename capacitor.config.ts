import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nexus.app',
  appName: 'Nexus',
  webDir: 'www',
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#0d0d0d",
      androidScaleType: "CENTER",
      showSpinner: true,
      androidSpinnerStyle: "large",
      spinnerColor: "#c2185b"
    }
  }
};

export default config;
