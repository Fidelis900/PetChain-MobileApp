import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  onNext: () => void;
  onSkip: () => void;
  isLast?: boolean;
}

const FEATURES = [
  {
    emoji: '🔗',
    title: 'Immutable Records',
    desc: 'Medical history stored on Stellar blockchain — tamper-proof forever.',
  },
  {
    emoji: '✅',
    title: 'Instant Verification',
    desc: "Vets can verify your pet's records with a single QR scan.",
  },
  {
    emoji: '🌐',
    title: 'Works Offline',
    desc: 'Full access to records even without an internet connection.',
  },
];

const BlockchainIntroStep: React.FC<Props> = ({ onNext, onSkip, isLast = false }) => (
  <View style={styles.container}>
    <Text style={styles.emoji}>⛓️</Text>
    <Text style={styles.title}>Powered by Blockchain</Text>
    <Text style={styles.subtitle}>
      PetChain uses the Stellar network to give your pet's records permanent, verifiable proof.
    </Text>

    <View style={styles.features}>
      {FEATURES.map(({ emoji, title, desc }) => (
        <View key={title} style={styles.featureRow}>
          <Text style={styles.featureEmoji}>{emoji}</Text>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>{title}</Text>
            <Text style={styles.featureDesc}>{desc}</Text>
          </View>
        </View>
      ))}
    </View>

    <TouchableOpacity
      style={[styles.primary, isLast && styles.primaryGreen]}
      onPress={onNext}
      accessibilityRole="button"
    >
      <Text style={styles.primaryText}>{isLast ? "Let's Go! 🎉" : 'Continue'}</Text>
    </TouchableOpacity>
    {!isLast && (
      <TouchableOpacity onPress={onSkip} accessibilityRole="button">
        <Text style={styles.skip}>Skip</Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emoji: { fontSize: 72, marginBottom: 16 },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  features: { width: '100%', marginBottom: 36 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
  featureEmoji: { fontSize: 24, marginRight: 14, marginTop: 2 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: '600', color: '#1F2937', marginBottom: 2 },
  featureDesc: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  primary: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  primaryGreen: { backgroundColor: '#10B981' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  skip: { color: '#6B7280', fontSize: 15 },
});

export default BlockchainIntroStep;
