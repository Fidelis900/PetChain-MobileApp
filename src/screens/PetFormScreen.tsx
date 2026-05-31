import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import breedInsightsService from '../services/breedInsightsService';
import petService, { type Pet } from '../services/petService';
import { parseWeightToKg, weightUnit } from '../utils/localeValues';
import { getPhoto, removePhoto, savePhoto } from '../utils/petPhotoStore';

interface Props {
  /** Pass a pet to edit; omit for add mode. */
  pet?: Pet;
  /** ownerId required when creating a new pet. */
  ownerId?: string;
  onBack: () => void;
  onSaved: (pet: Pet) => void;
}

interface FormState {
  name: string;
  species: string;
  breed: string;
  dateOfBirth: string;
  weight: string;
  microchipId: string;
}

const EMPTY: FormState = {
  name: '',
  species: '',
  breed: '',
  dateOfBirth: '',
  weight: '',
  microchipId: '',
};

const PetFormScreen: React.FC<Props> = ({ pet, ownerId = '', onBack, onSaved }) => {
  const isEdit = !!pet;
  const [form, setForm] = useState<FormState>(
    pet
      ? {
          name: pet.name,
          species: pet.species,
          breed: pet.breed ?? '',
          dateOfBirth: pet.dateOfBirth?.slice(0, 10) ?? '',
          weight: pet.weightKg ? pet.weightKg.toString() : '',
          microchipId: pet.microchipId ?? '',
        }
      : EMPTY,
  );
  const [breedOptions, setBreedOptions] = useState<string[]>([]);
  const [breedSuggestions, setBreedSuggestions] = useState<string[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadPhoto = useCallback(async () => {
    if (pet) setPhotoUri(await getPhoto(pet.id));
  }, [pet]);

  useEffect(() => {
    void loadPhoto();
  }, [loadPhoto]);

  useEffect(() => {
    void (async () => {
      try {
        const breeds = await breedInsightsService.getBreedList();
        setBreedOptions(breeds.map((breed) => breed.name));
      } catch {
        setBreedOptions([]);
      }
    })();
  }, []);

  const set = (key: keyof FormState) => (val: string) => setForm((f) => ({ ...f, [key]: val }));

  const updateBreedField = (value: string) => {
    setForm((f) => ({ ...f, breed: value }));
    const normalized = value.trim().toLowerCase();

    if (!normalized) {
      setBreedSuggestions([]);
      return;
    }

    setBreedSuggestions(
      breedOptions.filter((breed) => breed.toLowerCase().includes(normalized)).slice(0, 6),
    );
  };

  const selectBreedSuggestion = (breed: string) => {
    setForm((f) => ({ ...f, breed }));
    setBreedSuggestions([]);
  };

  // ── Photo management ───────────────────────────────────────────────────────
  // Without expo-image-picker installed we prompt for a URI directly.
  // In a real build, replace this with ImagePicker.launchImageLibraryAsync().

  const handlePhotoAction = () => {
    Alert.alert('Pet Photo', 'Enter a photo URL or file URI', [
      {
        text: 'Enter URL',
        onPress: () => {
          Alert.prompt(
            'Photo URL',
            'Paste an image URL:',
            (url) => {
              if (url?.trim()) setPhotoUri(url.trim());
            },
            'plain-text',
          );
        },
      },
      photoUri
        ? {
            text: 'Remove Photo',
            style: 'destructive',
            onPress: () => setPhotoUri(null),
          }
        : { text: 'Cancel', style: 'cancel' },
      ...(!photoUri ? [{ text: 'Cancel', style: 'cancel' as const }] : []),
    ]);
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.name.trim() || !form.species.trim()) {
      Alert.alert('Validation', 'Name and species are required.');
      return;
    }
    setSaving(true);
    try {
      const weightValue = Number(form.weight.trim());
      const payload = {
        name: form.name.trim(),
        species: form.species.trim(),
        breed: form.breed.trim() || undefined,
        dateOfBirth: form.dateOfBirth.trim() || undefined,
        weightKg:
          Number.isFinite(weightValue) && weightValue > 0
            ? parseWeightToKg(weightValue)
            : undefined,
        microchipId: form.microchipId.trim() || undefined,
      };

      let saved: Pet;
      if (isEdit && pet) {
        saved = await petService.updatePet(pet.id, payload);
      } else {
        saved = await petService.createPet({ ...payload, ownerId });
      }

      // Persist photo locally
      if (photoUri) {
        await savePhoto(saved.id, photoUri);
      } else if (isEdit && pet) {
        await removePhoto(pet.id);
      }

      onSaved(saved);
    } catch {
      Alert.alert('Error', 'Failed to save pet. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container} testID="pet-form-screen">
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Pet' : 'Add Pet'}</Text>
        <TouchableOpacity
          onPress={() => void handleSave()}
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={isEdit ? 'Save changes' : 'Save pet'}
          testID="pet-form-save-button"
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Photo */}
        <TouchableOpacity
          style={styles.photoSection}
          onPress={handlePhotoAction}
          accessibilityRole="button"
          accessibilityLabel={photoUri ? 'Change photo' : 'Add photo'}
        >
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.photo}
              accessible
              accessibilityLabel="Pet photo"
            />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Text style={styles.photoEmoji}>🐾</Text>
            </View>
          )}
          <Text style={styles.photoHint}>{photoUri ? 'Change photo' : 'Add photo'}</Text>
        </TouchableOpacity>

        {/* Fields */}
        <View style={styles.formCard}>
          {(
            [
              { key: 'name', label: 'Name *', placeholder: 'e.g. Buddy', keyboardType: 'default' },
              {
                key: 'species',
                label: 'Species *',
                placeholder: 'e.g. Dog, Cat',
                keyboardType: 'default',
              },
              {
                key: 'breed',
                label: 'Breed',
                placeholder: 'e.g. Labrador',
                keyboardType: 'default',
              },
              {
                key: 'weight',
                label: `Weight (${weightUnit()})`,
                placeholder: `e.g. 12.5`,
                keyboardType: 'decimal-pad',
              },
              {
                key: 'dateOfBirth',
                label: 'Date of Birth',
                placeholder: 'YYYY-MM-DD',
                keyboardType: 'default',
              },
              {
                key: 'microchipId',
                label: 'Microchip ID',
                placeholder: 'Optional',
                keyboardType: 'default',
              },
            ] as Array<{
              key: keyof FormState;
              label: string;
              placeholder: string;
              keyboardType: 'default' | 'decimal-pad';
            }>
          ).map(({ key, label, placeholder, keyboardType }) => (
            <View key={key} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{label}</Text>
              <TextInput
                style={styles.input}
                placeholder={placeholder}
                value={form[key]}
                onChangeText={key === 'breed' ? updateBreedField : set(key)}
                keyboardType={keyboardType}
                placeholderTextColor="#bbb"
                accessibilityLabel={label.replace('*', '').trim()}
                returnKeyType="next"
                testID={`pet-${key}-input`}
              />
            </View>
          ))}

          {breedSuggestions.length > 0 && (
            <View style={styles.suggestionsCard}>
              <Text style={styles.suggestionsTitle}>Suggested breeds</Text>
              <View style={styles.suggestionsRow}>
                {breedSuggestions.map((suggestion) => (
                  <TouchableOpacity
                    key={suggestion}
                    onPress={() => selectBreedSuggestion(suggestion)}
                    style={styles.suggestionChip}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${suggestion}`}
                  >
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  saveBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  content: { padding: 16 },
  photoSection: { alignItems: 'center', marginBottom: 20 },
  photo: { width: 100, height: 100, borderRadius: 50, marginBottom: 8 },
  photoPlaceholder: { backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center' },
  photoEmoji: { fontSize: 40 },
  photoHint: { fontSize: 13, color: '#4CAF50', fontWeight: '600' },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  fieldRow: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, color: '#666', marginBottom: 4, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fafafa',
    color: '#1a1a1a',
  },
  suggestionsCard: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f1f8e9',
    borderRadius: 10,
  },
  suggestionsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#33691e',
    marginBottom: 8,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  suggestionChip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#c5e1a5',
    margin: 4,
  },
  suggestionText: {
    color: '#33691e',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default PetFormScreen;
