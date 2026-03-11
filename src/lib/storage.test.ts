import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadStoredCodes, toggleStoredCode, upsertStoredCode } from './storage'

describe('storage helpers', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('adds a code to the front of recent history', () => {
    expect(upsertStoredCode('recent', 'KJFK', 5)).toEqual(['KJFK'])
    expect(upsertStoredCode('recent', 'KLAX', 5)).toEqual(['KLAX', 'KJFK'])
  })

  it('toggles favorites on and off', () => {
    expect(toggleStoredCode('favorites', 'KJFK', 5)).toEqual(['KJFK'])
    expect(toggleStoredCode('favorites', 'KJFK', 5)).toEqual([])
    expect(loadStoredCodes('favorites')).toEqual([])
  })

  it('ignores localStorage write failures', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage denied')
    })

    expect(() => upsertStoredCode('recent', 'KJFK', 5)).not.toThrow()
    expect(() => toggleStoredCode('favorites', 'KJFK', 5)).not.toThrow()
  })

  it('falls back to an empty list for non-array stored values', () => {
    window.localStorage.setItem('recent', JSON.stringify({ code: 'KJFK' }))

    expect(loadStoredCodes('recent')).toEqual([])
  })
})
