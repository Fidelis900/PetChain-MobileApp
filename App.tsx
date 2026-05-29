import * as Sentry from '@sentry/react-native';
import React, { useEffect } from 'react';
import { View, StyleSheet, I18nManager } from 'react-native';

import OfflineIndicator from './src/components/OfflineIndicator';
import { useSplashGuard } from './src/components/SplashGuard';
import UpdatePrompt from './src/components/UpdatePrompt';
import { PetProvider } from './src/context/PetContext';
import i18n, { isRTL } from './src/i18n';
import AppNavigator from './src/navigation/AppNavigator';
import crashReporting from './src/services/crashReporting';
import {
  registerNotificationActions,
  watchNotificationActions,
} from './src/services/notificationService';
import updateService from './src/services/updateService';

// Initialise Sentry before the first render
crashReporting.init();

// Apply RTL direction based on the active language at startup
const startupRTL = isRTL(i18n.language);
if (I18nManager.isRTL !== startupRTL) {
  I18nManager.forceRTL(startupRTL);
}

function App() {
  const { appReady } = useSplashGuard();
  const [updateStatus, setUpdateStatus] = React.useState<
    { visible: false } | { visible: true; variant: 'optional' | 'force'; storeUrl?: string }
  >({ visible: false });

  // Check for updates on launch
  React.useEffect(() => {
    if (!appReady) return;
    void (async () => {
      const result = await updateService.checkForUpdate();
      if (result.type === 'force-update') {
        setUpdateStatus({ visible: true, variant: 'force', storeUrl: result.storeUrl });
      } else if (result.type === 'ota-available') {
        setUpdateStatus({ visible: true, variant: 'optional' });
      }
    })();
  }, [appReady]);

  const handleUpdate = () => {
    void updateService.applyOtaUpdate();
  };

  const handleDismiss = () => {
    setUpdateStatus({ visible: false });
  };

  useEffect(() => {
    void registerNotificationActions();
    const subscription = watchNotificationActions();
    return () => subscription.remove();
  }, []);

  if (!appReady) return <View style={styles.root} />;

  return (
    <PetProvider>
      <View style={styles.root}>
        <OfflineIndicator />
        <AppNavigator />
        <UpdatePrompt
          visible={updateStatus.visible}
          variant={updateStatus.visible ? updateStatus.variant : 'optional'}
          storeUrl={updateStatus.visible ? updateStatus.storeUrl : undefined}
          onUpdate={handleUpdate}
          onDismiss={handleDismiss}
        />
      </View>
    </PetProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

// Wrap with Sentry to capture unhandled JS exceptions and ANRs
export default Sentry.wrap(App);
