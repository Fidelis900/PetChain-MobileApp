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
import { v4 as uuid } from 'uuid';

import {
  AppointmentStatus,
  type Appointment,
  cancelAppointmentReminder,
  getAppointments,
  getPast,
  getUpcoming,
  saveAppointment,
  scheduleAppointmentReminder,
} from '../services/appointmentService';
import { formatLocalDate, formatLocalTime } from '../utils/dateLocale';
import { useSecureScreen } from '../utils/secureScreen';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'upcoming' | 'past';

const EMPTY_FORM = {
  petId: '',
  petName: '',
  title: '',
  date: '',
  location: '',
  vetName: '',
  notes: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

const AppointmentScreen: React.FC = () => {
  useSecureScreen();

  const [tab, setTab] = useState<Tab>('upcoming');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [bookingVisible, setBookingVisible] = useState(false);
  const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);
  const [rescheduleVisible, setRescheduleVisible] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [rescheduleDate, setRescheduleDate] = useState('');

  const load = useCallback(async () => {
    setAppointments(await getAppointments());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const displayed = tab === 'upcoming' ? getUpcoming(appointments) : getPast(appointments);

  // ─── Book ───────────────────────────────────────────────────────────────────

  const handleBook = async () => {
    if (!form.petName.trim() || !form.title.trim() || !form.date.trim()) {
      Alert.alert('Missing fields', 'Pet name, title and date are required.');
      return;
    }
    const dateObj = new Date(form.date);
    if (isNaN(dateObj.getTime())) {
      Alert.alert('Invalid date', 'Use format YYYY-MM-DDTHH:MM (e.g. 2026-05-10T09:00)');
      return;
    }

    const appt: Appointment = {
      id: uuid(),
      petId: form.petId.trim() || uuid(),
      vetId: 'temp-vet-id', // Required field
      petName: form.petName.trim(),
      title: form.title.trim(),
      date: dateObj.toISOString(),
      time: dateObj.toTimeString().slice(0, 5), // Required HH:MM format
      type: 'ROUTINE_CHECKUP' as Appointment['type'],
      location: form.location.trim() || undefined,
      vetName: form.vetName.trim() || undefined,
      notes: form.notes.trim() || undefined,
      status: AppointmentStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const notifId = await scheduleAppointmentReminder(appt).catch(() => null);
    if (notifId) appt.notificationId = notifId;

    await saveAppointment(appt);
    setForm(EMPTY_FORM);
    setBookingVisible(false);
    await load();
  };

  // ─── Cancel ─────────────────────────────────────────────────────────────────

  const handleCancel = (appt: Appointment) => {
    Alert.alert('Cancel appointment', `Cancel "${appt.title}"?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          if (appt.notificationId) {
            await cancelAppointmentReminder(appt.notificationId).catch(() => {});
          }
          await saveAppointment({ ...appt, status: AppointmentStatus.CANCELLED });
          setDetailAppt(null);
          await load();
        },
      },
    ]);
  };

  // ─── Reschedule ──────────────────────────────────────────────────────────────

  const handleReschedule = async () => {
    if (!detailAppt) return;
    const dateObj = new Date(rescheduleDate);
    if (isNaN(dateObj.getTime())) {
      Alert.alert('Invalid date', 'Use format YYYY-MM-DDTHH:MM');
      return;
    }

    if (detailAppt.notificationId) {
      await cancelAppointmentReminder(detailAppt.notificationId).catch(() => {});
    }

    const updated: Appointment = {
      ...detailAppt,
      date: dateObj.toISOString(),
      status: AppointmentStatus.PENDING,
      notificationId: undefined,
    };
    const notifId = await scheduleAppointmentReminder(updated).catch(() => null);
    if (notifId) updated.notificationId = notifId;

    await saveAppointment(updated);
    setRescheduleVisible(false);
    setDetailAppt(updated);
    await load();
  };

  // ─── Render helpers ──────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: Appointment }) => (
      <TouchableOpacity style={styles.card} onPress={() => setDetailAppt(item)}>
        <View style={styles.cardLeft}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardSub}>{item.petName}</Text>
          {item.vetName ? <Text style={styles.cardMeta}>Dr. {item.vetName}</Text> : null}
          {item.location ? <Text style={styles.cardMeta}>📍 {item.location}</Text> : null}
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.cardDate}>{formatLocalDate(item.date)}</Text>
          <Text style={styles.cardTime}>{formatLocalTime(item.date)}</Text>
          <View
            style={[
              styles.badge,
              item.status === AppointmentStatus.CANCELLED && styles.badgeCancelled,
            ]}
          >
            <Text style={styles.badgeText}>{item.status}</Text>
          </View>
        </View>
      </TouchableOpacity>
    ),
    [],
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Appointments</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setBookingVisible(true)}>
          <Text style={styles.addBtnText}>+ Book</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['upcoming', 'past'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={displayed}
        keyExtractor={(a) => a.id}
        renderItem={renderItem}
        contentContainerStyle={displayed.length === 0 && styles.empty}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {tab === 'upcoming' ? 'No upcoming appointments.' : 'No past appointments.'}
          </Text>
        }
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
      />

      {/* ── Book Modal ── */}
      <Modal
        visible={bookingVisible}
        animationType="slide"
        onRequestClose={() => setBookingVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Book Appointment</Text>
            <TouchableOpacity onPress={() => setBookingVisible(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            {(
              [
                { key: 'petName', label: 'Pet Name *', placeholder: 'Buddy' },
                { key: 'title', label: 'Title *', placeholder: 'Annual checkup' },
                { key: 'date', label: 'Date & Time *', placeholder: '2026-05-10T09:00' },
                { key: 'vetName', label: 'Vet Name', placeholder: 'Dr. Smith' },
                { key: 'location', label: 'Location', placeholder: 'City Vet Clinic' },
                { key: 'notes', label: 'Notes', placeholder: 'Bring vaccination records' },
              ] as { key: keyof typeof EMPTY_FORM; label: string; placeholder: string }[]
            ).map(({ key, label, placeholder }) => (
              <View key={key} style={styles.field}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={form[key]}
                  onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
                  placeholder={placeholder}
                  placeholderTextColor="#9CA3AF"
                  multiline={key === 'notes'}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.primaryBtn} onPress={() => void handleBook()}>
              <Text style={styles.primaryBtnText}>Confirm Booking</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Detail Modal ── */}
      {detailAppt && (
        <Modal visible animationType="slide" onRequestClose={() => setDetailAppt(null)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Appointment Details</Text>
              <TouchableOpacity onPress={() => setDetailAppt(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <DetailRow label="Title" value={detailAppt.title} />
              <DetailRow label="Pet" value={detailAppt.petName} />
              <DetailRow label="Date" value={formatLocalDate(detailAppt.date)} />
              <DetailRow label="Time" value={formatLocalTime(detailAppt.date)} />
              {detailAppt.vetName && <DetailRow label="Vet" value={`Dr. ${detailAppt.vetName}`} />}
              {detailAppt.location && <DetailRow label="Location" value={detailAppt.location} />}
              {detailAppt.notes && <DetailRow label="Notes" value={detailAppt.notes} />}
              <DetailRow label="Status" value={detailAppt.status} />

              {detailAppt.status === AppointmentStatus.PENDING && (
                <>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => {
                      setRescheduleDate('');
                      setRescheduleVisible(true);
                    }}
                  >
                    <Text style={styles.primaryBtnText}>Reschedule</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dangerBtn}
                    onPress={() => handleCancel(detailAppt)}
                  >
                    <Text style={styles.dangerBtnText}>Cancel Appointment</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>

          {/* ── Reschedule sub-modal ── */}
          <Modal
            visible={rescheduleVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setRescheduleVisible(false)}
          >
            <View style={styles.overlay}>
              <View style={styles.overlayCard}>
                <Text style={styles.modalTitle}>Reschedule</Text>
                <Text style={styles.label}>New Date & Time</Text>
                <TextInput
                  style={styles.input}
                  value={rescheduleDate}
                  onChangeText={setRescheduleDate}
                  placeholder="2026-06-01T10:00"
                  placeholderTextColor="#9CA3AF"
                />
                <TouchableOpacity style={styles.primaryBtn} onPress={() => void handleReschedule()}>
                  <Text style={styles.primaryBtnText}>Confirm</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => setRescheduleVisible(false)}
                >
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </Modal>
      )}
    </View>
  );
};

// ─── Detail row helper ────────────────────────────────────────────────────────

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  addBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#10B981' },
  tabText: { fontSize: 14, color: '#6B7280' },
  tabTextActive: { color: '#10B981', fontWeight: '600' },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLeft: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cardSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  cardMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  cardRight: { alignItems: 'flex-end', justifyContent: 'space-between' },
  cardDate: { fontSize: 12, color: '#374151', fontWeight: '500' },
  cardTime: { fontSize: 12, color: '#6B7280' },
  badge: {
    backgroundColor: '#D1FAE5',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  badgeCancelled: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 11, color: '#065F46', fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#9CA3AF', fontSize: 15 },
  // Modal
  modalContainer: { flex: 1, backgroundColor: '#F9FAFB' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalClose: { color: '#fff', fontSize: 20, fontWeight: '600' },
  modalBody: { padding: 20, paddingBottom: 40 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fff',
    color: '#111827',
  },
  primaryBtn: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  dangerBtn: {
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  dangerBtnText: { color: '#EF4444', fontWeight: '600', fontSize: 15 },
  secondaryBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  secondaryBtnText: { color: '#6B7280', fontSize: 14 },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: { width: 90, fontSize: 13, color: '#6B7280', fontWeight: '600' },
  detailValue: { flex: 1, fontSize: 14, color: '#111827' },
  // Reschedule overlay
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  overlayCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
});

export default AppointmentScreen;
