import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import errorLogger from '../services/errorLogger';
import crashReporting from '../services/crashReporting';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error | null;
  info?: React.ErrorInfo | null;
  resetKey: number;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, info: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error } as Partial<State>;
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ info });
    void errorLogger.logError(error, info.componentStack ?? '');
    // Report to Sentry with component stack as extra context
    crashReporting.captureException(error, {
      componentStack: info.componentStack ?? '',
    });
  }

  handleRetry = () => {
    // bump resetKey to force children remount
    this.setState((s) => ({ hasError: false, error: null, info: null, resetKey: s.resetKey + 1 }));
  };

  handleReport = async () => {
    if (this.state.error) {
      await errorLogger.logError(this.state.error, this.state.info?.componentStack ?? '');
      // feedback to user could be added
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container} key={String(this.state.resetKey)}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>An unexpected error occurred. You can retry or report the issue.</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btn} onPress={this.handleRetry} accessibilityRole="button" accessibilityLabel="Retry">
              <Text style={styles.btnText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={this.handleReport} accessibilityRole="button" accessibilityLabel="Report error">
              <Text style={[styles.btnText, styles.secondaryText]}>Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // key ensures children remount when resetKey changes
    return <React.Fragment key={String(this.state.resetKey)}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8, color: '#1a1a1a' },
  message: { fontSize: 14, color: '#444', textAlign: 'center', marginBottom: 20 },
  actions: { flexDirection: 'row', gap: 12 },
  btn: { backgroundColor: '#4CAF50', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginHorizontal: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
  secondary: { backgroundColor: '#e0e0e0' },
  secondaryText: { color: '#333' },
});

export default ErrorBoundary;
