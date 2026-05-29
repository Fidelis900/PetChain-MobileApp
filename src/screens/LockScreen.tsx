import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';

import { authenticateWithBiometric, verifyPin } from '../services/authService';

interface LockScreenProps {
  onUnlock: () => void;
  showPinFallback?: boolean;
}

export default function LockScreen({ onUnlock, showPinFallback = false }: LockScreenProps) {
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState<'biometric' | 'pin'>(showPinFallback ? 'pin' : 'biometric');
  const [loading, setLoading] = useState(false);

  const handleBiometric = useCallback(async () => {
    setLoading(true);
    try {
      const ok = await authenticateWithBiometric();
      if (ok) {
        onUnlock();
      } else {
        setMode('pin');
      }
    } catch {
      setMode('pin');
    } finally {
      setLoading(false);
    }
  }, [onUnlock]);

  useEffect(() => {
    if (mode === 'biometric') void handleBiometric();
  }, [mode, handleBiometric]);

  const handlePinDigit = useCallback(
    async (digit: string) => {
      const next = pin + digit;
      setPin(next);
      if (next.length === 6) {
        setLoading(true);
        try {
          const ok = await verifyPin(next);
          if (ok) {
            onUnlock();
          } else {
            Alert.alert('Incorrect PIN', 'Please try again.');
            setPin('');
          }
        } finally {
          setLoading(false);
        }
      }
    },
    [pin, onUnlock],
  );

  const handleDelete = useCallback(() => setPin((p) => p.slice(0, -1)), []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔒 PetChain</Text>
      <Text style={styles.subtitle}>
        {mode === 'biometric' ? 'Authenticating…' : 'Enter your 6-digit PIN'}
      </Text>

      {mode === 'pin' && (
        <>
          <View style={styles.dotsRow}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
            ))}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#4A90E2" style={styles.loader} />
          ) : (
            <View style={styles.numpad}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.key, !key && styles.keyEmpty]}
                  onPress={() => {
                    if (!key) return;
                    if (key === '⌫') handleDelete();
                    else void handlePinDigit(key);
                  }}
                  disabled={!key}
                  accessibilityLabel={key === '⌫' ? 'delete' : key || undefined}
                >
                  <Text style={styles.keyText}>{key}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.biometricBtn}
            onPress={() => setMode('biometric')}
            accessibilityLabel="Use biometric authentication"
          >
            <Text style={styles.biometricText}>Use Face ID / Fingerprint</Text>
          </TouchableOpacity>
        </>
      )}

      {mode === 'biometric' && (
        <ActivityIndicator size="large" color="#4A90E2" style={styles.loader} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: { fontSize: 32, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#A0A0B0', marginBottom: 40 },
  dotsRow: { flexDirection: 'row', gap: 16, marginBottom: 40 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4A90E2',
    backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: '#4A90E2' },
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 240,
    gap: 16,
    justifyContent: 'center',
  },
  key: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2A2A4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyEmpty: { backgroundColor: 'transparent' },
  keyText: { fontSize: 22, color: '#FFFFFF', fontWeight: '500' },
  loader: { marginTop: 24 },
  biometricBtn: { marginTop: 32 },
  biometricText: { color: '#4A90E2', fontSize: 15 },
});
