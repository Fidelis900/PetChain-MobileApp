import { Linking, PermissionsAndroid, Platform } from 'react-native';

export interface AndroidPermissionRationale {
  title: string;
  message: string;
  buttonPositive?: string;
  buttonNegative?: string;
  buttonNeutral?: string;
}

export async function openSettingsSafely(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Best effort only.
  }
}

export async function requestAndroidPermission(
  permission: string,
  rationale: AndroidPermissionRationale,
): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const status = await PermissionsAndroid.request(
    permission as Parameters<typeof PermissionsAndroid.request>[0],
    {
      title: rationale.title,
      message: rationale.message,
      buttonPositive: rationale.buttonPositive ?? 'OK',
      buttonNegative: rationale.buttonNegative,
      buttonNeutral: rationale.buttonNeutral,
    },
  );
  if (status === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    await openSettingsSafely();
    return false;
  }

  return status === PermissionsAndroid.RESULTS.GRANTED;
}
