import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import MedicalRecordAttachments from '../components/MedicalRecordAttachments';
import {
  getMedicalRecords,
  searchMedicalRecords,
  type MedicalRecord,
  type RecordFilters,
} from '../services/medicalRecordService';

// ─── Types ────────────────────────────────────────────────────────────────────

type RecordType = RecordFilters['type'];

/** Extended fields present on Vaccination / Treatment subtypes */
interface ExtendedRecord extends MedicalRecord {
  vaccineName?: string;
  treatmentName?: string;
  medication?: string;
  dosage?: string;
}

const RECORD_TYPES: { label: string; value: RecordType }[] = [
  { label: 'All', value: undefined },
  { label: 'Vaccination', value: 'vaccination' },
  { label: 'Treatment', value: 'treatment' },
  { label: 'Diagnosis', value: 'diagnosis' },
];

interface Props {
  petId: string;
  petName?: string;
  onBack: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const MedicalRecordViewerScreen: React.FC<Props> = ({ petId, petName, onBack }) => {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<RecordType>(undefined);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [detailRecord, setDetailRecord] = useState<MedicalRecord | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const filters: RecordFilters = { type: selectedType };
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      const res = await getMedicalRecords(petId, filters);
      // Map backend fields to UI-friendly verificationStatus
      const mapped = res.data.data.map((r) => ({
        ...r,
        verificationStatus: (r.isBlockchainVerified ? 'verified' : 'unknown') as
          | 'verified'
          | 'unknown'
          | 'pending',
      }));
      setRecords(mapped);
    } catch {
      Alert.alert('Error', 'Failed to load medical records.');
    } finally {
      setLoading(false);
    }
  }, [petId, selectedType, startDate, endDate]);

  useEffect(() => {
    if (!isSearchMode) void loadRecords();
  }, [loadRecords, isSearchMode]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setIsSearchMode(false);
      return;
    }
    setLoading(true);
    setIsSearchMode(true);
    try {
      const results = await searchMedicalRecords(petId, searchQuery);
      setRecords(results);
    } catch {
      Alert.alert('Error', 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setIsSearchMode(false);
  };

  const applyFilters = () => {
    setIsSearchMode(false);
    setFiltersVisible(false);
    void loadRecords();
  };

  const resetFilters = () => {
    setSelectedType(undefined);
    setStartDate('');
    setEndDate('');
  };

  // ─── Render helpers ──────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: MedicalRecord }) => (
      <TouchableOpacity style={styles.card} onPress={() => setDetailRecord(item)}>
        <View style={styles.cardRow}>
          <View style={[styles.typeBadge, typeBadgeColor(item.type)]}>
            <Text style={styles.typeBadgeText}>{item.type}</Text>
          </View>
          <Text style={styles.cardDate}>{new Date(item.date).toLocaleDateString()}</Text>
        </View>
        {item.notes ? (
          <Text style={styles.cardNotes} numberOfLines={2}>
            {item.notes}
          </Text>
        ) : null}
        {item.veterinarian ? <Text style={styles.cardMeta}>Vet: {item.veterinarian}</Text> : null}
        {item.documents?.length ? (
          <Text style={styles.cardMeta}>
            {item.documents.length} attachment{item.documents.length === 1 ? '' : 's'}
          </Text>
        ) : null}
      </TouchableOpacity>
    ),
    [],
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {petName ? `${petName}'s Records` : 'Medical Records'}
        </Text>
        <TouchableOpacity
          onPress={() => setFiltersVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Filters"
        >
          <Text style={styles.filterBtn}>Filter</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search records…"
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => void handleSearch()}
          returnKeyType="search"
          accessibilityLabel="Search medical records"
        />
        {isSearchMode ? (
          <TouchableOpacity style={styles.clearBtn} onPress={clearSearch}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.searchBtn}
            onPress={() => void handleSearch()}
            accessibilityRole="button"
          >
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Active filter chips */}
      {(selectedType || startDate || endDate) && !isSearchMode ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={styles.chipContent}
        >
          {selectedType ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{selectedType}</Text>
            </View>
          ) : null}
          {startDate ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>From: {startDate}</Text>
            </View>
          ) : null}
          {endDate ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>To: {endDate}</Text>
            </View>
          ) : null}
          <TouchableOpacity style={styles.chipClear} onPress={resetFilters}>
            <Text style={styles.chipClearText}>Clear</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : null}

      {/* List */}
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#4CAF50" />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerStyle={records.length === 0 ? styles.emptyContainer : styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {isSearchMode ? `No results for "${searchQuery}".` : 'No records found.'}
            </Text>
          }
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
        />
      )}

      {/* ── Filter Modal ── */}
      <Modal
        visible={filtersVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFiltersVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.filterSheet}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filter Records</Text>
              <TouchableOpacity onPress={() => setFiltersVisible(false)}>
                <Text style={styles.filterClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.filterLabel}>Record Type</Text>
            <View style={styles.typeRow}>
              {RECORD_TYPES.map(({ label, value }) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.typeChip, selectedType === value && styles.typeChipActive]}
                  onPress={() => setSelectedType(value)}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      selectedType === value && styles.typeChipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>Date Range</Text>
            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={styles.dateFieldLabel}>From</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                  value={startDate}
                  onChangeText={setStartDate}
                  accessibilityLabel="Start date"
                />
              </View>
              <View style={styles.dateField}>
                <Text style={styles.dateFieldLabel}>To</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                  value={endDate}
                  onChangeText={setEndDate}
                  accessibilityLabel="End date"
                />
              </View>
            </View>

            <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resetBtn} onPress={resetFilters}>
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Detail Modal ── */}
      {detailRecord && (
        <Modal visible animationType="slide" onRequestClose={() => setDetailRecord(null)}>
          <View style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setDetailRecord(null)}>
                <Text style={styles.backText}>‹ Back</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Record Details</Text>
              <View style={{ width: 50 }} />
            </View>
            <ScrollView contentContainerStyle={styles.detailBody}>
              {(() => {
                const record = detailRecord as ExtendedRecord;

                return (
                  <>
                    <DetailRow label="Type" value={detailRecord.type} />
                    <DetailRow
                      label="Date"
                      value={new Date(detailRecord.date).toLocaleDateString()}
                    />
                    {detailRecord.veterinarian ? (
                      <DetailRow label="Vet" value={detailRecord.veterinarian} />
                    ) : null}
                    {detailRecord.notes ? (
                      <DetailRow label="Notes" value={detailRecord.notes} />
                    ) : null}
                    {detailRecord.nextVisitDate ? (
                      <DetailRow
                        label="Next Due"
                        value={new Date(detailRecord.nextVisitDate).toLocaleDateString()}
                      />
                    ) : null}
                    {record.vaccineName ? (
                      <DetailRow label="Vaccine" value={record.vaccineName} />
                    ) : null}
                    {record.treatmentName ? (
                      <DetailRow label="Treatment" value={record.treatmentName} />
                    ) : null}
                    {record.medication ? (
                      <DetailRow label="Medication" value={record.medication} />
                    ) : null}
                    {record.dosage ? <DetailRow label="Dosage" value={record.dosage} /> : null}
                    <MedicalRecordAttachments documents={detailRecord.documents} />
                    <DetailRow
                      label="Created"
                      value={new Date(detailRecord.createdAt).toLocaleDateString()}
                    />
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  vaccination: { bg: '#E8F5E9', text: '#2E7D32' },
  treatment: { bg: '#E3F2FD', text: '#1565C0' },
  diagnosis: { bg: '#FFF3E0', text: '#E65100' },
  other: { bg: '#F3E5F5', text: '#6A1B9A' },
};

const typeBadgeColor = (type: string) => {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.other;
  return { backgroundColor: c.bg };
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backText: { color: '#10B981', fontSize: 16, fontWeight: '600', minWidth: 50 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  filterBtn: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'right',
  },
  searchRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  searchBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  clearBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  clearBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  chipRow: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  chipContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  chip: {
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontSize: 12, color: '#065F46', fontWeight: '600' },
  chipClear: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipClearText: { fontSize: 12, color: '#991B1B', fontWeight: '600' },
  loader: { marginTop: 40 },
  list: { padding: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#9CA3AF', fontSize: 15, textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize', color: '#374151' },
  cardDate: { fontSize: 12, color: '#6B7280' },
  cardNotes: { fontSize: 14, color: '#374151', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#9CA3AF' },
  // Filter sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  filterSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  filterTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  filterClose: { fontSize: 20, color: '#6B7280' },
  filterLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 10 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeChip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  typeChipActive: { borderColor: '#10B981', backgroundColor: '#D1FAE5' },
  typeChipText: { fontSize: 13, color: '#6B7280' },
  typeChipTextActive: { color: '#065F46', fontWeight: '600' },
  dateRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  dateField: { flex: 1 },
  dateFieldLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  dateInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
  },
  applyBtn: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  resetBtn: { paddingVertical: 10, alignItems: 'center' },
  resetBtnText: { color: '#6B7280', fontSize: 14 },
  // Detail
  detailBody: { padding: 20 },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: { width: 90, fontSize: 13, color: '#6B7280', fontWeight: '600' },
  detailValue: { flex: 1, fontSize: 14, color: '#111827' },

  // Verification
  verificationSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B0E0FE',
  },
  verificationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0369A1',
    marginBottom: 10,
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  verificationText: {
    flex: 1,
    fontSize: 13,
    color: '#0C4A6E',
    lineHeight: 18,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },
  verifyButton: {
    backgroundColor: '#4A90A4',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  verifyButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});

export default MedicalRecordViewerScreen;
