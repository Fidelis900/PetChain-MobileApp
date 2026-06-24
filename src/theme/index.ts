import { darkTheme, lightTheme, navigationDarkTheme, navigationLightTheme } from './colors';
import { tokens } from './tokens';
import { useTheme as useThemePreference } from '../context/ThemeContext';

export function useAppTheme() {
  const { colors } = useThemePreference();
  return colors;
}

export function useNavigationTheme() {
  const { theme } = useThemePreference();
  return theme === 'dark' ? navigationDarkTheme : navigationLightTheme;
}

export { tokens, lightTheme, darkTheme, navigationLightTheme, navigationDarkTheme };
export { contrastRatio, passesWcagAA } from './contrast';
