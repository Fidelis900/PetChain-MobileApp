import apiClient from './apiClient';

export type EventType = 'screen_view' | 'feature_usage' | 'error';

export interface AnalyticsEvent {
  type: EventType;
  name: string;
  meta?: Record<string, unknown>;
  timestamp: number;
}

async function track(type: EventType, name: string, meta?: Record<string, unknown>): Promise<void> {
  const event: AnalyticsEvent = { type, name, meta, timestamp: Date.now() };
  try {
    await apiClient.post('/analytics/events', event);
  } catch {
    // best-effort — never throw
  }
}

export const analyticsService = {
  screenView: (screenName: string) => track('screen_view', screenName),
  featureUsed: (featureName: string, meta?: Record<string, unknown>) =>
    track('feature_usage', featureName, meta),
  error: (errorMessage: string, meta?: Record<string, unknown>) =>
    track('error', errorMessage, meta),
};

export default analyticsService;
