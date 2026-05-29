import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { Species } from '../models/Pet';
import {
  DRUG_DATABASE,
  type DosageResult,
  type DosageSafetyLevel,
  type DoseUnit,
  computeDosage,
  getDrugsForSpecies,
  lookupDrug,
} from '../utils/dosageCalculator';

const SPECIES_OPTIONS: { label: string; value: Species }[] = [
  { label: 'Dog', value: 'dog' },
  { label: 'Cat', value: 'cat' },
  { label: 'Bird', value: 'bird' },
  { label: 'Rabbit', value: 'rabbit' },
  { label: 'Other', value: 'other' },
];

const UNIT_OPTIONS: { label: string; value: DoseUnit }[] = [
  { label: 'mg', value: 'mg' },
  { label: 'ml', value: 'ml' },
  { label: 'Tablets', value: 'tablets' },
];

const SAFETY_COLORS: Record<DosageSafetyLevel, string> = {
  safe: '#4CAF50',
  low: '#FF9800',
  high: '#FF5722',
  critical: '#B71C1C',
};

const SAFETY_LABELS: Record<DosageSafetyLevel, string> = {
  safe: 'Within normal range',
  low: 'Below minimum effective dose',
  high: 'Above maximum safe dose',
  critical: 'CRITICAL — Severe toxicity risk',
};

interface VetOverride {
  dose: string;
  unit: DoseUnit;
  justification: string;
}

const DosageCalculatorScreen: React.FC = () => {
  const [species, setSpecies] = useState<Species>('dog');
  const [weightKg, setWeightKg] = useState('');
  const [selectedDrugId, setSelectedDrugId] = useState('');
  const [dosePerKg, setDosePerKg] = useState('');
  const [targetUnit, setTargetUnit] = useState<DoseUnit>('mg');
  const [result, setResult] = useState<DosageResult | null>(null);
  const [drugWarnings, setDrugWarnings] = useState<string[]>([]);
  const [vetOverrideVisible, setVetOverrideVisible] = useState(false);
  const [vetOverride, setVetOverride] = useState<VetOverride>({
    dose: '',
    unit: 'mg',
    justification: '',
  });
  const [confirmedOverride, setConfirmedOverride] = useState<VetOverride | null>(null);

  const availableDrugs = useMemo(() => getDrugsForSpecies(species), [species]);
  const selectedDrug = useMemo(
    () => DRUG_DATABASE.find((d) => d.id === selectedDrugId) ?? null,
    [selectedDrugId],
  );

  const handleSpeciesChange = useCallback((s: Species) => {
    setSpecies(s);
    setSelectedDrugId('');
    setDosePerKg('');
    setResult(null);
    setDrugWarnings([]);
    setConfirmedOverride(null);
  }, []);

  const handleDrugSelect = useCallback(
    (drugId: string) => {
      setSelectedDrugId(drugId);
      setResult(null);
      setConfirmedOverride(null);
      const lookup = lookupDrug(drugId, species);
      if (lookup) {
        setDrugWarnings([...lookup.warnings, ...lookup.contraindications]);
        if (lookup.range) {
          setDosePerKg(String(lookup.range.typicalPerKg));
          setTargetUnit(lookup.drug.defaultUnit);
        } else {
          setDosePerKg('');
        }
      }
    },
    [species],
  );

  const handleCalculate = useCallback(() => {
    const weight = parseFloat(weightKg);
    const dose = parseFloat(dosePerKg);

    if (isNaN(weight) || weight <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid weight in kg.');
      return;
    }
    if (isNaN(dose) || dose <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid dose per kg.');
      return;
    }

    const lookup = selectedDrugId ? lookupDrug(selectedDrugId, species) : null;
    const range = lookup?.range ?? undefined;

    const calculated = computeDosage(
      {
        weightKg: weight,
        dosePerKg: dose,
        targetUnit,
        concentration: selectedDrug?.concentration,
        tabletStrength: selectedDrug?.tabletStrength,
      },
      range,
    );

    setResult(calculated);
    setConfirmedOverride(null);
  }, [weightKg, dosePerKg, targetUnit, selectedDrugId, species, selectedDrug]);

  const handleVetOverrideSubmit = useCallback(() => {
    if (!vetOverride.dose.trim() || !vetOverride.justification.trim()) {
      Alert.alert(
        'Override Incomplete',
        'Please enter both the override dose and a clinical justification.',
      );
      return;
    }
    if (vetOverride.justification.trim().length < 10) {
      Alert.alert(
        'Justification Too Short',
        'Please provide a detailed clinical justification (at least 10 characters).',
      );
      return;
    }
    Alert.alert(
      'Confirm Vet Override',
      `Override dose: ${vetOverride.dose} ${vetOverride.unit}\n\nJustification: ${vetOverride.justification}\n\nThis override will be logged for audit purposes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Override',
          style: 'destructive',
          onPress: () => {
            setConfirmedOverride({ ...vetOverride });
            setVetOverrideVisible(false);
          },
        },
      ],
    );
  }, [vetOverride]);

  const renderSpeciesSelector = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Species</Text>
      <View style={styles.chipRow}>
        {SPECIES_OPTIONS.map(({ label, value }) => (
          <TouchableOpacity
            key={value}
            style={[styles.chip, species === value && styles.chipActive]}
            onPress={() => handleSpeciesChange(value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: species === value }}
          >
            <Text style={[styles.chipText, species === value && styles.chipTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderDrugSelector = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Medication</Text>
      {availableDrugs.length === 0 ? (
        <Text style={styles.emptyText}>No vet-verified drugs available for {species}.</Text>
      ) : (
        availableDrugs.map((drug) => (
          <TouchableOpacity
            key={drug.id}
            style={[styles.drugItem, selectedDrugId === drug.id && styles.drugItemActive]}
            onPress={() => handleDrugSelect(drug.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: selectedDrugId === drug.id }}
          >
            <Text style={[styles.drugName, selectedDrugId === drug.id && styles.drugNameActive]}>
              {drug.name}
            </Text>
            <Text style={styles.drugClass}>{drug.drugClass}</Text>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderWarnings = (warnings: string[], title: string) => {
    if (warnings.length === 0) return null;
    return (
      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>{title}</Text>
        {warnings.map((w, i) => (
          <Text key={i} style={styles.warningText}>
            {'•'} {w}
          </Text>
        ))}
      </View>
    );
  };

  const renderInputs = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Parameters</Text>
      <View style={styles.inputRow}>
        <Text style={styles.inputLabel}>Weight (kg)</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder="e.g. 10.5"
          value={weightKg}
          onChangeText={setWeightKg}
          accessibilityLabel="Pet weight in kilograms"
        />
      </View>
      <View style={styles.inputRow}>
        <Text style={styles.inputLabel}>Dose (mg/kg)</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder="e.g. 10"
          value={dosePerKg}
          onChangeText={setDosePerKg}
          accessibilityLabel="Dose in milligrams per kilogram"
        />
      </View>
      <View style={styles.inputRow}>
        <Text style={styles.inputLabel}>Output unit</Text>
        <View style={styles.chipRow}>
          {UNIT_OPTIONS.map(({ label, value }) => (
            <TouchableOpacity
              key={value}
              style={[styles.chip, targetUnit === value && styles.chipActive]}
              onPress={() => setTargetUnit(value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: targetUnit === value }}
            >
              <Text style={[styles.chipText, targetUnit === value && styles.chipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderResult = () => {
    if (!result) return null;
    const safetyColor = SAFETY_COLORS[result.safetyLevel];
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Calculated Dose</Text>
        <View style={[styles.resultCard, { borderLeftColor: safetyColor }]}>
          <Text style={styles.resultDose}>
            {result.dose} {result.unit}
          </Text>
          <Text style={styles.resultMg}>({result.doseInMg} mg total)</Text>
          {result.rangeMin !== undefined && result.rangeMax !== undefined && (
            <Text style={styles.resultRange}>
              Safe range: {result.rangeMin}–{result.rangeMax} {result.unit}
            </Text>
          )}
          <View style={[styles.safetyBadge, { backgroundColor: safetyColor }]}>
            <Text style={styles.safetyBadgeText}>{SAFETY_LABELS[result.safetyLevel]}</Text>
          </View>
        </View>

        {renderWarnings(result.warnings, 'Dosage Warnings')}

        {confirmedOverride && (
          <View style={styles.overrideConfirmed}>
            <Text style={styles.overrideConfirmedTitle}>Vet Override Active</Text>
            <Text style={styles.overrideConfirmedText}>
              Override dose: {confirmedOverride.dose} {confirmedOverride.unit}
            </Text>
            <Text style={styles.overrideConfirmedText}>
              Justification: {confirmedOverride.justification}
            </Text>
          </View>
        )}

        {result.safetyLevel !== 'safe' && (
          <TouchableOpacity
            style={styles.overrideBtn}
            onPress={() => {
              setVetOverride({ dose: String(result.dose), unit: result.unit, justification: '' });
              setVetOverrideVisible(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Open vet override dialog"
          >
            <Text style={styles.overrideBtnText}>Vet Override</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderVetOverrideModal = () => (
    <Modal
      visible={vetOverrideVisible}
      animationType="slide"
      transparent
      onRequestClose={() => setVetOverrideVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <ScrollView style={styles.modalContent}>
          <Text style={styles.modalTitle}>Vet Override</Text>
          <Text style={styles.modalSubtitle}>
            Document your clinical justification to override the calculated dose. This action is
            logged for audit purposes.
          </Text>

          <Text style={styles.inputLabel}>Override Dose</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="Dose amount"
            value={vetOverride.dose}
            onChangeText={(v) => setVetOverride((prev) => ({ ...prev, dose: v }))}
            accessibilityLabel="Override dose amount"
          />
          <View style={[styles.chipRow, { marginBottom: 12 }]}>
            {UNIT_OPTIONS.map(({ label, value }) => (
              <TouchableOpacity
                key={value}
                style={[styles.chip, vetOverride.unit === value && styles.chipActive]}
                onPress={() => setVetOverride((prev) => ({ ...prev, unit: value }))}
              >
                <Text
                  style={[styles.chipText, vetOverride.unit === value && styles.chipTextActive]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Clinical Justification *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Provide detailed clinical justification for this dose override..."
            multiline
            numberOfLines={4}
            value={vetOverride.justification}
            onChangeText={(v) => setVetOverride((prev) => ({ ...prev, justification: v }))}
            accessibilityLabel="Clinical justification for dose override"
          />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setVetOverrideVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleVetOverrideSubmit}>
              <Text style={styles.saveBtnText}>Confirm Override</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dosage Calculator</Text>
        <Text style={styles.headerSubtitle}>Weight-based medication dosing</Text>
      </View>

      {renderSpeciesSelector()}
      {renderDrugSelector()}
      {drugWarnings.length > 0 && renderWarnings(drugWarnings, 'Drug Safety Warnings')}
      {renderInputs()}

      <TouchableOpacity
        style={styles.calculateBtn}
        onPress={handleCalculate}
        accessibilityRole="button"
        accessibilityLabel="Calculate dose"
      >
        <Text style={styles.calculateBtnText}>Calculate Dose</Text>
      </TouchableOpacity>

      {renderResult()}
      {renderVetOverrideModal()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  headerSubtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
  },
  chipActive: { borderColor: '#4CAF50', backgroundColor: '#e8f5e9' },
  chipText: { fontSize: 13, color: '#666' },
  chipTextActive: { color: '#2e7d32', fontWeight: '600' },
  drugItem: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 6,
  },
  drugItemActive: { borderColor: '#4CAF50', backgroundColor: '#e8f5e9' },
  drugName: { fontSize: 14, fontWeight: '600', color: '#333' },
  drugNameActive: { color: '#2e7d32' },
  drugClass: { fontSize: 12, color: '#888', marginTop: 2 },
  inputRow: { marginBottom: 10 },
  inputLabel: { fontSize: 13, color: '#555', marginBottom: 4, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fafafa',
  },
  textArea: { height: 90, textAlignVertical: 'top' },
  warningBox: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  warningTitle: { fontSize: 13, fontWeight: '700', color: '#e65100', marginBottom: 6 },
  warningText: { fontSize: 12, color: '#6d4c41', marginBottom: 2, lineHeight: 18 },
  calculateBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  calculateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resultCard: {
    padding: 14,
    borderRadius: 8,
    borderLeftWidth: 4,
    backgroundColor: '#fafafa',
    marginBottom: 10,
  },
  resultDose: { fontSize: 32, fontWeight: '800', color: '#1a1a1a' },
  resultMg: { fontSize: 13, color: '#666', marginTop: 2 },
  resultRange: { fontSize: 12, color: '#888', marginTop: 4 },
  safetyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  safetyBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  overrideConfirmed: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#1565C0',
  },
  overrideConfirmedTitle: { fontSize: 13, fontWeight: '700', color: '#1565C0', marginBottom: 4 },
  overrideConfirmedText: { fontSize: 12, color: '#333', marginBottom: 2 },
  overrideBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1565C0',
    alignItems: 'center',
    marginTop: 4,
  },
  overrideBtnText: { color: '#1565C0', fontWeight: '600', fontSize: 13 },
  emptyText: { fontSize: 13, color: '#999', textAlign: 'center', paddingVertical: 10 },
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
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 18 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
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
    backgroundColor: '#1565C0',
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '600' },
});

export default DosageCalculatorScreen;
