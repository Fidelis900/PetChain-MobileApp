/**
 * KeyRotationScreen — allows a co-owner to rotate their Stellar signing key.
 * Creates a pending signer_management transaction that other co-owners must
 * approve before the old key is removed and the new key is added on-chain.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import multisigService from '../services/multisigService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  jointOwnershipId: string;
  petName: string;
  currentPublicKey: string;
  currentUserId: string;
  onBack: () => void;
  onRotationRequested: () => void;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const KeyRotationScreen: React.FC<Props> = ({
  jointOwnershipId,
  petName,
  currentPublicKey,
  currentUserId,
  onBack,
  onRotationRequested,
}) => {
  const [newPublicKey, setNewPublicKey] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isValidStellarKey = (key: string) => /^G[A-Z2-7]{55}$/.test(key.trim());

  const handleSubmit = async () => {
    const trimmedKey = newPublicKey.trim();

    if (!isValidStellarKey(trimmedKey)) {
      Alert.alert(
        'Invalid Public Key',
        'Enter a valid Stellar public key (starts with G, 56 characters).',
      );
      return;
    }
    if (trimmedKey === currentPublicKey) {
      Alert.alert('Same Key', 'The new key must be different from your current key.');
      return;
    }

    Alert.alert(
      'Confirm Key Rotation',
      `Your old key:\n${currentPublicKey.substring(0, 16)}…\n\nNew key:\n${trimmedKey.substring(0, 16)}…\n\nOther co-owners must approve this change before it takes effect on Stellar. Proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Rotation',
          onPress: async () => {
            setSubmitting(true);
            try {
              await multisigService.requestKeyRotation({
                jointOwnershipId,
                oldPublicKey: currentPublicKey,
                newPublicKey: trimmedKey,
                reason: reason.trim() || undefined,
              });

              await multisigService.notifyCoSignRequest(
                'signer_management',
                `A co-owner of ${petName} has requested a key rotation. Your approval is needed.`,
                jointOwnershipId,
              );

              Alert.alert(
                'Rotation Requested',
                'Your key rotation request has been submitted. Other co-owners will be notified to approve it.',
                [{ text: 'OK', onPress: onRotationRequested }],
              );
            } catch (error: any) {
              Alert.alert('Error', error?.message ?? 'Failed to request key rotation.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Key Rotation</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoIcon}>🔄</Text>
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>Rotate Your Signing Key</Text>
            <Text style={styles.infoBody}>
              Use this if your current Stellar key is compromised or you want to upgrade to a new
              keypair. Other co-owners of <Text style={styles.bold}>{petName}</Text> must approve
              the change before it executes on-chain.
            </Text>
          </View>
        </View>

        {/* Current key */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Current Key</Text>
          <View style={styles.keyBox}>
            <Text style={styles.keyText} numberOfLines={2}>
              {currentPublicKey}
            </Text>
          </View>
          <Text style={styles.keyHint}>
            This key will be removed once the rotation is approved.
          </Text>
        </View>

        {/* New key form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>New Key Details</Text>

          <Text style={styles.label}>New Stellar Public Key *</Text>
          <TextInput
            style={[styles.input, styles.monoInput]}
            value={newPublicKey}
            onChangeText={setNewPublicKey}
            placeholder="GABC...XYZ (56 characters)"
            autoCapitalize="characters"
            autoCorrect={false}
            placeholderTextColor="#bbb"
          />
          {newPublicKey.length > 0 && !isValidStellarKey(newPublicKey) && (
            <Text style={styles.fieldError}>
              Must start with G and be 56 characters (Stellar Ed25519 key)
            </Text>
          )}
          {newPublicKey.trim() === currentPublicKey && newPublicKey.length > 0 && (
            <Text style={styles.fieldError}>New key must differ from your current key</Text>
          )}

          <Text style={styles.label}>Reason for Rotation (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Key compromise, hardware upgrade..."
            multiline
            numberOfLines={3}
            placeholderTextColor="#bbb"
          />
        </View>

        {/* Recovery guidance */}
        <View style={styles.recoveryCard}>
          <Text style={styles.recoveryTitle}>🛡️ Recovery Guidance</Text>
          <Text style={styles.recoveryText}>
            • Generate your new keypair offline using the Stellar Laboratory or a hardware wallet.
            {'\n'}• Never share your secret key — only the public key is needed here.{'\n'}• Store
            your new secret key securely before submitting this request.{'\n'}• If you lose access
            to both keys, you will need all other co-owners to remove your signer entry manually.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Request Key Rotation</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  headerRight: { width: 60 },
  content: { padding: 16, paddingBottom: 40 },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bbdefb',
    gap: 10,
    alignItems: 'flex-start',
  },
  infoIcon: { fontSize: 24 },
  infoText: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#1565c0', marginBottom: 4 },
  infoBody: { fontSize: 13, color: '#0d47a1', lineHeight: 18 },
  bold: { fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  keyBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  keyText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
  },
  keyHint: { fontSize: 11, color: '#999', marginTop: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1a1a1a',
    backgroundColor: '#fafafa',
  },
  monoInput: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  fieldError: { fontSize: 11, color: '#F44336', marginTop: 4 },
  recoveryCard: {
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffe082',
  },
  recoveryTitle: { fontSize: 13, fontWeight: '700', color: '#f57f17', marginBottom: 8 },
  recoveryText: { fontSize: 12, color: '#795548', lineHeight: 20 },
  submitBtn: {
    backgroundColor: '#1565c0',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

export default KeyRotationScreen;
