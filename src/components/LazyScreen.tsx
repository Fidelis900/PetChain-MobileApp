import React, { Suspense } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

interface Props {
  children: React.ReactNode;
}

const Fallback = () => (
  <View style={styles.container}>
    <ActivityIndicator size="large" />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

export default function LazyScreen({ children }: Props) {
  return <Suspense fallback={<Fallback />}>{children}</Suspense>;
}
