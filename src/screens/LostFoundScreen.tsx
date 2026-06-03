import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import type { RootStackParamList } from '../navigation/types';
import lostFoundService, { type LostFoundReport, type LostFoundType } from '../services/lostFoundService';
import petService, { type Pet } from '../services/petService';
import mapService, { type Location } from '../services/mapService';
import { pickImage } from '../utils/imageUtils';

const DEFAULT_RADIUS_KM = 25;

const EMPTY_FORM = {
  type: 'lost' as LostFoundType,
  title: '',
  description: '',
  species: '',
  breed: '',
  photoUrl: undefined as string | undefined,
};

const LostFoundScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [reports, setReports] = useState<LostFoundReport[]>([]);
  const [selectedTab, setSelectedTab] = useState<LostFoundType>('lost');
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [matchModalVisible, setMatchModalVisible] = useState(false);
  const [matches, setMatches] = useState<LostFoundReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<LostFoundReport | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [scannedPet, setScannedPet] = useState<Pet | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const coords = location;
      const { reports: fetched } = await lostFoundService.getLostFoundReports({
        type: selectedTab,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        radiusKm: DEFAULT_RADIUS_KM,
      });
      setReports(fetched);
    } catch (err) {
      console.warn('[LostFound] Failed to load reports', err);
      Alert.alert('Unable to load reports', 'Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [location, selectedTab]);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        const current = await mapService.getCurrentLocation();
        if (!active) return;
        setLocation(current);
        await lostFoundService.updateMyLocation(current);
      } catch {
        if (active) {
          Alert.alert(
            'Location required',
            'Lost & Found matching works best when location permission is granted.',
          );
        }
      } finally {
        if (active) void loadReports();
      }
    };

    void initialize();
    return () => {
      active = false;
    };
  }, [loadReports]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const handleSubmitReport = async () => {
    if (!form.title.trim() || !form.species.trim()) {
      Alert.alert('Validation error', 'Title and species are required.');
      return;
    }
    if (!location) {
      Alert.alert('Location missing', 'Please allow location access to post a report.');
      return;
    }

    try {
      await lostFoundService.createLostFoundReport({
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim(),
        species: form.species.trim(),
        breed: form.breed.trim() || undefined,
        photoUrl: form.photoUrl,
        location,
      });
      setCreateModalVisible(false);
      setForm(EMPTY_FORM);
      await loadReports();
    } catch (err) {
      console.warn('[LostFound] Create report error', err);
      Alert.alert('Unable to create report', 'Please try again again later.');
    }
  };

  const handleViewMatches = async (report: LostFoundReport) => {
    try {
      const { reports: fetched } = await lostFoundService.getReportMatches(report.id, DEFAULT_RADIUS_KM);
      setSelectedReport(report);
      setMatches(fetched);
      setMatchModalVisible(true);
    } catch (err) {
      console.warn('[LostFound] Match lookup failed', err);
      Alert.alert('Unable to load matches', 'Try again in a moment.');
    }
  };

  const handlePickPhoto = async () => {
    try {
      const image = await pickImage();
      if (image) {
        setForm((current) => ({ ...current, photoUrl: image.uri }));
      }
    } catch (error) {
      console.warn('[LostFound] Photo picker failed', error);
    }
  };

  const handleScanQr = async (data: string) => {
    try {
      const pet = await petService.getPetByQRCode(data);
      setScannedPet(pet);
      setQrModalVisible(false);
    } catch (error) {
      Alert.alert('Invalid QR Code', 'Unable to resolve this PetChain QR code.');
    }
  };

  const displayedReports = useMemo(
    () => reports,
    [reports],
  );

  const renderReport = ({ item }: { item: LostFoundReport }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardTag}>{item.type === 'lost' ? 'Lost' : 'Found'}</Text>
      </View>
      <Text style={styles.cardMeta}>Species: {item.species}</Text>
      {item.breed ? <Text style={styles.cardMeta}>Breed: {item.breed}</Text> : null}
      <Text style={styles.cardDescription} numberOfLines={3}>{item.description}</Text>
      {item.photoUrl ? <Image source={{ uri: item.photoUrl }} style={styles.cardImage} /> : null}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleViewMatches(item)}>
          <Text style={styles.actionButtonText}>View matches</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Lost & Found Network</Text>
        <TouchableOpacity style={styles.scanButton} onPress={() => setQrModalVisible(true)}>
          <Text style={styles.scanButtonText}>Scan PetChain QR</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.filterRow}>
        {(['lost', 'found'] as LostFoundType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, selectedTab === tab && styles.tabButtonActive]}
            onPress={() => setSelectedTab(tab)}
          >
            <Text style={[styles.tabButtonText, selectedTab === tab && styles.tabButtonTextActive]}>
              {tab === 'lost' ? 'Lost Pets' : 'Found Pets'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.reportSummary}>
        <Text style={styles.summaryText}>{displayedReports.length} reports nearby</Text>
        <TouchableOpacity style={styles.newReportButton} onPress={() => setCreateModalVisible(true)}>
          <Text style={styles.newReportButtonText}>New report</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayedReports}
        renderItem={renderReport}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {loading ? 'Loading reports…' : 'No reports found in your area yet.'}
          </Text>
        }
        contentContainerStyle={styles.listContent}
      />

      <Modal visible={createModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create a report</Text>
            <View style={styles.typeSwitchRow}>
              {(['lost', 'found'] as LostFoundType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeSwitch, form.type === type && styles.typeSwitchActive]}
                  onPress={() => setForm((prev) => ({ ...prev, type }))}
                >
                  <Text style={form.type === type ? styles.typeSwitchTextActive : styles.typeSwitchText}>
                    {type === 'lost' ? 'Lost' : 'Found'} pet
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Title"
              value={form.title}
              onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Species"
              value={form.species}
              onChangeText={(value) => setForm((prev) => ({ ...prev, species: value }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Breed (optional)"
              value={form.breed}
              onChangeText={(value) => setForm((prev) => ({ ...prev, breed: value }))}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description"
              value={form.description}
              onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity style={styles.photoButton} onPress={handlePickPhoto}>
              <Text style={styles.photoButtonText}>Add photo</Text>
            </TouchableOpacity>
            {form.photoUrl ? <Image source={{ uri: form.photoUrl }} style={styles.uploadPreview} /> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setCreateModalVisible(false);
                  setForm(EMPTY_FORM);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleSubmitReport}>
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={matchModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentLarge}>
            <Text style={styles.modalTitle}>Matches for {selectedReport?.title}</Text>
            <FlatList
              data={matches}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardMeta}>Species: {item.species}</Text>
                  <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No matches found yet.</Text>}
            />
            <TouchableOpacity style={styles.closeButton} onPress={() => setMatchModalVisible(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={qrModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentLarge}>
            <Text style={styles.modalTitle}>Scan PetChain QR</Text>
            <Text style={styles.helpText}>Use the app's QR scanner to locate a pet profile.</Text>
            <TouchableOpacity
              style={styles.scanActionButton}
              onPress={() => {
                navigation.navigate('QRScanner', { onScanSuccess: handleScanQr });
                setQrModalVisible(false);
              }}
            >
              <Text style={styles.scanActionText}>Open scanner</Text>
            </TouchableOpacity>
            {scannedPet ? (
              <View style={styles.profileCard}>
                <Text style={styles.cardTitle}>{scannedPet.name}</Text>
                <Text style={styles.cardMeta}>{scannedPet.species}</Text>
                <Text style={styles.cardMeta}>{scannedPet.breed ?? 'Breed unknown'}</Text>
              </View>
            ) : null}
            <TouchableOpacity style={styles.closeButton} onPress={() => setQrModalVisible(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7', paddingHorizontal: 14 },
  topBar: {
    marginTop: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: { fontSize: 22, fontWeight: '700' },
  scanButton: {
    backgroundColor: '#1f2937',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  scanButtonText: { color: '#fff', fontWeight: '600' },
  filterRow: { flexDirection: 'row', marginBottom: 14 },
  tabButton: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 12,
    marginRight: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  tabButtonActive: { backgroundColor: '#111827', borderColor: '#111827' },
  tabButtonText: { color: '#374151', fontWeight: '600' },
  tabButtonTextActive: { color: '#fff' },
  reportSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryText: { color: '#4b5563', fontSize: 14 },
  newReportButton: { backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  newReportButtonText: { color: '#fff', fontWeight: '600' },
  listContent: { paddingBottom: 32 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardTag: { color: '#2563eb', fontWeight: '700' },
  cardMeta: { color: '#4b5563', marginBottom: 4 },
  cardDescription: { color: '#374151', marginBottom: 8 },
  cardImage: { width: '100%', height: 160, borderRadius: 12, marginTop: 8 },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  actionButton: { backgroundColor: '#e0e7ff', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  actionButtonText: { color: '#1d4ed8', fontWeight: '600' },
  emptyText: { marginTop: 24, textAlign: 'center', color: '#6b7280' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 18 },
  modalContentLarge: { backgroundColor: '#fff', borderRadius: 20, padding: 18, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  typeSwitchRow: { flexDirection: 'row', marginBottom: 12 },
  typeSwitch: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', marginRight: 8, alignItems: 'center' },
  typeSwitchActive: { backgroundColor: '#111827', borderColor: '#111827' },
  typeSwitchText: { color: '#374151', fontWeight: '600' },
  typeSwitchTextActive: { color: '#fff', fontWeight: '600' },
  input: { backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 10 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  photoButton: { backgroundColor: '#f3f4f6', borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 12 },
  photoButtonText: { color: '#111827', fontWeight: '600' },
  uploadPreview: { width: '100%', height: 140, borderRadius: 12, marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  cancelButton: { backgroundColor: '#e5e7eb', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  cancelButtonText: { color: '#374151', fontWeight: '700' },
  submitButton: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  submitButtonText: { color: '#fff', fontWeight: '700' },
  closeButton: { marginTop: 12, backgroundColor: '#111827', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  closeButtonText: { color: '#fff', fontWeight: '700' },
  helpText: { color: '#6b7280', marginBottom: 14 },
  scanActionButton: { backgroundColor: '#1d4ed8', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  scanActionText: { color: '#fff', fontWeight: '700' },
  profileCard: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, marginBottom: 16 },
});

export default LostFoundScreen;
/**
 * Lost and Found Network Screen
 * Allows users to report lost/found pets with location and photos
 * Shows matches and broadcasts alerts to nearby users
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

import { Text } from '../components/Text';
import { SafeAreaView } from '../components/SafeAreaView';
import { useTheme } from '../context/ThemeContext';
import type {
  LostFoundReport,
  CreateLostFoundReportInput,
  Location as LocationType,
  LostFoundMatch,
} from '../../backend/models/LostFound';
import {
  createReport,
  getMyReports,
  searchReports,
  getMatches,
  getPreferences,
  updatePreferences,
} from '../services/lostFoundService';
import logger from '../utils/logger';

type TabType = 'my-reports' | 'search' | 'create' | 'preferences';

interface PetInfo {
  species: string;
  breed: string;
  color: string;
  description: string;
  photos: string[];
}

interface LocationInfo {
  latitude: number;
  longitude: number;
  name: string;
}

interface MatchWithReport extends LostFoundMatch {
  report?: LostFoundReport;
}

const { width } = Dimensions.get('window');

export const LostFoundScreen: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const isFocused = useIsFocused();

  // State management
  const [activeTab, setActiveTab] = useState<TabType>('my-reports');
  const [loading, setLoading] = useState(false);
  const [myReports, setMyReports] = useState<LostFoundReport[]>([]);
  const [searchResults, setSearchResults] = useState<LostFoundReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<LostFoundReport | null>(null);
  const [selectedReportMatches, setSelectedReportMatches] = useState<MatchWithReport[]>([]);

  // Create report form state
  const [reportType, setReportType] = useState<'lost' | 'found'>('lost');
  const [petInfo, setPetInfo] = useState<PetInfo>({
    species: '',
    breed: '',
    color: '',
    description: '',
    photos: [],
  });
  const [currentLocation, setCurrentLocation] = useState<LocationInfo | null>(null);
  const [alertRadius, setAlertRadius] = useState('5');

  // Preferences state
  const [preferences, setPreferences] = useState({
    defaultAlertRadiusKm: 5,
    notificationsEnabled: true,
    emailOnMatch: true,
    pushOnMatch: true,
    receiveLostAlerts: true,
    alertSpecies: [] as string[],
  });

  // Search state
  const [searchRadius, setSearchRadius] = useState('5');

  /**
   * Get current location
   */
  const getCurrentLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required');
        return;
      }

      setLoading(true);
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Get address name
      const address = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        name: address[0]?.name || `${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`,
      });
    } catch (error) {
      logger.error('get_location_error', { error });
      Alert.alert('Error', 'Failed to get location');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Pick image from gallery or camera
   */
  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 5,
        quality: 0.7,
      });

      if (!result.cancelled && result.assets) {
        setPetInfo((prev) => ({
          ...prev,
          photos: [...prev.photos, ...result.assets.map((a) => a.uri)],
        }));
      }
    } catch (error) {
      logger.error('pick_image_error', { error });
      Alert.alert('Error', 'Failed to pick image');
    }
  }, []);

  /**
   * Create a new report
   */
  const handleCreateReport = useCallback(async () => {
    try {
      if (!petInfo.species.trim()) {
        Alert.alert('Validation', 'Species is required');
        return;
      }

      if (!currentLocation) {
        Alert.alert('Validation', 'Location is required');
        return;
      }

      setLoading(true);

      const input: CreateLostFoundReportInput = {
        reportType,
        species: petInfo.species,
        breed: petInfo.breed || undefined,
        color: petInfo.color || undefined,
        description: petInfo.description || undefined,
        photoUrls: petInfo.photos,
        location: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          name: currentLocation.name,
        },
        alertRadiusKm: parseInt(alertRadius, 10),
      };

      await createReport(input);

      Alert.alert('Success', `${reportType === 'lost' ? 'Lost' : 'Found'} report created successfully!`);

      // Reset form
      setPetInfo({
        species: '',
        breed: '',
        color: '',
        description: '',
        photos: [],
      });
      setAlertRadius('5');

      // Refresh reports
      loadMyReports();
      setActiveTab('my-reports');
    } catch (error) {
      logger.error('create_report_error', { error });
      Alert.alert('Error', 'Failed to create report');
    } finally {
      setLoading(false);
    }
  }, [petInfo, currentLocation, alertRadius, reportType]);

  /**
   * Load user's reports
   */
  const loadMyReports = useCallback(async () => {
    try {
      setLoading(true);
      const reports = await getMyReports();
      setMyReports(reports);
    } catch (error) {
      logger.error('load_my_reports_error', { error });
      Alert.alert('Error', 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Search reports by location
   */
  const handleSearch = useCallback(async () => {
    try {
      if (!currentLocation) {
        Alert.alert('Validation', 'Location is required');
        return;
      }

      setLoading(true);

      const results = await searchReports({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        radiusKm: parseInt(searchRadius, 10),
      });

      setSearchResults(results);
    } catch (error) {
      logger.error('search_error', { error });
      Alert.alert('Error', 'Failed to search reports');
    } finally {
      setLoading(false);
    }
  }, [currentLocation, searchRadius]);

  /**
   * Load matches for a report
   */
  const loadMatches = useCallback(async (report: LostFoundReport) => {
    try {
      setLoading(true);
      setSelectedReport(report);
      const matches = await getMatches(report.id);
      setSelectedReportMatches(matches);
      setActiveTab('my-reports');
    } catch (error) {
      logger.error('load_matches_error', { error });
      Alert.alert('Error', 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Load preferences
   */
  const loadPreferences = useCallback(async () => {
    try {
      const prefs = await getPreferences();
      setPreferences(prefs);
    } catch (error) {
      logger.error('load_preferences_error', { error });
    }
  }, []);

  /**
   * Update preferences
   */
  const handleUpdatePreferences = useCallback(async () => {
    try {
      setLoading(true);
      await updatePreferences(preferences);
      Alert.alert('Success', 'Preferences updated');
    } catch (error) {
      logger.error('update_preferences_error', { error });
      Alert.alert('Error', 'Failed to update preferences');
    } finally {
      setLoading(false);
    }
  }, [preferences]);

  // Load data on screen focus
  useEffect(() => {
    if (isFocused) {
      loadMyReports();
      loadPreferences();
    }
  }, [isFocused]);

  // Style helpers
  const tabStyle = (tab: TabType) => ({
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: activeTab === tab ? colors.primary : colors.background,
    marginHorizontal: spacing.xs,
  });

  const tabTextStyle = (tab: TabType) => ({
    color: activeTab === tab ? colors.white : colors.text,
    fontWeight: activeTab === tab ? ('bold' as const) : ('normal' as const),
  });

  // Render report card
  const renderReportCard = (report: LostFoundReport) => (
    <TouchableOpacity
      key={report.id}
      style={{
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        marginBottom: spacing.md,
        backgroundColor: colors.cardBackground,
      }}
      onPress={() => loadMatches(report)}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontWeight: 'bold',
              fontSize: 16,
              marginBottom: spacing.xs,
              color: report.reportType === 'lost' ? colors.error : colors.success,
            }}
          >
            {report.reportType === 'lost' ? '🔍 Lost' : '✅ Found'} - {report.species}
          </Text>

          {report.breed && (
            <Text style={{ color: colors.secondaryText, marginBottom: spacing.xs }}>
              Breed: {report.breed}
            </Text>
          )}

          {report.location.name && (
            <Text style={{ color: colors.secondaryText, marginBottom: spacing.xs }}>
              📍 {report.location.name}
            </Text>
          )}

          {report.description && (
            <Text style={{ color: colors.secondaryText, marginBottom: spacing.xs }} numberOfLines={2}>
              {report.description}
            </Text>
          )}

          <Text style={{ color: colors.secondaryText, fontSize: 12, marginTop: spacing.xs }}>
            Posted: {new Date(report.createdAt).toLocaleDateString()}
          </Text>
        </View>

        {report.photoUrls.length > 0 && (
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: radius.md,
              marginLeft: spacing.md,
              backgroundColor: colors.border,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 24 }}>📷</Text>
            <Text style={{ fontSize: 10, color: colors.secondaryText }}>
              {report.photoUrls.length}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.lg }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Lost & Found Network</Text>
        <Text style={{ color: colors.secondaryText, marginTop: spacing.xs }}>
          Help reunite lost pets with their families
        </Text>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ paddingHorizontal: spacing.md, marginBottom: spacing.md }}
      >
        <TouchableOpacity style={tabStyle('my-reports')} onPress={() => setActiveTab('my-reports')}>
          <Text style={tabTextStyle('my-reports')}>My Reports</Text>
        </TouchableOpacity>
        <TouchableOpacity style={tabStyle('search')} onPress={() => setActiveTab('search')}>
          <Text style={tabTextStyle('search')}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity style={tabStyle('create')} onPress={() => setActiveTab('create')}>
          <Text style={tabTextStyle('create')}>Create Report</Text>
        </TouchableOpacity>
        <TouchableOpacity style={tabStyle('preferences')} onPress={() => setActiveTab('preferences')}>
          <Text style={tabTextStyle('preferences')}>Preferences</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={{ flex: 1, paddingHorizontal: spacing.md }}
        contentContainerStyle={{ paddingBottom: spacing.lg }}
      >
        {/* My Reports Tab */}
        {activeTab === 'my-reports' && (
          <View>
            {loading && <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />}

            {selectedReportMatches.length > 0 && (
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: spacing.md }}>
                  Potential Matches
                </Text>
                {selectedReportMatches.map((match) => (
                  <View
                    key={match.id}
                    style={{
                      borderRadius: radius.md,
                      borderWidth: 2,
                      borderColor: colors.success,
                      padding: spacing.md,
                      marginBottom: spacing.md,
                      backgroundColor: colors.successLight,
                    }}
                  >
                    <Text style={{ fontWeight: 'bold', color: colors.success, marginBottom: spacing.xs }}>
                      ⭐ Match Score: {(match.matchScore * 100).toFixed(0)}%
                    </Text>
                    <Text style={{ color: colors.text, marginBottom: spacing.xs }}>
                      {match.matchReason}
                    </Text>
                    {match.locationDistanceKm && (
                      <Text style={{ color: colors.secondaryText }}>
                        Distance: {match.locationDistanceKm.toFixed(2)} km
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {myReports.length > 0 ? (
              myReports.map(renderReportCard)
            ) : (
              <View style={{ alignItems: 'center', marginVertical: spacing.lg }}>
                <Text style={{ color: colors.secondaryText, marginBottom: spacing.md }}>
                  No reports yet
                </Text>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.md,
                    backgroundColor: colors.primary,
                    borderRadius: radius.md,
                  }}
                  onPress={() => setActiveTab('create')}
                >
                  <Text style={{ color: colors.white, fontWeight: 'bold' }}>Create First Report</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <View>
            <TouchableOpacity
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                backgroundColor: colors.primary,
                borderRadius: radius.md,
                marginBottom: spacing.md,
              }}
              onPress={getCurrentLocation}
              disabled={loading}
            >
              <Text style={{ color: colors.white, fontWeight: 'bold', textAlign: 'center' }}>
                {currentLocation ? '📍 Update Location' : '📍 Get Current Location'}
              </Text>
            </TouchableOpacity>

            {currentLocation && (
              <View style={{ marginBottom: spacing.md }}>
                <Text style={{ marginBottom: spacing.xs, fontWeight: 'bold' }}>Search Radius (km):</Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    color: colors.text,
                  }}
                  value={searchRadius}
                  onChangeText={setSearchRadius}
                  keyboardType="number-pad"
                  placeholder="5"
                />
              </View>
            )}

            <TouchableOpacity
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                backgroundColor: colors.primary,
                borderRadius: radius.md,
                marginBottom: spacing.md,
              }}
              onPress={handleSearch}
              disabled={loading || !currentLocation}
            >
              <Text style={{ color: colors.white, fontWeight: 'bold', textAlign: 'center' }}>
                {loading ? 'Searching...' : 'Search Reports'}
              </Text>
            </TouchableOpacity>

            {searchResults.length > 0 && (
              <View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: spacing.md }}>
                  Found {searchResults.length} Reports
                </Text>
                {searchResults.map(renderReportCard)}
              </View>
            )}
          </View>
        )}

        {/* Create Report Tab */}
        {activeTab === 'create' && (
          <View>
            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: spacing.md }}>Report Type:</Text>
            <View style={{ flexDirection: 'row', marginBottom: spacing.md, gap: spacing.md }}>
              {(['lost', 'found'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor:
                      reportType === type ? colors.primary : colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  onPress={() => setReportType(type)}
                >
                  <Text
                    style={{
                      textAlign: 'center',
                      fontWeight: 'bold',
                      color: reportType === type ? colors.white : colors.text,
                    }}
                  >
                    {type === 'lost' ? '🔍 Lost' : '✅ Found'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: spacing.xs }}>
              Species: *
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                color: colors.text,
                marginBottom: spacing.md,
              }}
              value={petInfo.species}
              onChangeText={(val) => setPetInfo({ ...petInfo, species: val })}
              placeholder="e.g., Dog, Cat"
            />

            <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: spacing.xs }}>Breed:</Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                color: colors.text,
                marginBottom: spacing.md,
              }}
              value={petInfo.breed}
              onChangeText={(val) => setPetInfo({ ...petInfo, breed: val })}
              placeholder="e.g., Golden Retriever"
            />

            <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: spacing.xs }}>Color:</Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                color: colors.text,
                marginBottom: spacing.md,
              }}
              value={petInfo.color}
              onChangeText={(val) => setPetInfo({ ...petInfo, color: val })}
              placeholder="e.g., Brown and white"
            />

            <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: spacing.xs }}>Description:</Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                color: colors.text,
                marginBottom: spacing.md,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
              value={petInfo.description}
              onChangeText={(val) => setPetInfo({ ...petInfo, description: val })}
              placeholder="Describe distinguishing features, collar, tags, etc."
              multiline
            />

            <TouchableOpacity
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                backgroundColor: colors.secondary,
                borderRadius: radius.md,
                marginBottom: spacing.md,
              }}
              onPress={pickImage}
            >
              <Text style={{ color: colors.white, fontWeight: 'bold', textAlign: 'center' }}>
                📸 Add Photos ({petInfo.photos.length}/5)
              </Text>
            </TouchableOpacity>

            <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: spacing.xs }}>
              Alert Radius (km):
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                color: colors.text,
                marginBottom: spacing.md,
              }}
              value={alertRadius}
              onChangeText={setAlertRadius}
              keyboardType="number-pad"
              placeholder="5"
            />

            <TouchableOpacity
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                backgroundColor: colors.primary,
                borderRadius: radius.md,
                marginBottom: spacing.md,
              }}
              onPress={getCurrentLocation}
              disabled={loading}
            >
              <Text style={{ color: colors.white, fontWeight: 'bold', textAlign: 'center' }}>
                {currentLocation ? '📍 Update Location' : '📍 Get Current Location'}
              </Text>
            </TouchableOpacity>

            {currentLocation && (
              <Text style={{ color: colors.success, marginBottom: spacing.md }}>
                ✓ Location set: {currentLocation.name}
              </Text>
            )}

            <TouchableOpacity
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                backgroundColor: colors.primary,
                borderRadius: radius.md,
              }}
              onPress={handleCreateReport}
              disabled={loading}
            >
              <Text style={{ color: colors.white, fontWeight: 'bold', textAlign: 'center' }}>
                {loading ? 'Creating...' : 'Create Report'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <View>
            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: spacing.md }}>
              Default Alert Radius (km):
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                color: colors.text,
                marginBottom: spacing.md,
              }}
              value={String(preferences.defaultAlertRadiusKm)}
              onChangeText={(val) =>
                setPreferences({ ...preferences, defaultAlertRadiusKm: parseInt(val, 10) })
              }
              keyboardType="number-pad"
            />

            <View style={{ marginBottom: spacing.md }}>
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: spacing.md,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
                onPress={() =>
                  setPreferences({ ...preferences, notificationsEnabled: !preferences.notificationsEnabled })
                }
              >
                <Text>Enable Notifications</Text>
                <Ionicons
                  name={preferences.notificationsEnabled ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={24}
                  color={preferences.notificationsEnabled ? colors.success : colors.border}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: spacing.md,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
                onPress={() => setPreferences({ ...preferences, emailOnMatch: !preferences.emailOnMatch })}
              >
                <Text>Email on Match</Text>
                <Ionicons
                  name={preferences.emailOnMatch ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={24}
                  color={preferences.emailOnMatch ? colors.success : colors.border}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: spacing.md,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
                onPress={() => setPreferences({ ...preferences, pushOnMatch: !preferences.pushOnMatch })}
              >
                <Text>Push Notification on Match</Text>
                <Ionicons
                  name={preferences.pushOnMatch ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={24}
                  color={preferences.pushOnMatch ? colors.success : colors.border}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: spacing.md,
                }}
                onPress={() =>
                  setPreferences({ ...preferences, receiveLostAlerts: !preferences.receiveLostAlerts })
                }
              >
                <Text>Receive Lost Pet Alerts</Text>
                <Ionicons
                  name={preferences.receiveLostAlerts ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={24}
                  color={preferences.receiveLostAlerts ? colors.success : colors.border}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                backgroundColor: colors.primary,
                borderRadius: radius.md,
              }}
              onPress={handleUpdatePreferences}
              disabled={loading}
            >
              <Text style={{ color: colors.white, fontWeight: 'bold', textAlign: 'center' }}>
                {loading ? 'Saving...' : 'Save Preferences'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default LostFoundScreen;