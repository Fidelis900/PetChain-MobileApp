/**
 * VetMapScreen.tsx
 *
 * Offline-capable map showing nearby vet clinics, emergency animal hospitals,
 * and pet pharmacies.
 *
 * Features:
 *  - react-native-maps MapView with URL-tile overlay (OpenStreetMap tiles)
 *  - Cached POI data via mapService (AsyncStorage)
 *  - Real-time distance + estimated travel time per marker
 *  - Filter bar: All | General | Emergency | Specialist | Pharmacy
 *  - Offline banner when the device has no connectivity
 *  - Bottom sheet clinic detail card with Call + Navigate + Book Appointment actions
 *  - Next 3 available slots fetched from appointmentService on pin tap
 *  - Integrates with native maps for turn-by-turn navigation
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Callout, Marker, UrlTile, type Region } from 'react-native-maps';

import { getAvailability } from '../services/appointmentService';
import mapService, { type ClinicType, type Location, type VetClinic } from '../services/mapService';
import { networkMonitor } from '../utils/networkMonitor';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const FILTER_OPTIONS: { label: string; value: ClinicType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'General', value: 'general' },
  { label: 'Emergency', value: 'emergency' },
  { label: 'Specialist', value: 'specialist' },
  { label: 'Pharmacy', value: 'pharmacy' },
];

const TYPE_COLORS: Record<ClinicType, string> = {
  general: '#4CAF50',
  emergency: '#e53e3e',
  specialist: '#3182ce',
  pharmacy: '#d69e2e',
};

const TYPE_ICONS: Record<ClinicType, string> = {
  general: '🏥',
  emergency: '🚨',
  specialist: '🔬',
  pharmacy: '💊',
};

const DEFAULT_DELTA = 0.05;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  onBookAppointment?: (vetName: string, date: string, time: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ─── Component ────────────────────────────────────────────────────────────────

const VetMapScreen: React.FC<Props> = ({ onBookAppointment }) => {
  const mapRef = useRef<MapView>(null);

  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [clinics, setClinics] = useState<VetClinic[]>([]);
  const [selectedClinic, setSelectedClinic] = useState<VetClinic | null>(null);
  const [activeFilter, setActiveFilter] = useState<ClinicType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  // Availability slots for selected clinic
  const [sheetSlots, setSheetSlots] = useState<{ date: string; time: string }[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Bottom sheet slide-up animation
  const sheetAnim = useRef(new Animated.Value(0)).current;

  // ── Network status ──────────────────────────────────────────────────────────

  useEffect(() => {
    const unsubscribe = networkMonitor.onNetworkChange((online) => {
      setIsOffline(!online);
      if (online && userLocation) {
        void mapService.syncClinics().then(() => loadClinics(userLocation, activeFilter));
      }
    });

    networkMonitor.isOnline().then((online) => setIsOffline(!online));

    return () => unsubscribe();
  }, [userLocation, activeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Initial load ────────────────────────────────────────────────────────────

  useEffect(() => {
    void bootstrap();
  }, []);

  const bootstrap = async () => {
    setLoading(true);
    try {
      void mapService.initialSync();

      const location = await mapService.getCurrentLocation();
      setUserLocation(location);
      await loadClinics(location, 'all');

      const state = await mapService.getState();
      setLastSyncAt(state.lastSyncAt);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load map.';
      Alert.alert('Map Error', msg);
      const cached = await mapService.getCachedClinics();
      setClinics(cached);
    } finally {
      setLoading(false);
    }
  };

  // ── Load / filter clinics ───────────────────────────────────────────────────

  const loadClinics = useCallback(async (location: Location, filter: ClinicType | 'all') => {
    const types: ClinicType[] = filter === 'all' ? [] : [filter];
    const results = await mapService.getNearbyClinics(
      location.latitude,
      location.longitude,
      15,
      types,
    );
    setClinics(results);
  }, []);

  const handleFilterChange = async (filter: ClinicType | 'all') => {
    setActiveFilter(filter);
    if (userLocation) {
      await loadClinics(userLocation, filter);
    }
  };

  // ── Availability slots ──────────────────────────────────────────────────────

  const loadClinicSlots = async (clinic: VetClinic) => {
    setSlotsLoading(true);
    setSheetSlots([]);
    try {
      const [today, tomorrow] = await Promise.allSettled([
        getAvailability(clinic.id, todayStr()),
        getAvailability(clinic.id, tomorrowStr()),
      ]);

      const combined: { date: string; time: string }[] = [];
      if (today.status === 'fulfilled') {
        combined.push(
          ...today.value.availableSlots.map((t) => ({ date: today.value.date, time: t })),
        );
      }
      if (tomorrow.status === 'fulfilled') {
        combined.push(
          ...tomorrow.value.availableSlots.map((t) => ({ date: tomorrow.value.date, time: t })),
        );
      }
      setSheetSlots(combined.slice(0, 3));
    } catch {
      setSheetSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  // ── Map interactions ────────────────────────────────────────────────────────

  const handleMarkerPress = (clinic: VetClinic) => {
    setSelectedClinic(clinic);
    animateSheet(true);
    void loadClinicSlots(clinic);
  };

  const handleMapPress = () => {
    if (selectedClinic) {
      setSelectedClinic(null);
      animateSheet(false);
    }
  };

  const animateSheet = (show: boolean) => {
    Animated.spring(sheetAnim, {
      toValue: show ? 1 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const recenterMap = async () => {
    setLocationLoading(true);
    try {
      const location = await mapService.getCurrentLocation();
      setUserLocation(location);
      mapRef.current?.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: DEFAULT_DELTA,
          longitudeDelta: DEFAULT_DELTA,
        },
        600,
      );
      await loadClinics(location, activeFilter);
    } catch {
      Alert.alert('Location Error', 'Could not get your current location.');
    } finally {
      setLocationLoading(false);
    }
  };

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleCall = (clinic: VetClinic) => {
    mapService.callClinic(clinic.phoneNumber);
  };

  const handleNavigate = (clinic: VetClinic) => {
    mapService.navigateToClinic(clinic);
  };

  const handleBookSlot = (clinic: VetClinic, date: string, time: string) => {
    if (onBookAppointment) {
      setSelectedClinic(null);
      animateSheet(false);
      onBookAppointment(clinic.name, date, time);
    } else {
      Alert.alert('Book Appointment', `Book with ${clinic.name} on ${date} at ${time}?`, [
        { text: 'OK' },
      ]);
    }
  };

  const handleBookPress = (clinic: VetClinic) => {
    if (sheetSlots.length === 0) {
      if (onBookAppointment) {
        setSelectedClinic(null);
        animateSheet(false);
        onBookAppointment(clinic.name, todayStr(), '');
      }
    }
  };

  // ── Derived region ──────────────────────────────────────────────────────────

  const initialRegion: Region | undefined = userLocation
    ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: DEFAULT_DELTA,
        longitudeDelta: DEFAULT_DELTA,
      }
    : undefined;

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderMarker = (clinic: VetClinic) => {
    const color = TYPE_COLORS[clinic.type];
    const icon = TYPE_ICONS[clinic.type];

    return (
      <Marker
        key={clinic.id}
        coordinate={{ latitude: clinic.latitude, longitude: clinic.longitude }}
        onPress={() => handleMarkerPress(clinic)}
        pinColor={color}
        accessibilityLabel={`${clinic.name} marker`}
      >
        <View style={[styles.markerContainer, { borderColor: color }]}>
          <Text style={styles.markerIcon}>{icon}</Text>
        </View>
        <Callout tooltip>
          <View style={styles.callout}>
            <Text style={styles.calloutName}>{clinic.name}</Text>
            {clinic.distance !== undefined && (
              <Text style={styles.calloutMeta}>{clinic.distance.toFixed(1)} km away</Text>
            )}
          </View>
        </Callout>
      </Marker>
    );
  };

  const renderFilterChip = (option: (typeof FILTER_OPTIONS)[number]) => {
    const active = activeFilter === option.value;
    return (
      <TouchableOpacity
        key={option.value}
        style={[styles.filterChip, active && styles.filterChipActive]}
        onPress={() => handleFilterChange(option.value)}
        accessibilityLabel={`Filter by ${option.label}`}
        accessibilityState={{ selected: active }}
      >
        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
          {option.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderSlot = (slot: { date: string; time: string }, clinic: VetClinic) => (
    <TouchableOpacity
      key={`${slot.date}-${slot.time}`}
      style={styles.slotChip}
      onPress={() => handleBookSlot(clinic, slot.date, slot.time)}
      accessibilityLabel={`Book slot ${slot.date} at ${slot.time}`}
    >
      <Text style={styles.slotDate}>
        {new Date(slot.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
      </Text>
      <Text style={styles.slotTime}>{slot.time}</Text>
    </TouchableOpacity>
  );

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading nearby clinics…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Offline banner ── */}
      {isOffline && (
        <View style={styles.offlineBanner} accessibilityLiveRegion="polite">
          <Text style={styles.offlineBannerText}>
            📡 Offline — showing cached data
            {lastSyncAt ? ` (synced ${new Date(lastSyncAt).toLocaleDateString()})` : ''}
          </Text>
        </View>
      )}

      {/* ── Map ── */}
      {initialRegion ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton={false}
          onPress={handleMapPress}
          accessibilityLabel="Vet clinic map"
        >
          <UrlTile urlTemplate={OSM_TILE_URL} maximumZ={19} flipY={false} offlineMode={isOffline} />
          {clinics.map(renderMarker)}
        </MapView>
      ) : (
        <View style={styles.noLocationContainer}>
          <Text style={styles.noLocationText}>
            📍 Location unavailable — showing cached clinics below
          </Text>
        </View>
      )}

      {/* ── Filter bar ── */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTER_OPTIONS.map(renderFilterChip)}
        </ScrollView>
      </View>

      {/* ── Recenter button ── */}
      <TouchableOpacity
        style={styles.recenterBtn}
        onPress={recenterMap}
        accessibilityLabel="Recenter map to my location"
      >
        {locationLoading ? (
          <ActivityIndicator size="small" color="#4CAF50" />
        ) : (
          <Text style={styles.recenterIcon}>📍</Text>
        )}
      </TouchableOpacity>

      {/* ── Clinic count badge ── */}
      <View style={styles.countBadge}>
        <Text style={styles.countBadgeText}>
          {clinics.length} clinic{clinics.length !== 1 ? 's' : ''} nearby
        </Text>
      </View>

      {/* ── Bottom sheet — selected clinic detail ── */}
      {selectedClinic && (
        <Animated.View
          style={[styles.bottomSheet, { transform: [{ translateY: sheetTranslateY }] }]}
          accessibilityViewIsModal
        >
          {/* Drag handle */}
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTypeIcon}>{TYPE_ICONS[selectedClinic.type]}</Text>
              <View style={styles.sheetTitleBlock}>
                <Text style={styles.sheetName} numberOfLines={2}>
                  {selectedClinic.name}
                </Text>
                <View style={styles.sheetBadgeRow}>
                  <View
                    style={[
                      styles.typeBadge,
                      { backgroundColor: TYPE_COLORS[selectedClinic.type] + '22' },
                    ]}
                  >
                    <Text
                      style={[styles.typeBadgeText, { color: TYPE_COLORS[selectedClinic.type] }]}
                    >
                      {selectedClinic.type}
                    </Text>
                  </View>
                  {selectedClinic.available24h && (
                    <View style={styles.badge24h}>
                      <Text style={styles.badge24hText}>24h</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                setSelectedClinic(null);
                animateSheet(false);
              }}
              style={styles.sheetCloseBtn}
              accessibilityLabel="Close clinic detail"
            >
              <Text style={styles.sheetCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sheetAddress}>{selectedClinic.address}</Text>

          {/* Distance + ETA row */}
          {selectedClinic.distance !== undefined && (
            <View style={styles.sheetMetaRow}>
              <View style={styles.sheetMetaItem}>
                <Text style={styles.sheetMetaLabel}>Distance</Text>
                <Text style={styles.sheetMetaValue}>{selectedClinic.distance.toFixed(1)} km</Text>
              </View>
              {selectedClinic.estimatedTravelMinutes !== undefined && (
                <View style={styles.sheetMetaItem}>
                  <Text style={styles.sheetMetaLabel}>Est. travel</Text>
                  <Text style={styles.sheetMetaValue}>
                    {selectedClinic.estimatedTravelMinutes} min
                  </Text>
                </View>
              )}
              {selectedClinic.rating !== undefined && (
                <View style={styles.sheetMetaItem}>
                  <Text style={styles.sheetMetaLabel}>Rating</Text>
                  <Text style={styles.sheetMetaValue}>⭐ {selectedClinic.rating}</Text>
                </View>
              )}
            </View>
          )}

          {/* Available slots */}
          <View style={styles.slotsSection}>
            <Text style={styles.slotsSectionTitle}>Next available</Text>
            {slotsLoading ? (
              <ActivityIndicator size="small" color="#4CAF50" style={{ marginVertical: 8 }} />
            ) : sheetSlots.length > 0 ? (
              <View style={styles.slotsRow}>
                {sheetSlots.map((slot) => renderSlot(slot, selectedClinic))}
              </View>
            ) : (
              <Text style={styles.noSlotsText}>No upcoming slots available</Text>
            )}
          </View>

          {/* Action buttons */}
          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={[styles.sheetActionBtn, styles.callActionBtn]}
              onPress={() => handleCall(selectedClinic)}
              accessibilityLabel={`Call ${selectedClinic.name}`}
            >
              <Text style={styles.sheetActionIcon}>📞</Text>
              <Text style={styles.sheetActionText}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetActionBtn, styles.navActionBtn]}
              onPress={() => handleNavigate(selectedClinic)}
              accessibilityLabel={`Navigate to ${selectedClinic.name}`}
            >
              <Text style={styles.sheetActionIcon}>🗺️</Text>
              <Text style={[styles.sheetActionText, styles.navActionText]}>Directions</Text>
            </TouchableOpacity>
          </View>

          {/* Book appointment button */}
          <TouchableOpacity
            style={styles.bookBtn}
            onPress={() => handleBookPress(selectedClinic)}
            accessibilityLabel={`Book appointment at ${selectedClinic.name}`}
          >
            <Text style={styles.bookBtnText}>📅 Book Appointment</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Fallback list when no map location ── */}
      {!initialRegion && clinics.length > 0 && (
        <View style={styles.fallbackList}>
          <Text style={styles.fallbackListTitle}>Cached Clinics</Text>
          <FlatList
            data={clinics}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.fallbackCard}>
                <Text style={styles.fallbackCardName}>
                  {TYPE_ICONS[item.type]} {item.name}
                </Text>
                <Text style={styles.fallbackCardSub}>{item.address}</Text>
                <View style={styles.fallbackCardActions}>
                  <TouchableOpacity
                    onPress={() => handleCall(item)}
                    style={styles.fallbackActionBtn}
                    accessibilityLabel={`Call ${item.name}`}
                  >
                    <Text style={styles.fallbackActionText}>📞 Call</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleNavigate(item)}
                    style={styles.fallbackActionBtn}
                    accessibilityLabel={`Navigate to ${item.name}`}
                  >
                    <Text style={styles.fallbackActionText}>🗺️ Directions</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (onBookAppointment) onBookAppointment(item.name, todayStr(), '');
                    }}
                    style={[styles.fallbackActionBtn, styles.fallbackBookBtn]}
                    accessibilityLabel={`Book appointment at ${item.name}`}
                  >
                    <Text style={styles.fallbackBookText}>📅 Book</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        </View>
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15, color: '#666' },

  // Offline banner
  offlineBanner: {
    backgroundColor: '#744210',
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  offlineBannerText: { color: '#fefcbf', fontSize: 13, textAlign: 'center' },

  // Map
  map: { flex: 1 },

  // No location fallback
  noLocationContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    margin: 16,
    borderRadius: 12,
  },
  noLocationText: { fontSize: 14, color: '#555', textAlign: 'center', paddingHorizontal: 24 },

  // Marker
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 4 },
    }),
  },
  markerIcon: { fontSize: 18 },

  // Callout
  callout: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    minWidth: 140,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 4 },
    }),
  },
  calloutName: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  calloutMeta: { fontSize: 11, color: '#666', marginTop: 2 },

  // Filter bar
  filterBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 12,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  filterScroll: { paddingHorizontal: 12, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  filterChipActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  filterChipText: { fontSize: 13, color: '#444', fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },

  // Recenter button
  recenterBtn: {
    position: 'absolute',
    bottom: 220,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 4 },
    }),
  },
  recenterIcon: { fontSize: 22 },

  // Count badge
  countBadge: {
    position: 'absolute',
    bottom: 220,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 5,
  },
  countBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Bottom sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    zIndex: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -4 },
      },
      android: { elevation: 12 },
    }),
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  sheetTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sheetTypeIcon: { fontSize: 28, marginTop: 2 },
  sheetTitleBlock: { flex: 1 },
  sheetName: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  sheetBadgeRow: { flexDirection: 'row', gap: 6 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  typeBadgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  badge24h: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badge24hText: { fontSize: 11, fontWeight: '600', color: '#4CAF50' },
  sheetCloseBtn: { padding: 4 },
  sheetCloseText: { fontSize: 16, color: '#999' },
  sheetAddress: { fontSize: 13, color: '#666', marginBottom: 12 },
  sheetMetaRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  sheetMetaItem: { alignItems: 'center' },
  sheetMetaLabel: { fontSize: 11, color: '#999', marginBottom: 2 },
  sheetMetaValue: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },

  // Slots
  slotsSection: { marginBottom: 12 },
  slotsSectionTitle: { fontSize: 12, color: '#999', fontWeight: '600', marginBottom: 8 },
  slotsRow: { flexDirection: 'row', gap: 8 },
  slotChip: {
    flex: 1,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  slotDate: { fontSize: 11, color: '#2d6a4f', fontWeight: '600' },
  slotTime: { fontSize: 13, color: '#1a1a1a', fontWeight: '700' },
  noSlotsText: { fontSize: 12, color: '#999' },

  sheetActions: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  sheetActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    gap: 6,
  },
  callActionBtn: { backgroundColor: '#e8f5e9', borderWidth: 1, borderColor: '#c6f6d5' },
  navActionBtn: { backgroundColor: '#4CAF50' },
  sheetActionIcon: { fontSize: 16 },
  sheetActionText: { fontSize: 14, fontWeight: '600', color: '#2d6a4f' },
  navActionText: { color: '#fff' },

  // Book button
  bookBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Fallback list (no map)
  fallbackList: { flex: 1, padding: 16 },
  fallbackListTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  fallbackCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  fallbackCardName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  fallbackCardSub: { fontSize: 13, color: '#666', marginBottom: 10 },
  fallbackCardActions: { flexDirection: 'row', gap: 10 },
  fallbackActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#c6f6d5',
  },
  fallbackActionText: { fontSize: 13, color: '#2d6a4f', fontWeight: '600' },
  fallbackBookBtn: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  fallbackBookText: { fontSize: 13, color: '#1D4ED8', fontWeight: '600' },
});

// Suppress unused import warning — SCREEN_WIDTH is available for responsive calculations
void SCREEN_WIDTH;

export default VetMapScreen;
