import { loadStoredValue, saveStoredValue } from './browserStorage'

export type ThemeMode = 'system' | 'light' | 'dark'

export const THEME_STORAGE_KEY = 'metarx:theme-mode'

export function resolveTheme(mode: ThemeMode, prefersDark: boolean) {
  if (mode === 'system') {
    return prefersDark ? 'dark' : 'light'
  }

  return mode
}

export function loadStoredThemeMode(): ThemeMode {
  const value = loadStoredValue(THEME_STORAGE_KEY)

  if (value === 'light' || value === 'dark' || value === 'system') {
    return value
  }

  return 'system'
}

export function saveThemeMode(mode: ThemeMode) {
  saveStoredValue(THEME_STORAGE_KEY, mode)
}
