import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type AttachmentType = 'measurement' | 'photo';

type ClinicalNoteAttachment = {
  id: string;
  type: AttachmentType;
  label: string;
  value: string;
};

type ClinicalNoteAccessControl = {
  role: 'owner' | 'vet' | 'clinic' | 'guest';
  entityId: string;
  permission: 'read' | 'comment' | 'edit';
};

const COMMON_TEMPLATES = [
  {
    title: 'Routine Checkup',
    subjective: 'Routine wellness exam following last appointment.',
    objective: 'Heart rate normal, weight stable, coat looks healthy.',
    assessment: 'No acute concerns. Mild dental tartar observed.',
    plan: 'Continue current diet, schedule dental cleaning in 3 months.',
  },
  {
    title: 'Post-Vaccination',
    subjective: 'Owner reports mild lethargy and reduced appetite after vaccination.',
    objective: 'Temperature within normal range, injection site clean.',
    assessment: 'Expected post-vaccine reaction; not indicative of infection.',
    plan: 'Monitor for 48 hours, provide water, return if swelling or fever develops.',
  },
  {
    title: 'Skin Irritation',
    subjective: 'Localized scratching on left flank. Owner reports redness for 2 days.',
    objective: 'Mild erythema, no open lesions, skin is warm to the touch.',
    assessment: 'Suspected contact dermatitis. No signs of systemic allergy.',
    plan: 'Apply topical emollient, avoid new detergents, re-check in 7 days.',
  },
];

interface ClinicalNotesScreenProps {
  petId?: string;
  onBack?: () => void;
}

const ClinicalNotesScreen: React.FC<ClinicalNotesScreenProps> = ({ petId: initialPetId = '', onBack }) => {
  const [petId, setPetId] = useState(initialPetId);
  const [vetId, setVetId] = useState('');
  const [subjective, setSubjective] = useState('');
  const [objective, setObjective] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [attachments, setAttachments] = useState<ClinicalNoteAttachment[]>([]);
  const [measurementLabel, setMeasurementLabel] = useState('');
  const [measurementValue, setMeasurementValue] = useState('');
  const [photoLabel, setPhotoLabel] = useState('');
  const [photoReference, setPhotoReference] = useState('');
  const [allowVetAccess, setAllowVetAccess] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const accessControls = useMemo<ClinicalNoteAccessControl[]>(() => {
    if (!allowVetAccess) return [];
    return [
      {
        role: 'vet',
        entityId: vetId.trim() || 'unassigned-vet',
        permission: 'read',
      },
    ];
  }, [allowVetAccess, vetId]);

  const applyTemplate = (index: number) => {
    const template = COMMON_TEMPLATES[index];
    setSubjective(template.subjective);
    setObjective(template.objective);
    setAssessment(template.assessment);
    setPlan(template.plan);
  };

  const addMeasurement = () => {
    if (!measurementLabel.trim() || !measurementValue.trim()) {
      Alert.alert('Validation', 'Measurement label and value are required.');
      return;
    }
    setAttachments((current) => [
      ...current,
      {
        id: Date.now().toString(),
        type: 'measurement',
        label: measurementLabel.trim(),
        value: measurementValue.trim(),
      },
    ]);
    setMeasurementLabel('');
    setMeasurementValue('');
  };

  const addPhotoReference = () => {
    if (!photoLabel.trim() || !photoReference.trim()) {
      Alert.alert('Validation', 'Photo label and reference are required.');
      return;
    }
    setAttachments((current) => [
      ...current,
      {
        id: Date.now().toString(),
        type: 'photo',
        label: photoLabel.trim(),
        value: photoReference.trim(),
      },
    ]);
    setPhotoLabel('');
    setPhotoReference('');
  };

  const handleSubmit = async () => {
    if (!vetId.trim() || !petId.trim()) {
      Alert.alert('Validation', 'Vet ID and Pet ID are required.');
      return;
    }
    if (!subjective.trim() || !objective.trim() || !assessment.trim() || !plan.trim()) {
      Alert.alert('Validation', 'Subjective, Objective, Assessment, and Plan fields are all required.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vetId: vetId.trim(),
          petId: petId.trim(),
          subjective: subjective.trim(),
          objective: objective.trim(),
          assessment: assessment.trim(),
          plan: plan.trim(),
          attachments,
          accessControls,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Unable to submit clinical note');
      }

      Alert.alert('Success', 'Clinical note anchored successfully.');
      setSubjective('');
      setObjective('');
      setAssessment('');
      setPlan('');
      setAttachments([]);
      setAllowVetAccess(true);
    } catch (error) {
      Alert.alert('Submit failed', error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Vet Clinical Notes</Text>

        {onBack ? (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.label}>Pet ID</Text>
        <TextInput
          style={styles.input}
          value={petId}
          placeholder="Pet ID"
          onChangeText={setPetId}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Vet ID</Text>
        <TextInput
          style={styles.input}
          value={vetId}
          placeholder="Vet ID"
          onChangeText={setVetId}
          autoCapitalize="none"
        />

        <Text style={styles.sectionTitle}>Common Templates</Text>
        <View style={styles.templateRow}>
          {COMMON_TEMPLATES.map((template, index) => (
            <TouchableOpacity
              key={template.title}
              style={styles.templateButton}
              onPress={() => applyTemplate(index)}
            >
              <Text style={styles.templateButtonText}>{template.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Subjective</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={subjective}
          placeholder="Subjective findings"
          onChangeText={setSubjective}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>Objective</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={objective}
          placeholder="Objective measurements"
          onChangeText={setObjective}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>Assessment</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={assessment}
          placeholder="Clinical assessment"
          onChangeText={setAssessment}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>Plan</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={plan}
          placeholder="Treatment and follow-up plan"
          onChangeText={setPlan}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.sectionTitle}>Attachments</Text>
        <View style={styles.attachmentRow}>
          <TextInput
            style={[styles.input, styles.attachmentInput]}
            value={measurementLabel}
            placeholder="Measurement label"
            onChangeText={setMeasurementLabel}
          />
          <TextInput
            style={[styles.input, styles.attachmentInput]}
            value={measurementValue}
            placeholder="Value"
            onChangeText={setMeasurementValue}
          />
          <TouchableOpacity style={styles.addButton} onPress={addMeasurement}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.attachmentRow}>
          <TextInput
            style={[styles.input, styles.attachmentInput]}
            value={photoLabel}
            placeholder="Photo label"
            onChangeText={setPhotoLabel}
          />
          <TextInput
            style={[styles.input, styles.attachmentInput]}
            value={photoReference}
            placeholder="Reference metadata"
            onChangeText={setPhotoReference}
          />
          <TouchableOpacity style={styles.addButton} onPress={addPhotoReference}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {attachments.length > 0 ? (
          <View style={styles.attachmentsList}>
            {attachments.map((attachment) => (
              <View key={attachment.id} style={styles.attachmentItem}>
                <Text style={styles.attachmentMeta}>{attachment.type.toUpperCase()}:</Text>
                <Text style={styles.attachmentText}>{attachment.label}</Text>
                <Text style={styles.attachmentText}>{attachment.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Access Control</Text>
        <View style={styles.accessRow}>
          <Text style={styles.accessLabel}>Grant vet read access</Text>
          <Switch value={allowVetAccess} onValueChange={setAllowVetAccess} />
        </View>

        <View style={styles.submitContainer}>
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? 'Anchoring...' : 'Submit & Anchor Note'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  backButton: { marginBottom: 16 },
  backButtonText: { color: '#1f65ff', fontSize: 16 },
  sectionTitle: { marginTop: 22, marginBottom: 8, fontSize: 16, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  multiline: { minHeight: 120 },
  templateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  templateButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  templateButtonText: { color: '#1f2937', fontWeight: '600' },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  attachmentInput: { flex: 1, marginRight: 8 },
  addButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#1f65ff',
  },
  addButtonText: { color: '#fff', fontWeight: '700' },
  attachmentsList: { marginBottom: 12 },
  attachmentItem: { marginBottom: 10, backgroundColor: '#f8fafc', padding: 10, borderRadius: 10 },
  attachmentMeta: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  attachmentText: { fontSize: 14, color: '#374151' },
  accessRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  accessLabel: { flex: 1, fontSize: 15 },
  submitContainer: { marginTop: 24 },
  submitButton: {
    backgroundColor: '#1f65ff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: { backgroundColor: '#a5b4fc' },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

export default ClinicalNotesScreen;
