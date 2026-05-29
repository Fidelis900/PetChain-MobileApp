import React from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { OptimizedImage } from './OptimizedImage';
import type { MedicalDocumentMetadata } from '../models/MedicalRecord';
import {
  formatFileSize,
  getAttachmentLabel,
  isImageDocument,
  isPdfDocument,
  normalizeDocuments,
} from '../utils/medicalRecordAttachments';

interface Props {
  documents?: MedicalDocumentMetadata[] | null;
}

function openDocument(url: string): void {
  void Linking.openURL(url).catch(() => {
    Alert.alert('Unable to open attachment', 'Please try again or copy the link into a browser.');
  });
}

export const MedicalRecordAttachments: React.FC<Props> = ({ documents }) => {
  const attachments = normalizeDocuments(documents);

  if (attachments.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Attachments</Text>
      <View style={styles.grid}>
        {attachments.map((document) => {
          const description = [
            getAttachmentLabel(document),
            formatFileSize(document.sizeBytes),
            document.mimeType,
          ]
            .filter(Boolean)
            .join(' • ');

          return (
            <TouchableOpacity
              key={document.id || document.url}
              style={styles.card}
              onPress={() => openDocument(document.url)}
              accessibilityRole="button"
              accessibilityLabel={`${document.name}, ${description}`}
              accessibilityHint="Opens the attachment"
            >
              {isImageDocument(document) ? (
                <OptimizedImage
                  uri={document.url}
                  style={styles.preview}
                  resizeMode="cover"
                  accessibilityLabel={document.name}
                />
              ) : (
                <View style={[styles.preview, styles.filePreview]}>
                  <Text style={styles.fileIcon}>{isPdfDocument(document) ? 'PDF' : 'DOC'}</Text>
                </View>
              )}
              <View style={styles.meta}>
                <Text style={styles.name} numberOfLines={2}>
                  {document.name}
                </Text>
                <Text style={styles.details} numberOfLines={2}>
                  {description}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  grid: {
    marginBottom: -12,
  },
  card: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  preview: {
    width: '100%',
    height: 180,
    backgroundColor: '#EEF2F7',
  },
  filePreview: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileIcon: {
    fontSize: 30,
    fontWeight: '800',
    color: '#374151',
    letterSpacing: 1,
  },
  meta: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  details: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },
});

export default MedicalRecordAttachments;
