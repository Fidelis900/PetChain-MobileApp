import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { HeaderOfflineStatus, useOfflineStatus } from '../components/OfflineIndicator';
import { searchMedicalRecords, type MedicalRecord } from '../services/medicalRecordService';

interface Props {
  petId: string;
  onBack: () => void;
}

const MedicalRecordSearchScreen: React.FC<Props> = ({ petId, onBack }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const offlineStatus = useOfflineStatus();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await searchMedicalRecords(petId, query);
      setResults(data);
    } catch {
      Alert.alert('Error', 'Failed to search medical records.');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: MedicalRecord }) => (
      <View style={styles.card} accessibilityRole="text">
        <View style={styles.cardRow}>
          <Text style={styles.badge}>{item.type}</Text>
          <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}</Text>
        </View>
        {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
        {item.veterinarian ? <Text style={styles.meta}>Vet: {item.veterinarian}</Text> : null}
        {item.documents?.length ? (
          <Text style={styles.meta}>
            {item.documents.length} attachment{item.documents.length === 1 ? '' : 's'}
          </Text>
        ) : null}
        {!offlineStatus?.isOnline ? <Text style={styles.cachedChip}>Cached</Text> : null}
      </View>
    ),
    [offlineStatus?.isOnline],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Search Records</Text>
          <HeaderOfflineStatus />
        </View>
      </View>
      {!offlineStatus?.isOnline ? (
        <View style={styles.cachedBanner}>
          <Text style={styles.cachedBannerText}>Showing cached records while offline.</Text>
        </View>
      ) : null}

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search by diagnosis, notes, vet…"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          accessibilityLabel="Search medical records"
        />
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={handleSearch}
          accessibilityRole="button"
          accessibilityLabel="Search"
        >
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#4CAF50" />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            searched ? (
              <Text style={styles.empty} accessibilityLiveRegion="polite">
                No records found for "{query}".
              </Text>
            ) : null
          }
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
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 12,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 17, color: '#4CAF50' },
  title: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cachedBanner: {
    backgroundColor: '#fff3e0',
    borderBottomWidth: 1,
    borderBottomColor: '#ffe0b2',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cachedBannerText: { color: '#a54900', fontSize: 12, fontWeight: '600' },
  searchRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#fafafa',
  },
  searchBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '600' },
  loader: { marginTop: 40 },
  list: { padding: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4CAF50',
    textTransform: 'capitalize',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  date: { fontSize: 12, color: '#999' },
  notes: { fontSize: 14, color: '#333', marginBottom: 4 },
  meta: { fontSize: 12, color: '#888' },
  cachedChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    fontSize: 11,
    fontWeight: '700',
    color: '#a54900',
    backgroundColor: '#fff3e0',
    borderColor: '#ed6c02',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  empty: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 15 },
});

export default MedicalRecordSearchScreen;
