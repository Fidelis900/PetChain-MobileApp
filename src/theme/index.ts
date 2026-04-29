import { darkTheme, lightTheme, navigationDarkTheme, navigationLightTheme } from './colors';
import { useTheme as useThemePreference } from '../utils/useTheme';

export function useAppTheme() {
  const { theme } = useThemePreference();
  return theme === 'dark' ? darkTheme : lightTheme;
}

export function useNavigationTheme() {
  const { theme } = useThemePreference();
  return theme === 'dark' ? navigationDarkTheme : navigationLightTheme;
}
