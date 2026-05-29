import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import MetricBarChart, { type ChartPoint } from '../components/MetricBarChart';
import type { ActivityLevel, HealthMetricEntry } from '../models/HealthMetric';
import {
  activityLevelToScore,
  deleteHealthMetric,
  getHealthMetrics,
  saveHealthMetric,
} from '../services/healthMetricService';
import { useSecureScreen } from '../utils/secureScreen';

type ChartTab = 'weight' | 'temperature' | 'activity';

interface Props {
  petId: string;
  petName: string;
  onBack: () => void;
}

function shortDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '?';
  return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

function parseOptionalFloat(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

const PetHealthMetricsScreen: React.FC<Props> = ({ petId, petName, onBack }) => {
  useSecureScreen();

  const [entries, setEntries] = useState<HealthMetricEntry[]>([]);
  const [chartTab, setChartTab] = useState<ChartTab>('weight');
  const [modalVisible, setModalVisible] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [tempInput, setTempInput] = useState('');
  const [activity, setActivity] = useState<ActivityLevel | undefined>(undefined);
  const [notesInput, setNotesInput] = useState('');

  const load = useCallback(async () => {
    const data = await getHealthMetrics(petId);
    setEntries(data);
  }, [petId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setWeightInput('');
    setTempInput('');
    setActivity(undefined);
    setNotesInput('');
    setModalVisible(true);
  };

  const handleSave = async () => {
    const weightKg = parseOptionalFloat(weightInput);
    const temperatureC = parseOptionalFloat(tempInput);
    if (weightKg === undefined && temperatureC === undefined && activity === undefined) {
      Alert.alert('Validation', 'Enter at least weight, temperature, or activity level.');
      return;
    }
    const entry: HealthMetricEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      petId,
      recordedAt: new Date().toISOString(),
      weightKg,
      temperatureC,
      activityLevel: activity,
      notes: notesInput.trim() || undefined,
    };
    await saveHealthMetric(entry);
    setModalVisible(false);
    void load();
  };

  const confirmDelete = useCallback(
    (id: string) => {
      Alert.alert('Delete entry', 'Remove this health log?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteHealthMetric(id);
            void load();
          },
        },
      ]);
    },
    [load],
  );

  const weightPoints: ChartPoint[] = entries
    .filter((e) => e.weightKg !== undefined && e.weightKg !== null)
    .map((e) => ({ label: shortDateLabel(e.recordedAt), value: e.weightKg as number }));

  const tempPoints: ChartPoint[] = entries
    .filter((e) => e.temperatureC !== undefined && e.temperatureC !== null)
    .map((e) => ({ label: shortDateLabel(e.recordedAt), value: e.temperatureC as number }));

  const activityPoints: ChartPoint[] = entries
    .filter((e) => e.activityLevel)
    .map((e) => ({
      label: shortDateLabel(e.recordedAt),
      value: activityLevelToScore(e.activityLevel) as number,
    }));

  const sortedDesc = [...entries].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );

  const renderChart = (): React.ReactElement => {
    if (chartTab === 'weight') {
      return <MetricBarChart points={weightPoints} color="#4CAF50" unit="kg" />;
    }
    if (chartTab === 'temperature') {
      return <MetricBarChart points={tempPoints} color="#2196F3" unit="°C" />;
    }
    return (
      <MetricBarChart
        points={activityPoints}
        color="#FF9800"
        unit="1 = low, 2 = moderate, 3 = high"
      />
    );
  };

  const listHeader = (
    <View style={styles.headerBlock}>
      <Text style={styles.sectionTitle}>Trends</Text>
      <View style={styles.tabRow}>
        {(['weight', 'temperature', 'activity'] as ChartTab[]).map((tab, idx) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, idx === 2 && styles.tabLast, chartTab === tab && styles.tabActive]}
            onPress={() => setChartTab(tab)}
            accessibilityRole="button"
            accessibilityState={{ selected: chartTab === tab }}
          >
            <Text style={[styles.tabText, chartTab === tab && styles.tabTextActive]}>
              {tab === 'weight' ? 'Weight' : tab === 'temperature' ? 'Temp' : 'Activity'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.chartCard}>{renderChart()}</View>
      <Text style={styles.sectionTitle}>History</Text>
    </View>
  );

  const activityChip = (level: ActivityLevel, label: string) => {
    const on = activity === level;
    return (
      <TouchableOpacity
        key={level}
        style={[styles.chip, on && styles.chipOn]}
        onPress={() => setActivity(on ? undefined : level)}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={label}
      >
        <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const renderMetricItem = useCallback(
    ({ item }: { item: HealthMetricEntry }) => (
      <View style={styles.rowCard}>
        <View style={styles.rowMain}>
          <Text style={styles.rowDate}>{new Date(item.recordedAt).toLocaleString()}</Text>
          <Text style={styles.rowValues}>
            {item.weightKg !== undefined ? `${item.weightKg} kg` : ''}
            {item.weightKg !== undefined && (item.temperatureC !== undefined || item.activityLevel)
              ? ' · '
              : ''}
            {item.temperatureC !== undefined ? `${item.temperatureC} °C` : ''}
            {item.temperatureC !== undefined && item.activityLevel ? ' · ' : ''}
            {item.activityLevel ? `Activity: ${item.activityLevel}` : ''}
          </Text>
          {item.notes ? <Text style={styles.rowNotes}>{item.notes}</Text> : null}
        </View>
        <TouchableOpacity
          onPress={() => confirmDelete(item.id)}
          style={styles.delTouch}
          accessibilityRole="button"
          accessibilityLabel="Delete entry"
        >
          <Text style={styles.delText}>✕</Text>
        </TouchableOpacity>
      </View>
    ),
    [confirmDelete],
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
        <Text style={styles.headerTitle} numberOfLines={1}>
          Health · {petName}
        </Text>
        <TouchableOpacity
          onPress={openAdd}
          style={styles.addBtn}
          accessibilityRole="button"
          accessibilityLabel="Add health entry"
        >
          <Text style={styles.addBtnText}>+ Log</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sortedDesc}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        extraData={chartTab}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <Text style={styles.emptyList}>
            No entries yet. Tap + Log to add weight, temperature, or activity.
          </Text>
        }
        renderItem={renderMetricItem}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Log health metrics</Text>
            <Text style={styles.modalHint}>At least one field is required.</Text>
            <Text style={styles.inputLabel}>Weight (kg)</Text>
            <TextInput
              style={styles.input}
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              placeholder="e.g. 12.5"
              placeholderTextColor="#aaa"
            />
            <Text style={styles.inputLabel}>Temperature (°C)</Text>
            <TextInput
              style={styles.input}
              value={tempInput}
              onChangeText={setTempInput}
              keyboardType="decimal-pad"
              placeholder="e.g. 38.5"
              placeholderTextColor="#aaa"
            />
            <Text style={styles.inputLabel}>Activity (optional)</Text>
            <View style={styles.chipRow}>
              {activityChip('low', 'Low')}
              {activityChip('moderate', 'Moderate')}
              {activityChip('high', 'High')}
            </View>
            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notesInput}
              onChangeText={setNotesInput}
              placeholder="Optional"
              placeholderTextColor="#aaa"
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={() => void handleSave()}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 17, color: '#4CAF50' },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  addBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  headerBlock: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 10 },
  tabRow: { flexDirection: 'row', marginBottom: 12 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#e8e8e8',
    alignItems: 'center',
    marginRight: 8,
  },
  tabLast: { marginRight: 0 },
  tabActive: { backgroundColor: '#e8f5e9' },
  tabText: { fontSize: 13, color: '#666', fontWeight: '600' },
  tabTextActive: { color: '#2e7d32' },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyList: { textAlign: 'center', color: '#999', marginTop: 16, fontSize: 14 },
  rowCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  rowMain: { flex: 1 },
  rowDate: { fontSize: 12, color: '#888', marginBottom: 4 },
  rowValues: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  rowNotes: { fontSize: 13, color: '#666', marginTop: 6 },
  delTouch: { padding: 8 },
  delText: { fontSize: 16, color: '#e53935' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  modalHint: { fontSize: 13, color: '#888', marginTop: 4, marginBottom: 12 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#444', marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1a1a1a',
  },
  notesInput: { minHeight: 72, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
    marginBottom: 8,
  },
  chipOn: { backgroundColor: '#e8f5e9', borderColor: '#4CAF50' },
  chipText: { fontSize: 14, color: '#555' },
  chipTextOn: { color: '#2e7d32', fontWeight: '700' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  cancelBtnText: { color: '#666', fontSize: 16 },
  saveBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 8,
    marginLeft: 12,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

export default PetHealthMetricsScreen;
