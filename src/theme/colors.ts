import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
} from '@react-navigation/native';

export const lightTheme = {
  background: '#F5F7FA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: '#111827',
  secondaryText: '#4B5563',
  placeholder: '#6B7280',
  border: '#D1D5DB',
  primary: '#4CAF50',
  accent: '#10B981',
  error: '#EF4444',
  success: '#10B981',
  notification: '#4CAF50',
  muted: '#E5E7EB',
  subtle: '#F8FAFC',
};

export const darkTheme = {
  background: '#0F172A',
  surface: '#111827',
  card: '#1F2937',
  text: '#E2E8F0',
  secondaryText: '#94A3B8',
  placeholder: '#CBD5E1',
  border: '#334155',
  primary: '#4CAF50',
  accent: '#34D399',
  error: '#F87171',
  success: '#34D399',
  notification: '#34D399',
  muted: '#1E293B',
  subtle: '#1E293B',
};

export const navigationLightTheme = {
  ...NavigationDefaultTheme,
  colors: {
    ...NavigationDefaultTheme.colors,
    background: lightTheme.background,
    card: lightTheme.surface,
    text: lightTheme.text,
    border: lightTheme.border,
    primary: lightTheme.primary,
    notification: lightTheme.notification,
  },
};

export const navigationDarkTheme = {
  ...NavigationDarkTheme,
  colors: {
    ...NavigationDarkTheme.colors,
    background: darkTheme.background,
    card: darkTheme.card,
    text: darkTheme.text,
    border: darkTheme.border,
    primary: darkTheme.primary,
    notification: darkTheme.notification,
  },
};
