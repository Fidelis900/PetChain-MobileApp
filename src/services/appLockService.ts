import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  preventScreenCaptureAsync,
  allowScreenCaptureAsync,
  enableAppSwitcherProtectionAsync,
  disableAppSwitcherProtectionAsync,
} from 'expo-screen-capture';

const CAPTURE_KEY = 'appLock';
const TIMEOUT_STORAGE_KEY = '@appLock_timeout';

/** Lock timeout options in milliseconds. 0 = never auto-lock. */
export const LOCK_TIMEOUTS = {
  '1min': 60_000,
  '5min': 300_000,
  '15min': 900_000,
  never: 0,
} as const;

export type LockTimeout = keyof typeof LOCK_TIMEOUTS;

/** Screens that are whitelisted for screenshots (non-sensitive). */
const WHITELISTED_SCREENS = new Set<string>(['OnboardingScreen', 'CommunityScreen']);

let _screenshotPrevented = false;

/** Enable screen capture prevention globally. */
export async function enableScreenCapturePrevention(): Promise<void> {
  if (_screenshotPrevented) return;
  await preventScreenCaptureAsync(CAPTURE_KEY);
  await enableAppSwitcherProtectionAsync(0.8);
  _screenshotPrevented = true;
}

/** Disable screen capture prevention globally. */
export async function disableScreenCapturePrevention(): Promise<void> {
  if (!_screenshotPrevented) return;
  await allowScreenCaptureAsync(CAPTURE_KEY);
  await disableAppSwitcherProtectionAsync();
  _screenshotPrevented = false;
}

/** Allow screenshots for a specific whitelisted screen. */
export async function allowScreenForRoute(routeName: string): Promise<void> {
  if (WHITELISTED_SCREENS.has(routeName)) {
    await allowScreenCaptureAsync(CAPTURE_KEY);
  } else {
    await preventScreenCaptureAsync(CAPTURE_KEY);
  }
}

/** Persist the user's chosen lock timeout. */
export async function saveLockTimeout(timeout: LockTimeout): Promise<void> {
  await AsyncStorage.setItem(TIMEOUT_STORAGE_KEY, timeout);
}

/** Load the user's chosen lock timeout (defaults to '5min'). */
export async function loadLockTimeout(): Promise<LockTimeout> {
  const stored = await AsyncStorage.getItem(TIMEOUT_STORAGE_KEY);
  if (stored && stored in LOCK_TIMEOUTS) return stored as LockTimeout;
  return '5min';
}

/** Returns the timeout duration in ms for the given key. */
export function getLockTimeoutMs(timeout: LockTimeout): number {
  return LOCK_TIMEOUTS[timeout];
}
