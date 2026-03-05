import { describe, expect, it } from 'vitest'
import { mapNoaaMetarResponse, normalizeAirportCode } from './metar'

describe('normalizeAirportCode', () => {
  it('keeps only letters, uppercases them, and trims to four characters', () => {
    expect(normalizeAirportCode(' kjfk-123 ')).toBe('KJFK')
  })
})

describe('mapNoaaMetarResponse', () => {
  it('maps NOAA payloads into the app report contract', () => {
    const result = mapNoaaMetarResponse([
      {
        icaoId: 'KJFK',
        rawOb: 'METAR KJFK 052151Z 06009KT 2SM -DZ BR OVC006 06/05 A3022 RMK AO2',
        reportTime: '2026-03-05T22:00:00.000Z',
        fltCat: 'IFR',
        temp: 5.6,
        dewp: 5,
        wdir: 60,
        wspd: 9,
        visib: 2,
        altim: 1023.5,
        wxString: '-DZ BR',
        lat: 40.6392,
        lon: -73.7639,
        name: 'New York/JF Kennedy Intl, NY, US',
        clouds: [{ cover: 'OVC', base: 600 }],
      },
    ])

    expect(result.station.icao).toBe('KJFK')
    expect(result.flightCategory).toBe('IFR')
    expect(result.decoded.wind.text).toBe('060° at 9 kt')
    expect(result.decoded.visibility.text).toBe('2 statute miles')
    expect(result.decoded.cloudsText).toContain('Overcast at 600 ft')
    expect(result.decoded.weather.text).toBe('Light drizzle, Mist')
    expect(result.decoded.altimeter.text).toContain('1023.5 hPa')
    expect(result.decoded.remarksSummary).toBe('automated station with precipitation discriminator')
    expect(result.decoded.remarksItems).toEqual([
      'automated station with precipitation discriminator',
    ])
  })

  it('decodes common remark tokens into readable phrases', () => {
    const result = mapNoaaMetarResponse([
      {
        icaoId: 'KJFK',
        rawOb:
          'METAR KJFK 052151Z 06009KT 2SM -DZ BR OVC006 06/05 A3022 RMK AO2 SFC VIS 3 RAE50 DZB50 SLP234 P0000 T00560050',
        reportTime: '2026-03-05T22:00:00.000Z',
        fltCat: 'IFR',
        temp: 5.6,
        dewp: 5,
        wdir: 60,
        wspd: 9,
        visib: 2,
        altim: 1023.5,
        wxString: '-DZ BR',
        lat: 40.6392,
        lon: -73.7639,
        name: 'New York/JF Kennedy Intl, NY, US',
        clouds: [{ cover: 'OVC', base: 600 }],
      },
    ])

    expect(result.decoded.remarksSummary).toContain(
      'automated station with precipitation discriminator',
    )
    expect(result.decoded.remarksSummary).toContain('surface visibility 3 statute miles')
    expect(result.decoded.remarksSummary).toContain('rain ended :50Z')
    expect(result.decoded.remarksSummary).toContain('drizzle began :50Z')
    expect(result.decoded.remarksSummary).toContain('sea-level pressure 1023.4 hPa')
    expect(result.decoded.remarksSummary).toContain('hourly precipitation 0.00 in')
    expect(result.decoded.remarksSummary).toContain(
      'exact temperature 5.6°C, dew point 5.0°C',
    )
  })
})
