import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { reminderService, type SnoozeDuration } from '../services/reminderService';

interface Props {
  visible: boolean;
  reminderId: string;
  nextDoseWindowMs?: number;
  onDismiss: () => void;
  onSnoozed: (until: Date) => void;
}

const QUICK_OPTIONS: { label: string; minutes: SnoozeDuration }[] = [
  { label: '15 min', minutes: 15 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
];

export default function ReminderSnoozeModal({
  visible,
  reminderId,
  nextDoseWindowMs,
  onDismiss,
  onSnoozed,
}: Props) {
  const [custom, setCustom] = useState('');
  const [suggested, setSuggested] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;

    reminderService.getSuggestedTime(reminderId).then(setSuggested);
  }, [visible, reminderId]);

  const handleSnooze = async (minutes: SnoozeDuration) => {
    setLoading(true);

    try {
      const until = await reminderService.snooze(reminderId, minutes, nextDoseWindowMs);
      onSnoozed(until);
    } catch (error) {
      Alert.alert(
        'Cannot snooze',
        error instanceof Error ? error.message : 'Unable to snooze this reminder',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCustom = () => {
    const mins = parseInt(custom, 10);
    if (!Number.isFinite(mins) || mins < 1) {
      Alert.alert('Enter a valid duration in minutes');
      return;
    }

    handleSnooze(mins);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Snooze Reminder</Text>

          {suggested && (
            <Text style={styles.suggestion}>Based on your history, {suggested} works best.</Text>
          )}

          <View style={styles.options}>
            {QUICK_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.minutes}
                style={styles.option}
                onPress={() => handleSnooze(opt.minutes)}
                disabled={loading}
              >
                <Text style={styles.optionText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.customRow}>
            <TextInput
              style={styles.input}
              placeholder="Custom minutes"
              keyboardType="numeric"
              value={custom}
              onChangeText={setCustom}
            />
            <TouchableOpacity style={styles.customBtn} onPress={handleCustom} disabled={loading}>
              <Text style={styles.customBtnText}>Snooze</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.dismiss} onPress={onDismiss}>
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  suggestion: { fontSize: 13, color: '#4A90A4', marginBottom: 16 },
  options: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  option: { flex: 1, backgroundColor: '#EDF5F7', borderRadius: 8, padding: 12, alignItems: 'center' },
  optionText: { color: '#2F6F7E', fontWeight: '600' },
  customRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 },
  customBtn: { backgroundColor: '#4A90A4', borderRadius: 8, padding: 10, justifyContent: 'center' },
  customBtnText: { color: '#fff', fontWeight: '600' },
  dismiss: { alignItems: 'center', padding: 12 },
  dismissText: { color: '#667' },
});
