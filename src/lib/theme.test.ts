import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadStoredThemeMode, resolveTheme, saveThemeMode } from './theme'

describe('theme helpers', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('resolves system theme from preference', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('persists and reloads an explicit theme mode', () => {
    saveThemeMode('dark')
    expect(loadStoredThemeMode()).toBe('dark')
  })

  it('ignores localStorage write failures', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage denied')
    })

    expect(() => saveThemeMode('dark')).not.toThrow()
  })
})
