import React, { useCallback, useEffect, useState } from 'react';
import {
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

import {
  type DoseLog,
  type Medication,
  deleteMedication,
  getDaySchedule,
  getDoseLogs,
  getMedications,
  logDose,
  saveMedication,
  scheduleRefillReminder,
} from '../services/medicationService';
import { scheduleMedicationReminder } from '../services/notificationService';
import { formatLocalDate, formatLocalTime } from '../utils/dateLocale';
import { useSecureScreen } from '../utils/secureScreen';

type Tab = 'list' | 'daily' | 'weekly';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EMPTY_FORM: Omit<Medication, 'id'> = {
  petId: '',
  name: '',
  dosage: '',
  frequency: 8,
  startDate: new Date().toISOString(),
  endDate: '',
  refillDate: '',
  instructions: '',
  prescriberInfo: { name: '', contact: '', clinic: '' },
  pharmacyInfo: { name: '', phone: '', address: '' },
  totalPills: undefined,
  remainingPills: undefined,
  notes: '',
};

function todayDates(): Date[] {
  return [new Date()];
}
function weekDates(): Date[] {
  const today = new Date();
  const day = today.getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - day + i);
    return d;
  });
}

const MedicationScreen: React.FC = () => {
  useSecureScreen();

  const [tab, setTab] = useState<Tab>('list');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [form, setForm] = useState<Omit<Medication, 'id'>>(EMPTY_FORM);

  const loadData = useCallback(async () => {
    const [meds, logs] = await Promise.all([getMedications(), getDoseLogs()]);
    setMedications(meds);
    setDoseLogs(logs);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openAdd = () => {
    setEditingMed(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };
  const openEdit = useCallback((med: Medication) => {
    setEditingMed(med);
    setForm({ ...med });
    setModalVisible(true);
  }, []);
  const closeModal = () => setModalVisible(false);

  const handleSave = async () => {
    if (!form.petId.trim() || !form.name.trim() || !form.dosage.trim()) {
      Alert.alert('Validation', 'Pet ID, name, and dosage are required.');
      return;
    }
    const med: Medication = {
      ...form,
      id: editingMed?.id ?? Date.now().toString(),
      frequency: Number(form.frequency) || 8,
      totalPills: form.totalPills ? Number(form.totalPills) : undefined,
      remainingPills: form.remainingPills ? Number(form.remainingPills) : undefined,
    };
    await saveMedication(med);
    await scheduleRefillReminder(med);
    await scheduleMedicationReminder(med);
    closeModal();
    void loadData();
  };

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert('Delete', 'Remove this medication?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteMedication(id);
            void loadData();
          },
        },
      ]);
    },
    [loadData],
  );

  const handleLogDose = useCallback(
    async (medicationId: string, skipped = false) => {
      const log: DoseLog = {
        id: Date.now().toString(),
        medicationId,
        takenAt: new Date().toISOString(),
        skipped,
      };
      await logDose(log);
      const med = medications.find((m) => m.id === medicationId);
      if (med?.remainingPills !== undefined && !skipped) {
        await saveMedication({
          ...med,
          remainingPills: Math.max(0, med.remainingPills - 1),
        });
      }
      void loadData();
    },
    [medications, loadData],
  );

  const isDoseTaken = (medicationId: string, scheduledTime: Date): boolean => {
    const windowMs = 30 * 60 * 1000;
    return doseLogs.some(
      (l) =>
        l.medicationId === medicationId &&
        !l.skipped &&
        Math.abs(new Date(l.takenAt).getTime() - scheduledTime.getTime()) <= windowMs,
    );
  };

  const renderMedItem = useCallback(
    ({ item }: { item: Medication }) => {
      const lowStock =
        item.remainingPills !== undefined &&
        item.totalPills !== undefined &&
        item.remainingPills <= item.totalPills * 0.2;
      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.medName}>{item.name}</Text>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(item.id)}
                style={[styles.actionBtn, styles.deleteBtn]}
              >
                <Text style={[styles.actionBtnText, styles.deleteBtnText]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.medDetail}>
            {item.dosage} · every {item.frequency}h
          </Text>
          <Text style={styles.medDetail}>Started: {formatLocalDate(item.startDate)}</Text>
          <Text style={styles.medDetail}>Pet ID: {item.petId}</Text>
          {item.instructions ? (
            <Text style={styles.medDetail}>Instructions: {item.instructions}</Text>
          ) : null}
          {item.prescriberInfo?.name ? (
            <Text style={styles.medDetail}>
              Prescriber: {item.prescriberInfo.name}
              {item.prescriberInfo.contact ? ` • ${item.prescriberInfo.contact}` : ''}
            </Text>
          ) : null}
          {item.pharmacyInfo?.name ? (
            <Text style={styles.medDetail}>
              Pharmacy: {item.pharmacyInfo.name}
              {item.pharmacyInfo.phone ? ` • ${item.pharmacyInfo.phone}` : ''}
            </Text>
          ) : null}
          {item.endDate ? (
            <Text style={styles.medDetail}>Ends: {formatLocalDate(item.endDate)}</Text>
          ) : null}
          {item.remainingPills !== undefined && (
            <Text style={[styles.medDetail, lowStock && styles.lowStock]}>
              Pills remaining: {item.remainingPills}
              {lowStock ? ' ⚠ Low stock' : ''}
            </Text>
          )}
          {item.refillDate ? (
            <Text style={styles.medDetail}>Refill by: {formatLocalDate(item.refillDate)}</Text>
          ) : null}
          <View style={styles.doseActions}>
            <TouchableOpacity
              style={styles.logBtn}
              onPress={() => void handleLogDose(item.id, false)}
            >
              <Text style={styles.logBtnText}>✓ Log Dose</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.logBtn, styles.skipBtn]}
              onPress={() => void handleLogDose(item.id, true)}
            >
              <Text style={styles.logBtnText}>✗ Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [openEdit, handleDelete, handleLogDose],
  );
  const renderSchedule = (dates: Date[]) => (
    <ScrollView style={styles.scheduleContainer}>
      {dates.map((date) => {
        const label =
          dates.length === 1
            ? 'Today'
            : `${DAYS[date.getDay()]} ${date.getMonth() + 1}/${date.getDate()}`;
        const slots = medications.flatMap((med) =>
          getDaySchedule(med, date).map((time) => ({ med, time })),
        );
        slots.sort((a, b) => a.time.getTime() - b.time.getTime());
        return (
          <View key={date.toDateString()} style={styles.dayBlock}>
            <Text style={styles.dayLabel}>{label}</Text>
            {slots.length === 0 ? (
              <Text style={styles.emptyText}>No doses scheduled</Text>
            ) : (
              slots.map(({ med, time }) => {
                const taken = isDoseTaken(med.id, time);
                return (
                  <View
                    key={`${med.id}-${time.toISOString()}`}
                    style={[styles.slotRow, taken && styles.slotTaken]}
                  >
                    <Text style={styles.slotTime}>{formatLocalTime(time)}</Text>
                    <Text style={styles.slotName}>
                      {med.name} · {med.dosage}
                    </Text>
                    {taken && <Text style={styles.takenBadge}>✓</Text>}
                  </View>
                );
              })
            )}
          </View>
        );
      })}
    </ScrollView>
  );

  const renderModal = () => (
    <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
      <View style={styles.modalOverlay}>
        <ScrollView style={styles.modalContent}>
          <Text style={styles.modalTitle}>{editingMed ? 'Edit Medication' : 'Add Medication'}</Text>
          {[
            { placeholder: 'Medication name *', key: 'name' as const },
            { placeholder: 'Dosage (e.g. 5mg) *', key: 'dosage' as const },
            { placeholder: 'Pet ID *', key: 'petId' as const },
          ].map(({ placeholder, key }) => (
            <TextInput
              key={key}
              style={styles.input}
              placeholder={placeholder}
              value={form[key] as string}
              onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
            />
          ))}
          <TextInput
            style={styles.input}
            placeholder="Frequency (hours between doses)"
            keyboardType="numeric"
            value={String(form.frequency)}
            onChangeText={(v) => setForm((f) => ({ ...f, frequency: Number(v) || 8 }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Start date (YYYY-MM-DD)"
            value={form.startDate.slice(0, 10)}
            onChangeText={(v) => setForm((f) => ({ ...f, startDate: new Date(v).toISOString() }))}
          />
          <TextInput
            style={styles.input}
            placeholder="End date (YYYY-MM-DD)"
            value={form.endDate?.slice(0, 10) ?? ''}
            onChangeText={(v) =>
              setForm((f) => ({
                ...f,
                endDate: v ? new Date(v).toISOString() : '',
              }))
            }
          />
          <TextInput
            style={styles.input}
            placeholder="Refill date (YYYY-MM-DD)"
            value={form.refillDate?.slice(0, 10) ?? ''}
            onChangeText={(v) =>
              setForm((f) => ({
                ...f,
                refillDate: v ? new Date(v).toISOString() : '',
              }))
            }
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Instructions"
            multiline
            value={form.instructions ?? ''}
            onChangeText={(v) => setForm((f) => ({ ...f, instructions: v }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Prescriber name"
            value={form.prescriberInfo?.name ?? ''}
            onChangeText={(v) =>
              setForm((f) => ({
                ...f,
                prescriberInfo: { ...f.prescriberInfo, name: v },
              }))
            }
          />
          <TextInput
            style={styles.input}
            placeholder="Prescriber contact"
            value={form.prescriberInfo?.contact ?? ''}
            onChangeText={(v) =>
              setForm((f) => ({
                ...f,
                prescriberInfo: { ...f.prescriberInfo, contact: v },
              }))
            }
          />
          <TextInput
            style={styles.input}
            placeholder="Prescriber clinic"
            value={form.prescriberInfo?.clinic ?? ''}
            onChangeText={(v) =>
              setForm((f) => ({
                ...f,
                prescriberInfo: { ...f.prescriberInfo, clinic: v },
              }))
            }
          />
          <TextInput
            style={styles.input}
            placeholder="Pharmacy name"
            value={form.pharmacyInfo?.name ?? ''}
            onChangeText={(v) =>
              setForm((f) => ({
                ...f,
                pharmacyInfo: { ...f.pharmacyInfo, name: v },
              }))
            }
          />
          <TextInput
            style={styles.input}
            placeholder="Pharmacy phone"
            value={form.pharmacyInfo?.phone ?? ''}
            onChangeText={(v) =>
              setForm((f) => ({
                ...f,
                pharmacyInfo: { ...f.pharmacyInfo, phone: v },
              }))
            }
          />
          <TextInput
            style={styles.input}
            placeholder="Pharmacy address"
            value={form.pharmacyInfo?.address ?? ''}
            onChangeText={(v) =>
              setForm((f) => ({
                ...f,
                pharmacyInfo: { ...f.pharmacyInfo, address: v },
              }))
            }
          />
          <TextInput
            style={styles.input}
            placeholder="Total pills"
            keyboardType="numeric"
            value={form.totalPills !== undefined ? String(form.totalPills) : ''}
            onChangeText={(v) => setForm((f) => ({ ...f, totalPills: v ? Number(v) : undefined }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Remaining pills"
            keyboardType="numeric"
            value={form.remainingPills !== undefined ? String(form.remainingPills) : ''}
            onChangeText={(v) =>
              setForm((f) => ({
                ...f,
                remainingPills: v ? Number(v) : undefined,
              }))
            }
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Notes"
            multiline
            value={form.notes ?? ''}
            onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={() => void handleSave()}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Medications</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.tabs}>
        {(['list', 'daily', 'weekly'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.activeTab]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.activeTabText]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'list' && (
        <FlatList
          data={medications}
          keyExtractor={(item) => item.id}
          renderItem={renderMedItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No medications added yet.</Text>}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
        />
      )}
      {tab === 'daily' && renderSchedule(todayDates())}
      {tab === 'weekly' && renderSchedule(weekDates())}
      {renderModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  addBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '600' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#4CAF50' },
  tabText: { color: '#666', fontSize: 14 },
  activeTabText: { color: '#4CAF50', fontWeight: '600' },
  listContent: { padding: 12 },
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  medName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  cardActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#e8f5e9',
  },
  actionBtnText: { fontSize: 12, color: '#4CAF50', fontWeight: '600' },
  deleteBtn: { backgroundColor: '#fdecea' },
  deleteBtnText: { color: '#e53935' },
  medDetail: { fontSize: 13, color: '#555', marginTop: 2 },
  lowStock: { color: '#e65100', fontWeight: '600' },
  doseActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  logBtn: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  skipBtn: { backgroundColor: '#9e9e9e' },
  logBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  scheduleContainer: { flex: 1, padding: 12 },
  dayBlock: { marginBottom: 16 },
  dayLabel: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 6 },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  slotTaken: { borderLeftColor: '#9e9e9e', opacity: 0.7 },
  slotTime: { fontSize: 13, fontWeight: '600', color: '#333', width: 60 },
  slotName: { flex: 1, fontSize: 13, color: '#555' },
  takenBadge: { fontSize: 16, color: '#4CAF50' },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 20,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
    color: '#1a1a1a',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 14,
    backgroundColor: '#fafafa',
  },
  textArea: { height: 70, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#666', fontWeight: '600' },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '600' },
});

export default MedicationScreen;
