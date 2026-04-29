import * as Sentry from '@sentry/react-native';
import React from 'react';
import { View, StyleSheet } from 'react-native';

import './src/i18n';
import OfflineIndicator from './src/components/OfflineIndicator';
import { useSplashGuard } from './src/components/SplashGuard';
import AppNavigator from './src/navigation';
import { PetProvider } from './src/context/PetContext';
import crashReporting from './src/services/crashReporting';

// Initialise Sentry before the first render
crashReporting.init();

function App() {
  const { appReady } = useSplashGuard();

  // Render nothing (splash is still visible) until critical init is done
  if (!appReady) return <View style={styles.root} />;

  return (
    <PetProvider>
      <View style={styles.root}>
        <OfflineIndicator />
        <AppNavigator />
      </View>
    </PetProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

// Wrap with Sentry to capture unhandled JS exceptions and ANRs
export default Sentry.wrap(App);
