import React from 'react';
import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { type PermissionType, PERMISSION_RATIONALES } from '../utils/permissionRationale';

interface Props {
  visible: boolean;
  permissionType: PermissionType;
  /** Called when user taps "Allow" — caller should request the permission */
  onAllow: () => void;
  /** Called when user taps "Not Now" */
  onDeny: () => void;
  /** When true, shows a "Open Settings" button instead of "Allow" */
  showSettings?: boolean;
}

const PermissionRationaleModal: React.FC<Props> = ({
  visible,
  permissionType,
  onAllow,
  onDeny,
  showSettings = false,
}) => {
  const rationale = PERMISSION_RATIONALES[permissionType];

  const handlePrimaryAction = () => {
    if (showSettings) {
      void Linking.openSettings();
    } else {
      onAllow();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDeny}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.icon}>{rationale.icon}</Text>
          <Text style={styles.title}>{rationale.title}</Text>
          <Text style={styles.description}>{rationale.description}</Text>

          <View style={styles.benefitsContainer}>
            {rationale.benefits.map((benefit) => (
              <View key={benefit} style={styles.benefitRow}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handlePrimaryAction}
            accessibilityRole="button"
            accessibilityLabel={showSettings ? 'Open Settings' : 'Allow'}
          >
            <Text style={styles.primaryButtonText}>{showSettings ? 'Open Settings' : 'Allow'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onDeny}
            accessibilityRole="button"
            accessibilityLabel="Not Now"
          >
            <Text style={styles.secondaryButtonText}>Not Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  icon: { fontSize: 48, marginBottom: 12 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  benefitsContainer: { alignSelf: 'stretch', marginBottom: 24 },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  checkmark: { color: '#10B981', fontWeight: '700', marginRight: 8, fontSize: 14 },
  benefitText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  primaryButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  secondaryButton: {
    paddingVertical: 10,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#6B7280', fontSize: 14 },
});

export default PermissionRationaleModal;
