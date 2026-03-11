import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadStoredPersonaMode,
  PERSONA_COPY,
  PERSONA_STORAGE_KEY,
  savePersonaMode,
} from './persona'

describe('persona helpers', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('persists and reloads the selected persona mode', () => {
    savePersonaMode('metard')

    expect(loadStoredPersonaMode()).toBe('metard')
  })

  it('falls back to metarx for invalid stored persona values', () => {
    window.localStorage.setItem(PERSONA_STORAGE_KEY, 'bogus')

    expect(loadStoredPersonaMode()).toBe('metarx')
  })

  it('provides distinct copy for both personas', () => {
    expect(PERSONA_COPY.metarx.brand).toBe('MetarX')
    expect(PERSONA_COPY.metard.brand).toBe('MetarZ')
    expect(PERSONA_COPY.metard.searchIdleButton).not.toBe(PERSONA_COPY.metarx.searchIdleButton)
  })

  it('ignores localStorage write failures', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage denied')
    })

    expect(() => savePersonaMode('metard')).not.toThrow()
  })

  it('falls back to metarx when browser storage is unavailable', () => {
    const originalStorage = window.localStorage
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: undefined,
    })

    expect(loadStoredPersonaMode()).toBe('metarx')

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalStorage,
    })
  })
})
