import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

declare const __DEV__: boolean;

export type UpdateStatus =
  | { type: 'up-to-date' }
  | { type: 'ota-available'; manifest: unknown }
  | { type: 'force-update'; storeUrl: string }
  | { type: 'error'; message: string };

const extra = Constants.expoConfig?.extra ?? {};
const APP_ENV: string = extra.APP_ENV ?? 'development';

// Minimum supported native build version per platform.
// Bump these when a native-only change requires a store update.
const MIN_NATIVE_VERSION = {
  ios: extra.MIN_NATIVE_VERSION_IOS ?? '1.0.0',
  android: extra.MIN_NATIVE_VERSION_ANDROID ?? '1.0.0',
};

const STORE_URLS = {
  ios: extra.IOS_STORE_URL ?? 'https://apps.apple.com/app/petchain/id000000000',
  android:
    extra.ANDROID_STORE_URL ?? 'https://play.google.com/store/apps/details?id=app.petchain.mobile',
};

function isVersionLessThan(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na < nb) return true;
    if (na > nb) return false;
  }
  return false;
}

/**
 * Check for available updates.
 *
 * 1. If the current native build is below the minimum required version → force update.
 * 2. If an OTA update is available via expo-updates → prompt to reload.
 * 3. Otherwise → up to date.
 */
export async function checkForUpdate(): Promise<UpdateStatus> {
  // Skip in dev — expo-updates is not active in development builds
  if (__DEV__ || APP_ENV === 'development') {
    return { type: 'up-to-date' };
  }

  try {
    const { Platform } = await import('react-native');
    const platform = Platform.OS as 'ios' | 'android';
    const currentVersion = Constants.expoConfig?.version ?? '1.0.0';
    const minVersion = MIN_NATIVE_VERSION[platform] ?? '1.0.0';

    // Force update: native build is too old
    if (isVersionLessThan(currentVersion, minVersion)) {
      return { type: 'force-update', storeUrl: STORE_URLS[platform] };
    }

    // OTA check via expo-updates
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) {
      await Updates.fetchUpdateAsync();
      return { type: 'ota-available', manifest: result.manifest };
    }

    return { type: 'up-to-date' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { type: 'error', message };
  }
}

/** Apply a downloaded OTA update by reloading the app. */
export async function applyOtaUpdate(): Promise<void> {
  await Updates.reloadAsync();
}

export default { checkForUpdate, applyOtaUpdate };
