import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import emergencyService, { type VetClinic } from '../services/emergencyService';

interface Props {
  onBack?: () => void;
}

const NearbyVetScreen: React.FC<Props> = ({ onBack }) => {
  const [clinics, setClinics] = useState<VetClinic[]>([]);
  const [loading, setLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const fetchClinics = useCallback(async () => {
    setLoading(true);
    setLocationError(null);
    try {
      const location = await emergencyService.getCurrentLocation();
      const results = await emergencyService.getNearbyVetClinics(
        location.latitude,
        location.longitude,
      );
      setClinics(results);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to find nearby clinics.';
      setLocationError(msg);
      Alert.alert('Location Error', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchClinics();
  }, [fetchClinics]);

  const renderClinic = useCallback(
    ({ item }: { item: VetClinic }) => (
      <View style={styles.card}>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.sub}>
            {item.distance !== undefined ? `${item.distance.toFixed(1)} km` : ''}
            {item.available24h ? ' · 24h' : ''}
            {item.rating ? ` · ⭐ ${item.rating}` : ''}
          </Text>
          <Text style={styles.sub}>{item.address}</Text>
        </View>
        <View style={styles.actions}>
          {item.phoneNumber ? (
            <TouchableOpacity
              style={[styles.btn, styles.callBtn]}
              onPress={() => emergencyService.callContact(item.phoneNumber)}
              accessibilityLabel={`Call ${item.name}`}
            >
              <Text style={styles.btnText}>📞</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.btn, styles.navBtn]}
            onPress={() => emergencyService.navigateToClinic(item.address)}
            accessibilityLabel={`Navigate to ${item.name}`}
          >
            <Text style={styles.btnText}>🗺️</Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} accessibilityLabel="Go back" style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.title}>Nearby Vet Clinics</Text>
        <TouchableOpacity
          onPress={() => void fetchClinics()}
          disabled={loading}
          accessibilityLabel="Refresh clinics"
          style={styles.refreshBtn}
        >
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#e53e3e" />
      ) : locationError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{locationError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void fetchClinics()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={clinics}
          keyExtractor={(item) => item.id}
          renderItem={renderClinic}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No vet clinics found nearby.</Text>}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: { marginRight: 8 },
  backText: { fontSize: 18, color: '#e53e3e' },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1a202c' },
  refreshBtn: { padding: 4 },
  refreshText: { fontSize: 22, color: '#e53e3e' },
  loader: { marginTop: 40 },
  list: { padding: 12 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#f7fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#1a202c', marginBottom: 2 },
  sub: { fontSize: 13, color: '#718096' },
  actions: { flexDirection: 'row', gap: 8 },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callBtn: { backgroundColor: '#48bb78' },
  navBtn: { backgroundColor: '#4299e1' },
  btnText: { fontSize: 18 },
  empty: { textAlign: 'center', color: '#718096', marginTop: 40 },
  errorContainer: { alignItems: 'center', marginTop: 40, paddingHorizontal: 24 },
  errorText: { color: '#e53e3e', textAlign: 'center', marginBottom: 16 },
  retryBtn: {
    backgroundColor: '#e53e3e',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '600' },
});

export default NearbyVetScreen;
