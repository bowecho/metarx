export type ThemeMode = 'system' | 'light' | 'dark'

export const THEME_STORAGE_KEY = 'metarx:theme-mode'

export function resolveTheme(mode: ThemeMode, prefersDark: boolean) {
  if (mode === 'system') {
    return prefersDark ? 'dark' : 'light'
  }

  return mode
}

export function loadStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'system'
  }

  const value = window.localStorage.getItem(THEME_STORAGE_KEY)

  if (value === 'light' || value === 'dark' || value === 'system') {
    return value
  }

  return 'system'
}

export function saveThemeMode(mode: ThemeMode) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, mode)
}
