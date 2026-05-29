import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, Animated, Platform } from 'react-native';

import { offlineQueue, type OfflineQueueStatus } from '../services/offlineQueue';

const OfflineIndicator: React.FC = () => {
  const [status, setStatus] = useState<OfflineQueueStatus | null>(null);
  const [visibleAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Get initial status
    offlineQueue.getStatus().then(setStatus);

    // Listen for changes
    const unsubscribe = offlineQueue.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (status && (!status.isOnline || status.isSyncing || status.pendingCount > 0)) {
      Animated.timing(visibleAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(visibleAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [status, visibleAnim]);

  if (!status) return null;

  const isOffline = !status.isOnline;
  const isSyncing = status.isSyncing;
  const hasPending = status.pendingCount > 0;

  if (!isOffline && !isSyncing && !hasPending) {
    return null;
  }

  let message = '';
  let bgColor = '#666';

  if (isOffline) {
    message = '📴 Offline Mode';
    bgColor = '#d32f2f'; // Red for offline
  } else if (isSyncing) {
    message = '🔄 Syncing changes...';
    bgColor = '#4CAF50'; // Green for syncing
  } else if (hasPending) {
    message = `⏳ ${status.pendingCount} changes pending sync`;
    bgColor = '#FFA000'; // Amber for pending
  }

  const translateY = visibleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-50, 0],
  });

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: bgColor, transform: [{ translateY }] }]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 44 : 10,
    paddingBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 10,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default OfflineIndicator;

export function useOfflineStatus() {
  const [status, setStatus] = React.useState<OfflineQueueStatus | null>(null);

  useEffect(() => {
    offlineQueue.getStatus().then(setStatus);
    const unsubscribe = offlineQueue.onStatusChange(setStatus);
    return unsubscribe;
  }, []);

  return {
    isOnline: status?.isOnline ?? true,
    isSyncing: status?.isSyncing ?? false,
    pendingCount: status?.pendingCount ?? 0,
  };
}

export function HeaderOfflineStatus() {
  const { isOnline } = useOfflineStatus();
  if (isOnline) return null;
  return <Text style={{ color: '#d32f2f', fontSize: 12, fontWeight: '600' }}>Offline</Text>;
}
