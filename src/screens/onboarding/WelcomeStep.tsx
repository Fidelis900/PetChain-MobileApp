import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  onNext: () => void;
  onSkip: () => void;
}

const WelcomeStep: React.FC<Props> = ({ onNext, onSkip }) => (
  <View style={styles.container}>
    <Text style={styles.emoji}>🐾</Text>
    <Text style={styles.title}>Welcome to PetChain</Text>
    <Text style={styles.subtitle}>
      Secure, blockchain-verified health records for your beloved pets.
    </Text>
    <Text style={styles.body}>
      Manage medications, appointments, and emergency contacts — all in one place.
    </Text>
    <TouchableOpacity style={styles.primary} onPress={onNext} accessibilityRole="button">
      <Text style={styles.primaryText}>Get Started</Text>
    </TouchableOpacity>
    <TouchableOpacity onPress={onSkip} accessibilityRole="button">
      <Text style={styles.skip}>Skip for now</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emoji: { fontSize: 96, marginBottom: 24 },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 17,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  body: { fontSize: 15, color: '#4B5563', textAlign: 'center', lineHeight: 22, marginBottom: 40 },
  primary: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    marginBottom: 16,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  skip: { color: '#6B7280', fontSize: 15 },
});

export default WelcomeStep;
