import { darkTheme, lightTheme, navigationDarkTheme, navigationLightTheme } from './colors';
import { tokens } from './tokens';
import { useTheme as useThemePreference } from '../utils/useTheme';

export function useAppTheme() {
  const { theme } = useThemePreference();
  return theme === 'dark' ? darkTheme : lightTheme;
}

export function useNavigationTheme() {
  const { theme } = useThemePreference();
  return theme === 'dark' ? navigationDarkTheme : navigationLightTheme;
}

export { tokens, lightTheme, darkTheme, navigationLightTheme, navigationDarkTheme };
