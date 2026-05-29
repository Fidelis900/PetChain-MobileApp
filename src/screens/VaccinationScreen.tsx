import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

import { scheduleVaccinationReminder } from '../services/notificationService';
import {
  type VaccinationReminder,
  exportVaccinationCertificate,
  getVaccinationReminders,
  markVaccinationAdministered,
} from '../services/vaccinationService';
import { formatLocalDate } from '../utils/dateLocale';
import { useSecureScreen } from '../utils/secureScreen';

const STATUS_LABELS: Record<VaccinationReminder['status'], string> = {
  administered: 'Administered',
  overdue: 'Overdue',
  due_soon: 'Due soon',
  upcoming: 'Upcoming',
};

interface VaccinationScreenProps {
  petId?: string;
}

const VaccinationScreen: React.FC<VaccinationScreenProps> = ({ petId: initialPetId }) => {
  useSecureScreen();

  const [petId, setPetId] = useState(initialPetId ?? '');
  const [reminders, setReminders] = useState<VaccinationReminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selected, setSelected] = useState<VaccinationReminder | null>(null);
  const [administeredDate, setAdministeredDate] = useState(new Date().toISOString().slice(0, 10));
  const [lotNumber, setLotNumber] = useState('');
  const [manufacturer, setManufacturer] = useState('');

  const sortedReminders = useMemo(
    () => [...reminders].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [reminders],
  );

  const loadReminders = useCallback(async () => {
    if (!petId.trim()) return;
    setLoading(true);
    try {
      const nextReminders = await getVaccinationReminders(petId.trim());
      setReminders(nextReminders);
      await Promise.all(
        nextReminders.map((reminder) =>
          scheduleVaccinationReminder({
            id: reminder.id,
            name: reminder.vaccineName,
            dueDate: reminder.dueDate,
            petId: reminder.petId,
          }),
        ),
      );
    } catch (error) {
      Alert.alert(
        'Vaccinations',
        error instanceof Error ? error.message : 'Unable to load reminders.',
      );
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    void loadReminders();
  }, [loadReminders]);

  const openAdministered = (reminder: VaccinationReminder) => {
    setSelected(reminder);
    setAdministeredDate(new Date().toISOString().slice(0, 10));
    setLotNumber('');
    setManufacturer('');
    setModalVisible(true);
  };

  const saveAdministered = async () => {
    if (!selected) return;
    try {
      await markVaccinationAdministered({
        petId: selected.petId,
        vaccineName: selected.vaccineName,
        administeredDate,
        lotNumber,
        manufacturer,
        nextDueDate: selected.schedule.boosterIntervalMonths ? selected.dueDate : undefined,
        anchorToBlockchain: true,
      });
      setModalVisible(false);
      await loadReminders();
    } catch (error) {
      Alert.alert(
        'Vaccinations',
        error instanceof Error ? error.message : 'Unable to save record.',
      );
    }
  };

  const handleExportCertificate = async () => {
    if (!petId.trim()) {
      Alert.alert('Vaccinations', 'Enter a pet ID before exporting a certificate.');
      return;
    }
    try {
      const certificate = await exportVaccinationCertificate(petId.trim());
      Alert.alert('Vaccination Certificate', certificate.slice(0, 900));
    } catch (error) {
      Alert.alert(
        'Vaccinations',
        error instanceof Error ? error.message : 'Unable to export certificate.',
      );
    }
  };

  const renderReminder = ({ item }: { item: VaccinationReminder }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.vaccineName}>{item.vaccineName}</Text>
        <Text style={[styles.status, styles[item.status]]}>{STATUS_LABELS[item.status]}</Text>
      </View>
      <Text style={styles.detail}>Due: {formatLocalDate(item.dueDate)}</Text>
      <Text style={styles.detail}>
        {item.schedule.core ? 'Core vaccine' : 'Risk-based vaccine'} ·{' '}
        {item.schedule.minimumAgeWeeks}+ weeks
      </Text>
      <Text style={styles.detail}>{item.schedule.notes}</Text>
      {item.lastAdministeredDate ? (
        <Text style={styles.detail}>
          Last administered: {formatLocalDate(item.lastAdministeredDate)}
        </Text>
      ) : null}
      {item.veterinaryVerification?.blockchainTxHash ? (
        <Text style={styles.verified}>Vet verified · Anchored on-chain</Text>
      ) : (
        <Text style={styles.pending}>Awaiting vet verification</Text>
      )}
      <Text style={styles.detail}>
        Reminders:{' '}
        {item.reminderDates.length
          ? item.reminderDates.map(formatLocalDate).join(', ')
          : 'none scheduled'}
      </Text>
      <TouchableOpacity style={styles.primaryButton} onPress={() => openAdministered(item)}>
        <Text style={styles.primaryButtonText}>Mark administered</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vaccination Schedule</Text>
      <Text style={styles.subtitle}>
        Track age-specific dog and cat vaccines, reminder dates, and vet-verified blockchain
        records.
      </Text>
      <View style={styles.petSearchRow}>
        <TextInput
          value={petId}
          onChangeText={setPetId}
          placeholder="Pet ID"
          style={styles.petInput}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.secondaryButton} onPress={() => void loadReminders()}>
          <Text style={styles.secondaryButtonText}>{loading ? 'Loading…' : 'Load'}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.certificateButton}
        onPress={() => void handleExportCertificate()}
      >
        <Text style={styles.certificateButtonText}>Export certificate</Text>
      </TouchableOpacity>
      <FlatList
        data={sortedReminders}
        keyExtractor={(item) => item.id}
        renderItem={renderReminder}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Enter a pet ID to generate upcoming vaccination reminders.
          </Text>
        }
        contentContainerStyle={styles.listContent}
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalTitle}>Record vaccination</Text>
            <Text style={styles.modalLabel}>{selected?.vaccineName}</Text>
            <TextInput
              value={administeredDate}
              onChangeText={setAdministeredDate}
              placeholder="Administered date (YYYY-MM-DD)"
              style={styles.input}
            />
            <TextInput
              value={manufacturer}
              onChangeText={setManufacturer}
              placeholder="Manufacturer"
              style={styles.input}
            />
            <TextInput
              value={lotNumber}
              onChangeText={setLotNumber}
              placeholder="Lot number"
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => void saveAdministered()}
              >
                <Text style={styles.primaryButtonText}>Save & anchor</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F7FAFC' },
  title: { fontSize: 24, fontWeight: '700', color: '#16324F', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#526171', marginBottom: 14 },
  petSearchRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  petInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#D8E0E8',
  },
  listContent: { paddingBottom: 32 },
  empty: { textAlign: 'center', color: '#667085', padding: 24 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E6ECF2',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  vaccineName: { fontSize: 18, fontWeight: '700', color: '#102A43' },
  status: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  administered: { color: '#0F5132', backgroundColor: '#D1E7DD' },
  overdue: { color: '#842029', backgroundColor: '#F8D7DA' },
  due_soon: { color: '#664D03', backgroundColor: '#FFF3CD' },
  upcoming: { color: '#084298', backgroundColor: '#CFE2FF' },
  detail: { color: '#344054', marginTop: 4 },
  verified: { color: '#047857', fontWeight: '700', marginTop: 8 },
  pending: { color: '#B45309', fontWeight: '700', marginTop: 8 },
  primaryButton: {
    backgroundColor: '#1C7ED6',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700' },
  secondaryButton: {
    backgroundColor: '#E7F0FA',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: '#1C4E80', fontWeight: '700' },
  certificateButton: {
    borderWidth: 1,
    borderColor: '#1C7ED6',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  certificateButtonText: { color: '#1C7ED6', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  modalLabel: { color: '#344054', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginBottom: 24 },
});

export default VaccinationScreen;
