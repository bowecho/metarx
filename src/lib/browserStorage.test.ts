import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getBrowserStorage,
  loadStoredJson,
  loadStoredValue,
  saveStoredValue,
} from './browserStorage'

describe('browserStorage helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('returns the browser localStorage object when available', () => {
    expect(getBrowserStorage()).toBe(window.localStorage)
  })

  it('loads parsed JSON values and falls back on invalid JSON', () => {
    window.localStorage.setItem('recent', JSON.stringify(['KJFK']))
    expect(loadStoredJson('recent', [])).toEqual(['KJFK'])

    window.localStorage.setItem('recent', '{bad json')
    expect(loadStoredJson('recent', ['fallback'])).toEqual(['fallback'])
  })

  it('returns null when reading localStorage throws', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(loadStoredValue('theme')).toBeNull()
  })

  it('returns false when writing localStorage throws', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(saveStoredValue('theme', 'dark')).toBe(false)
  })

  it('falls back when browser storage is unavailable', () => {
    const originalStorage = window.localStorage
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: undefined,
    })

    expect(getBrowserStorage()).toBeNull()
    expect(loadStoredJson('recent', ['fallback'])).toEqual(['fallback'])
    expect(loadStoredValue('theme')).toBeNull()
    expect(saveStoredValue('theme', 'dark')).toBe(false)

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalStorage,
    })
  })
})
