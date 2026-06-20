import { describe, it, expect, beforeEach } from 'vitest';
import { THEMES, DEFAULT_THEME, THEME_STORAGE_KEY, isThemeId, readStoredTheme, applyTheme } from '../theme';

describe('theme model', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('offers the three themes', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['developer', 'editorial', 'blueprint']);
  });

  it('validates theme ids', () => {
    expect(isThemeId('blueprint')).toBe(true);
    expect(isThemeId('neon')).toBe(false);
  });

  it('returns the default when nothing is stored', () => {
    expect(readStoredTheme()).toBe(DEFAULT_THEME);
  });

  it('applyTheme reflects on the document root and persists', () => {
    applyTheme('editorial');
    expect(document.documentElement.getAttribute('data-theme')).toBe('editorial');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('editorial');
    expect(readStoredTheme()).toBe('editorial');
  });

  it('ignores an invalid stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'bogus');
    expect(readStoredTheme()).toBe(DEFAULT_THEME);
  });
});
