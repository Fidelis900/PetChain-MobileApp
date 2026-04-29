/* eslint-disable @typescript-eslint/no-require-imports, no-undef */

// Load .env.<APP_ENV> via dotenv
const APP_ENV = process.env.APP_ENV ?? 'development';

require('dotenv').config({ path: `.env.${APP_ENV}` });

// Version codes: dev=1, staging=2, prod=3
const VERSION_CODE = { development: 1, staging: 2, production: 3 }[APP_ENV] ?? 1;
const APP_VERSION = '1.0.0';

const APP_NAME_MAP = {
  development: 'PetChain (Dev)',
  staging: 'PetChain (Staging)',
  production: 'PetChain',
};

module.exports = {
  expo: {
    name: APP_NAME_MAP[APP_ENV] ?? 'PetChain',
    slug: 'petchain-mobile',
    version: APP_VERSION,
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
     ios: {
       supportsTablet: true,
       bundleIdentifier:
         APP_ENV === 'production' ? 'app.petchain.mobile' : `app.petchain.mobile.${APP_ENV}`,
       buildNumber: String(VERSION_CODE),
       infoPlist: {
         NSCameraUsageDescription:
           'PetChain needs camera access to scan QR codes for pet identification and medical record sharing.',
         NSPhotoLibraryUsageDescription:
           'PetChain needs photo library access to upload pictures of your pets for their profiles.',
         NSPhotoLibraryAddUsageDescription:
           'PetChain saves photos you take to your pet profile.',
         NSLocationWhenInUseUsageDescription:
           'PetChain uses your location for the Emergency SOS feature to share your whereabouts with emergency contacts when you request help.',
         NSLocationAlwaysAndWhenInUseUsageDescription:
           'PetChain uses your location for the Emergency SOS feature to share your whereabouts with emergency contacts when you request help.',
         NSUserTrackingUsageDescription:
           'PetChain does not track you for advertising purposes.',
         NSFaceIDUsageDescription:
           'PetChain uses Face ID/Touch ID for secure biometric authentication to protect your pet\'s medical data.',
         UIBackgroundModes: ['location', 'background-fetch'],
       },
     },
     android: {
       adaptiveIcon: {
         foregroundImage: './assets/adaptive-icon.png',
         backgroundColor: '#4A90A4',
       },
       package: APP_ENV === 'production' ? 'app.petchain.mobile' : `app.petchain.mobile.${APP_ENV}`,
       versionCode: VERSION_CODE,
       permissions: [
         'CAMERA',
         'ACCESS_FINE_LOCATION',
         'ACCESS_COARSE_LOCATION',
         'POST_NOTIFICATIONS',
         'READ_EXTERNAL_STORAGE',
         'WRITE_EXTERNAL_STORAGE',
         'READ_MEDIA_IMAGES',
       ],
       softwareKeyboardLayoutMode: 'pan',
     },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      [
        '@sentry/react-native/expo',
        {
          organization: 'petchain',
          project: 'mobile-app',
          // Upload source maps so stack traces are human-readable in the dashboard
          uploadNativeSymbols: true,
          uploadSourceMaps: true,
        },
      ],
    ],
     extra: {
       APP_ENV,
       API_BASE_URL:
         process.env.API_BASE_URL ??
         (APP_ENV === 'production'
           ? process.env.PROD_API_URL ?? 'https://api.petchain.app/api'
           : APP_ENV === 'staging'
           ? process.env.STAGING_API_URL ?? 'https://staging.petchain.app/api'
           : 'http://localhost:3000/api'),
       STAGING_API_URL: process.env.STAGING_API_URL ?? 'https://staging.petchain.app/api',
       PROD_API_URL: process.env.PROD_API_URL ?? 'https://api.petchain.app/api',
       API_TIMEOUT: process.env.API_TIMEOUT ?? '10000',
       SENTRY_DSN: process.env.SENTRY_DSN ?? '',
       SENTRY_ENABLE_IN_DEV: process.env.SENTRY_ENABLE_IN_DEV ?? 'false',
       MAX_CACHE_SIZE: process.env.MAX_CACHE_SIZE ?? '50',
       PAGINATION_LIMIT: process.env.PAGINATION_LIMIT ?? '20',
     },
  },
};
