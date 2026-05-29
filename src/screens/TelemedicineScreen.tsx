import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { Appointment } from '../models/Appointment';
import petService, { type Pet } from '../services/petService';
import {
  getTelemedicineAvailability,
  reportTelemedicineNoShow,
  scheduleTelemedicineAppointment,
  submitTelemedicineQuestionnaire,
  type TelemedicineAvailabilitySlot,
} from '../services/telemedicineService';
import { searchVets, type VetProfile } from '../services/vetService';

const TelemedicineScreen: React.FC = () => {
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [vets, setVets] = useState<VetProfile[]>([]);
  const [selectedVet, setSelectedVet] = useState<VetProfile | null>(null);
  const [slots, setSlots] = useState<TelemedicineAvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TelemedicineAvailabilitySlot | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [questionnaire, setQuestionnaire] = useState({ symptoms: '', duration: '', concerns: '' });
  const [loading, setLoading] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [localTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

  useEffect(() => {
    void loadPets();
    void loadVets();
  }, []);

  useEffect(() => {
    if (selectedVet) {
      void loadAvailability(selectedVet.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVet]);

  const isReadyToBook = useMemo(
    () => !!selectedPet && !!selectedVet && !!selectedSlot,
    [selectedPet, selectedVet, selectedSlot],
  );

  const loadPets = async () => {
    try {
      setLoading(true);
      const data = await petService.getAllPets();
      setPets(data);
      if (data.length > 0) setSelectedPet(data[0]);
    } catch (err) {
      Alert.alert('Unable to load pets', String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadVets = async () => {
    try {
      setLoading(true);
      const results = await searchVets({ available: true });
      setVets(results);
      if (results.length > 0) setSelectedVet(results[0]);
    } catch (err) {
      Alert.alert('Unable to load veterinarians', String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadAvailability = async (vetId: string) => {
    try {
      setAvailabilityLoading(true);
      const items = await getTelemedicineAvailability(vetId, localTimeZone);
      setSlots(items.slice(0, 12));
      setSelectedSlot(items[0] ?? null);
    } catch (err) {
      Alert.alert('Unable to load availability', String(err));
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const handleBookAppointment = async () => {
    if (!selectedPet || !selectedVet || !selectedSlot) return;

    try {
      setLoading(true);
      const result = await scheduleTelemedicineAppointment({
        petId: selectedPet.id,
        vetId: selectedVet.id,
        date: selectedSlot.date,
        time: selectedSlot.time,
        timeZone: selectedSlot.timeZone,
        durationMinutes: 30,
        notes: 'Telemedicine consultation requested through app.',
      });
      setAppointment(result);
      Alert.alert('Appointment confirmed', 'Your telemedicine consultation has been scheduled.');
    } catch (err) {
      Alert.alert('Schedule failed', String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitQuestionnaire = async () => {
    if (!appointment) return;
    try {
      setLoading(true);
      const payload = {
        symptoms: questionnaire.symptoms.trim(),
        duration: questionnaire.duration.trim(),
        concerns: questionnaire.concerns.trim(),
      };
      const updated = await submitTelemedicineQuestionnaire(appointment.id, payload);
      setAppointment(updated);
      Alert.alert(
        'Questionnaire submitted',
        'Your responses have been attached to the appointment.',
      );
    } catch (err) {
      Alert.alert('Unable to submit questionnaire', String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleReportNoShow = async () => {
    if (!appointment) return;
    try {
      setLoading(true);
      const updated = await reportTelemedicineNoShow(
        appointment.id,
        'Patient did not join in time',
      );
      setAppointment(updated);
      Alert.alert('No-show reported', 'The appointment has been updated.');
    } catch (err) {
      Alert.alert('Unable to update appointment', String(err));
    } finally {
      setLoading(false);
    }
  };

  const renderVetItem = ({ item }: { item: VetProfile }) => (
    <Pressable
      style={[styles.card, selectedVet?.id === item.id && styles.cardSelected]}
      onPress={() => setSelectedVet(item)}
    >
      <Text style={styles.cardTitle}>{item.name}</Text>
      <Text style={styles.cardSubtitle}>{item.specialty}</Text>
      <Text style={styles.cardMeta}>{item.address}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Telemedicine</Text>
      <Text style={styles.subtitle}>Book a video consultation with a licensed veterinarian.</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Choose a pet</Text>
        {pets.length === 0 ? (
          <Text style={styles.empty}>No pets found.</Text>
        ) : (
          <FlatList
            data={pets}
            horizontal
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.chip, selectedPet?.id === item.id && styles.chipActive]}
                onPress={() => setSelectedPet(item)}
              >
                <Text style={styles.chipText}>{item.name}</Text>
              </Pressable>
            )}
            contentContainerStyle={styles.chipList}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available veterinarians</Text>
        {loading ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            data={vets}
            keyExtractor={(item) => item.id}
            renderItem={renderVetItem}
            horizontal
            contentContainerStyle={styles.cardList}
            ListEmptyComponent={<Text style={styles.empty}>No vets available right now.</Text>}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Availability ({localTimeZone})</Text>
        {availabilityLoading ? (
          <ActivityIndicator />
        ) : slots.length === 0 ? (
          <Text style={styles.empty}>Select a vet to view available appointments.</Text>
        ) : (
          <FlatList
            data={slots}
            keyExtractor={(item) => `${item.date}-${item.time}`}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.slotCard,
                  selectedSlot?.date === item.date &&
                    selectedSlot.time === item.time &&
                    styles.slotSelected,
                ]}
                onPress={() => setSelectedSlot(item)}
              >
                <Text style={styles.slotText}>{item.display}</Text>
              </Pressable>
            )}
          />
        )}
      </View>

      <Pressable
        style={[styles.primaryBtn, !isReadyToBook && styles.primaryBtnDisabled]}
        onPress={handleBookAppointment}
        disabled={!isReadyToBook || loading}
      >
        <Text style={styles.primaryBtnText}>Book Telemedicine Appointment</Text>
      </Pressable>

      {appointment ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Confirmed Appointment</Text>
          <Text style={styles.detailText}>
            Vet: {selectedVet?.name ?? appointment.vetName ?? appointment.vet?.name}
          </Text>
          <Text style={styles.detailText}>
            Pet: {selectedPet?.name ?? appointment.petName ?? appointment.pet?.name}
          </Text>
          <Text style={styles.detailText}>
            {appointment.date} @ {appointment.time} ({appointment.timeZone ?? localTimeZone})
          </Text>
          <Text style={styles.detailText}>Video link:</Text>
          <Text style={styles.linkText}>{appointment.videoCallUrl}</Text>

          {!appointment.questionnaireRespondedAt ? (
            <>
              <Text style={styles.sectionTitle}>Pre-consultation questionnaire</Text>
              <TextInput
                style={styles.input}
                placeholder="Describe symptoms"
                value={questionnaire.symptoms}
                onChangeText={(text) => setQuestionnaire((prev) => ({ ...prev, symptoms: text }))}
                multiline
              />
              <TextInput
                style={styles.input}
                placeholder="How long has it been happening?"
                value={questionnaire.duration}
                onChangeText={(text) => setQuestionnaire((prev) => ({ ...prev, duration: text }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Any urgent concerns?"
                value={questionnaire.concerns}
                onChangeText={(text) => setQuestionnaire((prev) => ({ ...prev, concerns: text }))}
                multiline
              />
              <Pressable
                style={styles.primaryBtn}
                onPress={handleSubmitQuestionnaire}
                disabled={loading}
              >
                <Text style={styles.primaryBtnText}>Submit Questionnaire</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.infoText}>
              Questionnaire submitted on{' '}
              {new Date(appointment.questionnaireRespondedAt).toLocaleString()}
            </Text>
          )}

          <Pressable style={styles.secondaryBtn} onPress={handleReportNoShow} disabled={loading}>
            <Text style={styles.secondaryBtnText}>Report No-Show</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F7F8FA' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#5A5F6F', marginBottom: 18 },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  cardList: { paddingBottom: 8 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginRight: 12,
    minWidth: 180,
    elevation: 1,
  },
  cardSelected: { borderColor: '#007AFF', borderWidth: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#657786', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#7A7A7A' },
  chipList: { paddingVertical: 8 },
  chip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
    elevation: 1,
  },
  chipActive: { backgroundColor: '#007AFF' },
  chipText: { color: '#1F2937', fontWeight: '600' },
  slotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
  },
  slotSelected: { borderColor: '#007AFF', borderWidth: 1 },
  slotText: { fontSize: 15, color: '#1F2937' },
  primaryBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryBtnText: { color: '#111827', fontWeight: '700' },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  empty: { color: '#6B7280' },
  detailText: { color: '#1F2937', marginBottom: 4 },
  linkText: { color: '#007AFF', marginBottom: 8 },
  infoText: { color: '#374151', marginTop: 12 },
});

export default TelemedicineScreen;
