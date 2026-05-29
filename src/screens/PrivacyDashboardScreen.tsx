import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { resilientRequest } from '../services/apiClient';

interface ConsentState {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

const CATEGORIES: { key: keyof ConsentState; label: string; description: string }[] = [
  { key: 'necessary', label: 'Necessary', description: 'Required for the app to function.' },
  { key: 'functional', label: 'Functional', description: 'Remembers your preferences.' },
  { key: 'analytics', label: 'Analytics', description: 'Helps us improve the app.' },
  { key: 'marketing', label: 'Marketing', description: 'Personalised offers and updates.' },
];

const PrivacyDashboardScreen: React.FC = () => {
  const [consents, setConsents] = useState<ConsentState>({
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConsents = useCallback(async () => {
    try {
      const res = await resilientRequest<{ data: { consents: ConsentState } }>({
        method: 'GET',
        url: '/privacy/consent',
      });
      setConsents((prev) => ({ ...prev, ...res.data.data.consents }));
    } catch {
      // Use defaults on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConsents();
  }, [loadConsents]);

  const saveConsents = useCallback(async () => {
    setSaving(true);
    try {
      await resilientRequest({ method: 'POST', url: '/privacy/consent', data: { consents } });
      Alert.alert('Saved', 'Your privacy preferences have been updated.');
    } catch {
      Alert.alert('Error', 'Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  }, [consents]);

  const handleExport = useCallback(async () => {
    try {
      const res = await resilientRequest<object>({ method: 'GET', url: '/privacy/export' });
      Alert.alert('Export Ready', 'Your data export has been prepared.\n\n' + JSON.stringify(res.data).slice(0, 200) + '…');
    } catch {
      Alert.alert('Error', 'Failed to export data.');
    }
  }, []);

  const handleErase = useCallback(() => {
    Alert.alert(
      'Delete All Data',
      'This will permanently delete your account and all associated data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await resilientRequest({ method: 'DELETE', url: '/privacy/erase' });
              Alert.alert('Done', 'Your data has been erased.');
            } catch {
              Alert.alert('Error', 'Failed to erase data.');
            }
          },
        },
      ],
    );
  }, []);

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" color="#4299e1" />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Privacy Dashboard</Text>
      <Text style={styles.subtitle}>
        Manage how PetChain uses your data. Changes are logged for compliance.
      </Text>

      <Text style={styles.sectionTitle}>Data Processing Consents</Text>
      {CATEGORIES.map(({ key, label, description }) => (
        <View key={key} style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowDesc}>{description}</Text>
          </View>
          <Switch
            value={consents[key]}
            onValueChange={(v) =>
              key !== 'necessary' && setConsents((prev) => ({ ...prev, [key]: v }))
            }
            disabled={key === 'necessary'}
            trackColor={{ true: '#4299e1', false: '#e2e8f0' }}
            accessibilityLabel={`Toggle ${label} consent`}
          />
        </View>
      ))}

      <TouchableOpacity
        style={[styles.btn, styles.btnPrimary]}
        onPress={() => void saveConsents()}
        disabled={saving}
        accessibilityLabel="Save privacy preferences"
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Save Preferences</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Your Data Rights</Text>

      <TouchableOpacity
        style={[styles.btn, styles.btnSecondary]}
        onPress={() => void handleExport()}
        accessibilityLabel="Export my data"
      >
        <Text style={styles.btnTextSecondary}>📥 Export My Data (JSON)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.btnDanger]}
        onPress={handleErase}
        accessibilityLabel="Delete all my data"
      >
        <Text style={styles.btnText}>🗑 Delete All My Data</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  loader: { flex: 1, marginTop: 40 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a202c', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#718096', marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#2d3748', marginTop: 24, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7',
  },
  rowInfo: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#1a202c' },
  rowDesc: { fontSize: 13, color: '#718096', marginTop: 2 },
  btn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  btnPrimary: { backgroundColor: '#4299e1' },
  btnSecondary: { backgroundColor: '#edf2f7' },
  btnDanger: { backgroundColor: '#e53e3e' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnTextSecondary: { color: '#2d3748', fontWeight: '600', fontSize: 15 },
});

export default PrivacyDashboardScreen;
