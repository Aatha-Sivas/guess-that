import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Guess That',
  slug: 'guess-that',
  scheme: 'guessthat',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#000000ff',
  },
  ios: {
    infoPlist: {
      NSAppTransportSecurity: { NSAllowsArbitraryLoads: true }, // ? enable HTTP requests
    },
    supportsTablet: true,
  },
  android: {
    package: 'ch.guessthat.app',
    versionCode: 1,
    edgeToEdgeEnabled: true,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffffff',
    },
  },
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    eas: {
      projectId: "1a56abe8-56da-46a2-88e9-5a69ac09a6e2"
    }
  },
  plugins: [
    [
      "expo-build-properties",
      {
        android: {
          usesCleartextTraffic: true, //enable HTTP requests (REMOVE FOR PROD)
        },
        ios: {
          flipper: true,
        }
      }
    ]
  ]
};

export default config;
