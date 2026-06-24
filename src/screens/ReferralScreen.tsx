import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  applyReferralCode,
  getReferralStats,
  type ReferralStats,
} from '../services/referralService';
import { useSecureScreen } from '../utils/secureScreen';

const ReferralScreen: React.FC = () => {
  useSecureScreen();

  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadStats = useCallback(async () => {
    const next = await getReferralStats();
    setStats(next);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadStats();
      } catch (error) {
        Alert.alert(
          'Referrals unavailable',
          error instanceof Error ? error.message : 'Unable to load referral stats.',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [loadStats]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadStats();
    } finally {
      setRefreshing(false);
    }
  };

  const shareCode = async () => {
    if (!stats?.code) return;
    await Share.share({
      title: 'Join PetChain',
      message: `Use my PetChain referral code ${stats.code} and create your first pet record.`,
    });
  };

  const submitCode = async () => {
    if (!codeInput.trim()) {
      Alert.alert('Referral code', 'Enter a referral code first.');
      return;
    }

    setSubmitting(true);
    try {
      await applyReferralCode(codeInput.trim());
      setCodeInput('');
      await loadStats();
      Alert.alert('Referral applied', 'Your referral code was saved.');
    } catch (error) {
      Alert.alert(
        'Referral not applied',
        error instanceof Error ? error.message : 'Unable to apply this referral code.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#4CAF50" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <Text style={styles.heading}>Referrals</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Your code</Text>
        <Text style={styles.code}>{stats?.code ?? 'Unavailable'}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => void shareCode()}>
          <Text style={styles.primaryButtonText}>Share Code</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statBox, styles.statBoxSpacing]}>
          <Text style={styles.statValue}>{stats?.successfulConversions ?? 0}</Text>
          <Text style={styles.statLabel}>Converted</Text>
        </View>
        <View style={[styles.statBox, styles.statBoxSpacing]}>
          <Text style={styles.statValue}>{stats?.pendingConversions ?? 0}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats?.availablePremiumDays ?? 0}</Text>
          <Text style={styles.statLabel}>Premium days</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Apply a Code</Text>
        <TextInput
          style={styles.input}
          placeholder="Referral code"
          autoCapitalize="characters"
          value={codeInput}
          onChangeText={setCodeInput}
        />
        <TouchableOpacity
          style={[styles.secondaryButton, submitting && styles.disabledButton]}
          onPress={() => void submitCode()}
          disabled={submitting}
        >
          <Text style={styles.secondaryButtonText}>
            {submitting ? 'Applying...' : 'Apply Code'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Recent Referrals</Text>
        {stats?.referrals.length ? (
          stats.referrals.slice(0, 6).map((referral) => (
            <View key={referral.id} style={styles.referralRow}>
              <View>
                <Text style={styles.referralStatus}>{referral.status}</Text>
                <Text style={styles.referralDate}>
                  {new Date(referral.signupAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.referralId}>{referral.referredUserId}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No referrals yet.</Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 18, paddingBottom: 36 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16, color: '#111' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#eee',
  },
  label: { color: '#666', fontSize: 13, marginBottom: 6 },
  code: { color: '#111', fontSize: 28, fontWeight: '800', letterSpacing: 0, marginBottom: 14 },
  primaryButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  statsGrid: { flexDirection: 'row', marginBottom: 14 },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 12,
  },
  statBoxSpacing: { marginRight: 10 },
  statValue: { color: '#111', fontWeight: '800', fontSize: 22, marginBottom: 2 },
  statLabel: { color: '#666', fontSize: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10, color: '#333' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  disabledButton: { opacity: 0.6 },
  secondaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  referralRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  referralStatus: { color: '#111', fontWeight: '700', textTransform: 'capitalize' },
  referralDate: { color: '#777', fontSize: 12, marginTop: 2 },
  referralId: { color: '#555', fontSize: 12, maxWidth: '55%' },
  emptyText: { color: '#666', fontSize: 14 },
});

export default ReferralScreen;
