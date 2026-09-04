import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.anasan.barcode",
  appName: "Anasan Barcode",
  webDir: "dist/public",
  bundledWebRuntime: false,
  android: {
    path: "capacitor-android",
    buildOptions: {
      keystorePath: undefined,
    },
  },
  ios: {
    path: "capacitor-ios",
    contentInset: "always",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#0A0B0E",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0A0B0E",
    },
  },
};

export default config;
