import { beforeEach, describe, expect, it } from 'vitest'
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
    expect(PERSONA_COPY.metard.brand).toBe('MetarD')
    expect(PERSONA_COPY.metard.searchIdleButton).not.toBe(PERSONA_COPY.metarx.searchIdleButton)
  })
})
