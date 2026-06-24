import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

import keyBackupService from '../services/keyBackupService';

export default function KeyBackupScreen() {
  const [mnemonic, setMnemonic] = React.useState<string | null>(null);
  const [shares, setShares] = React.useState<string[] | null>(null);
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);
  const nav = useNavigation();

  React.useEffect(() => {
    void (async () => {
      const m = await keyBackupService.generateMnemonic();
      setMnemonic(m);
      const parts = keyBackupService.createSocialShares(m, 5, 3);
      setShares(parts);
    })();
  }, []);

  const handleContinue = () => {
    // For onboarding flow, navigate to next step
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (nav as any).navigate?.('Auth');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Secure Key Backup</Text>
      <Text style={styles.message}>
        This mnemonic allows you to recover your account. Write it down and keep it safe.
      </Text>

      {mnemonic ? (
        <View style={styles.box}>
          <Text selectable style={styles.mnemonicText}>
            {mnemonic}
          </Text>
        </View>
      ) : (
        <Text>Generating...</Text>
      )}

      <Text style={[styles.message, { marginTop: 16 }]}>
        Social recovery shares (give to trusted contacts)
      </Text>
      {shares?.map((s, i) => (
        <View key={i} style={styles.shareRow}>
          <Text selectable style={styles.shareText}>
            {s}
          </Text>
        </View>
      ))}

      <TouchableOpacity style={styles.btn} onPress={handleContinue} accessibilityRole="button">
        <Text style={styles.btnText}>Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: '#fff', minHeight: '100%' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  message: { fontSize: 14, color: '#444' },
  box: { marginTop: 12, padding: 16, borderRadius: 8, backgroundColor: '#f5f5f5' },
  mnemonicText: { fontSize: 16, color: '#111' },
  shareRow: { marginTop: 8, padding: 12, backgroundColor: '#fafafa', borderRadius: 6 },
  shareText: { fontSize: 12, color: '#222' },
  btn: {
    marginTop: 24,
    backgroundColor: '#1976D2',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '600' },
});
