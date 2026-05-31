import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Image,
  AccessibilityInfo,
} from 'react-native';

import apiClient from '../../backend/services/apiClient';

type Step = 'idle' | 'setup' | 'confirm' | 'done';

interface SetupData {
  qrCode: string;
  secret: string;
}

export default function TwoFactorSetupScreen() {
  const [step, setStep] = useState<Step>('idle');
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [token, setToken] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState('');

  const announce = (msg: string) => AccessibilityInfo.announceForAccessibility(msg);

  const handleSetup = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/auth/2fa/setup', {});
      setSetupData(res.data.data);
      setStep('setup');
      announce('QR code ready. Scan it with your authenticator app.');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Setup failed. Please try again.';
      setError(msg);
      announce(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleVerifySetup = useCallback(async () => {
    if (token.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/auth/2fa/verify-setup', { token });
      setBackupCodes(res.data.data.backupCodes);
      setStep('done');
      announce('Two-factor authentication enabled. Save your backup codes.');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Verification failed. Check your code and try again.';
      setError(msg);
      announce(msg);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleCopyBackupCodes = () => {
    Alert.alert(
      'Backup Codes',
      backupCodes.join('\n'),
      [{ text: 'OK' }],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title} accessibilityRole="header">
        Two-Factor Authentication
      </Text>

      {step === 'idle' && (
        <View>
          <Text style={styles.body}>
            Add an extra layer of security to your account. You'll need an authenticator app such as
            Google Authenticator or Authy.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={handleSetup}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Enable two-factor authentication"
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Enable 2FA</Text>}
          </TouchableOpacity>
        </View>
      )}

      {step === 'setup' && setupData && (
        <View>
          <Text style={styles.body}>
            Scan this QR code with your authenticator app, then enter the 6-digit code below.
          </Text>
          <Image
            source={{ uri: setupData.qrCode }}
            style={styles.qr}
            accessibilityLabel="QR code for two-factor authentication setup"
          />
          <Text style={styles.secretLabel}>
            Can't scan? Enter this key manually:
          </Text>
          <Text style={styles.secret} selectable accessibilityLabel={`Manual entry key: ${setupData.secret}`}>
            {setupData.secret}
          </Text>
          <TextInput
            style={styles.input}
            value={token}
            onChangeText={(t) => { setToken(t.replace(/\D/g, '').slice(0, 6)); setError(''); }}
            placeholder="6-digit code"
            keyboardType="number-pad"
            maxLength={6}
            accessibilityLabel="Enter the 6-digit code from your authenticator app"
            autoFocus
          />
          {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
          <TouchableOpacity
            style={[styles.button, token.length !== 6 && styles.buttonDisabled]}
            onPress={handleVerifySetup}
            disabled={loading || token.length !== 6}
            accessibilityRole="button"
            accessibilityLabel="Confirm two-factor authentication setup"
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirm</Text>}
          </TouchableOpacity>
        </View>
      )}

      {step === 'done' && (
        <View>
          <Text style={styles.success} accessibilityLiveRegion="assertive">
            ✓ Two-factor authentication is now enabled.
          </Text>
          <Text style={styles.body}>
            Save these backup codes in a secure place. Each code can only be used once. If you lose
            access to your authenticator app, use a backup code to sign in.
          </Text>
          <View style={styles.codesContainer} accessibilityLabel="Backup codes">
            {backupCodes.map((code) => (
              <Text key={code} style={styles.code} selectable>
                {code}
              </Text>
            ))}
          </View>
          <TouchableOpacity
            style={styles.buttonSecondary}
            onPress={handleCopyBackupCodes}
            accessibilityRole="button"
            accessibilityLabel="View all backup codes"
          >
            <Text style={styles.buttonSecondaryText}>View Backup Codes</Text>
          </TouchableOpacity>
        </View>
      )}

      {step !== 'done' && error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>
      ) : null}

      <View style={styles.recoveryNote}>
        <Text style={styles.recoveryText}>
          Lost access? Use account recovery via your verified email address.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16, color: '#1a1a1a' },
  body: { fontSize: 15, color: '#444', marginBottom: 20, lineHeight: 22 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { backgroundColor: '#93c5fd' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  buttonSecondary: { borderWidth: 1, borderColor: '#2563eb', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  buttonSecondaryText: { color: '#2563eb', fontWeight: '600', fontSize: 15 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 14, fontSize: 20, letterSpacing: 8, textAlign: 'center', marginBottom: 12 },
  qr: { width: 200, height: 200, alignSelf: 'center', marginBottom: 16 },
  secretLabel: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  secret: { fontFamily: 'monospace', fontSize: 13, color: '#374151', backgroundColor: '#f3f4f6', padding: 10, borderRadius: 6, marginBottom: 16 },
  error: { color: '#dc2626', fontSize: 14, marginBottom: 8 },
  success: { color: '#16a34a', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  codesContainer: { backgroundColor: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 16 },
  code: { fontFamily: 'monospace', fontSize: 15, color: '#111827', paddingVertical: 4 },
  recoveryNote: { marginTop: 32, padding: 12, backgroundColor: '#fef9c3', borderRadius: 8 },
  recoveryText: { fontSize: 13, color: '#713f12' },
});
