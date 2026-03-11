import { describe, expect, it, vi } from 'vitest'

vi.mock('tz-lookup', () => ({
  default: vi.fn((lat: number) => (lat > 40 ? 'America/New_York' : 'America/Chicago')),
}))

import tzLookup from 'tz-lookup'
import { formatAirportDateTime, formatAirportTime, getAirportTimeZone } from './timezone'

describe('timezone helpers', () => {
  it('caches airport timezone lookups by coordinates', () => {
    expect(getAirportTimeZone({ lat: 40.6392, lon: -73.7639 })).toBe('America/New_York')
    expect(getAirportTimeZone({ lat: 40.6392, lon: -73.7639 })).toBe('America/New_York')
    expect(tzLookup).toHaveBeenCalledTimes(1)
  })

  it('falls back to UTC when timezone lookup fails', async () => {
    vi.mocked(tzLookup).mockImplementationOnce(() => {
      throw new Error('lookup failed')
    })

    expect(getAirportTimeZone({ lat: 1, lon: 1 })).toBe('UTC')

    vi.mocked(tzLookup).mockImplementationOnce(() => {
      throw new Error('lookup failed')
    })

    expect(formatAirportTime('2026-03-05T23:00:00.000Z', { lat: 1, lon: 1 })).toContain('UTC')
  })

  it('formats airport date and time using the resolved timezone', () => {
    expect(
      formatAirportDateTime('2026-03-05T23:00:00.000Z', { lat: 40.6392, lon: -73.7639 }),
    ).toMatch(/Mar 5, 2026, 6:00 PM EST|Mar 5, 2026, 6:00 PM GMT-5/)

    expect(
      formatAirportTime('2026-03-05T23:00:00.000Z', { lat: 30.1831, lon: -97.6806 }),
    ).toMatch(/5:00 PM CST|5:00 PM GMT-6/)
  })
})
