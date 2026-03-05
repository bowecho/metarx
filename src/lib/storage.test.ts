import { beforeEach, describe, expect, it } from 'vitest'
import { loadStoredCodes, toggleStoredCode, upsertStoredCode } from './storage'

describe('storage helpers', () => {
  beforeEach(() => {
    window.localStorage.clear()
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
})
