/**
 * theme — the editor's selectable visual themes. A theme is a swap of CSS design
 * tokens (see specpad.less); this module only tracks which one is active, persists
 * it to localStorage, and reflects it onto the document root as data-theme. The
 * same key + default are mirrored by an inline boot script in index.html so the
 * saved theme is applied before first paint (no flash of the wrong theme).
 */
export type ThemeId = 'developer' | 'editorial' | 'blueprint';

export const THEMES: { id: ThemeId; label: string; blurb: string }[] = [
  { id: 'developer', label: 'Developer', blurb: 'Refined, light, precise' },
  { id: 'editorial', label: 'Editorial', blurb: 'Typeset document, paper' },
  { id: 'blueprint', label: 'Blueprint', blurb: 'Dark, technical, grid' },
];

export const DEFAULT_THEME: ThemeId = 'developer';
export const THEME_STORAGE_KEY = 'specpad.theme';

export function isThemeId(value: unknown): value is ThemeId {
  return value === 'developer' || value === 'editorial' || value === 'blueprint';
}

/** The persisted theme, or the default when unset/invalid. */
export function readStoredTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(raw) ? raw : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Apply a theme: reflect it on the document root and persist the choice. */
export function applyTheme(id: ThemeId): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', id);
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* storage unavailable (private mode) — the in-memory choice still applies */
  }
}
