import { darkTheme, lightTheme } from '../colors';
import { contrastRatio, passesWcagAA } from '../contrast';

describe('theme contrast', () => {
  it('keeps core dark mode text pairs above WCAG AA contrast', () => {
    expect(passesWcagAA(darkTheme.text, darkTheme.background)).toBe(true);
    expect(passesWcagAA(darkTheme.text, darkTheme.surface)).toBe(true);
    expect(passesWcagAA(darkTheme.secondaryText, darkTheme.background)).toBe(true);
    expect(passesWcagAA(darkTheme.secondaryText, darkTheme.card)).toBe(true);
  });

  it('keeps core light mode text pairs above WCAG AA contrast', () => {
    expect(passesWcagAA(lightTheme.text, lightTheme.background)).toBe(true);
    expect(passesWcagAA(lightTheme.secondaryText, lightTheme.surface)).toBe(true);
  });

  it('calculates known contrast ratios', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBe(21);
  });
});
