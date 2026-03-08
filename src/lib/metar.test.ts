import { describe, expect, it } from 'vitest'
import { mapNoaaMetarResponse, METAR_NOT_FOUND_ERROR, normalizeAirportCode } from './metar'

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
    expect(result.decoded.runwayVisualRange.text).toBe('Not reported')
    expect(result.decoded.verticalVisibility.text).toBe('Not reported')
    expect(result.decoded.cloudsText).toContain('Overcast at 600 ft')
    expect(result.decoded.weather.text).toBe('Light drizzle, Mist')
    expect(result.decoded.altimeter.text).toContain('1023.5 hPa')
    expect(result.decoded.altimeter.text).toContain('30.22 inHg')
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

  it('decodes grouped lightning, cloud, and additive remark groups from a live-style KAUS report', () => {
    const result = mapNoaaMetarResponse([
      {
        icaoId: 'KAUS',
        rawOb:
          'METAR KAUS 072353Z 01010KT 10SM SCT019 OVC035 16/13 A3002 RMK AO2 LTG DSNT E AND SE AND NW SLP162 CB DSNT SE 60031 T01610128 10233 20144 53014 $',
        reportTime: '2026-03-08T00:00:00.000Z',
        fltCat: 'VFR',
        temp: 16.1,
        dewp: 12.8,
        wdir: 10,
        wspd: 10,
        visib: 10,
        altim: 1016.7,
        lat: 30.1831,
        lon: -97.6806,
        name: 'Austin/Bergstrom Intl, TX, US',
        clouds: [
          { cover: 'SCT', base: 1900 },
          { cover: 'OVC', base: 3500 },
        ],
      },
    ])

    expect(result.decoded.remarksItems).toEqual([
      'automated station with precipitation discriminator',
      'lightning distant east, southeast, and northwest',
      'sea-level pressure 1016.2 hPa',
      'cumulonimbus distant southeast',
      '3- or 6-hour precipitation 0.31 in',
      'exact temperature 16.1°C, dew point 12.8°C',
      '6-hour maximum temperature 23.3°C',
      '6-hour minimum temperature 14.4°C',
      '3-hour pressure tendency code 3, 1.4 hPa',
      'maintenance required indicator',
    ])
  })

  it('decodes standard U.S. remark extensions and preserves unknown fragments', () => {
    const result = mapNoaaMetarResponse([
      {
        icaoId: 'KDAL',
        rawOb:
          'METAR KDAL 052151Z 18012KT 5SM BR FEW020 18/12 A2998 RMK TWR VIS 1 1/2 VIS NE 2 VIS 1V3 PK WND 18028/45 WSHFT 30 FROPA PRESRR RVRNO PWINO TSNO SLPNO 401231067 UNK',
        reportTime: '2026-03-05T22:00:00.000Z',
        fltCat: 'MVFR',
        temp: 18.3,
        dewp: 12.1,
        wdir: 180,
        wspd: 12,
        visib: 5,
        altim: 1015.2,
        lat: 32.8471,
        lon: -96.8517,
        name: 'Dallas Love Field, TX, US',
        clouds: [{ cover: 'FEW', base: 2000 }],
      },
    ])

    expect(result.decoded.remarksSummary).toContain('tower visibility 1 1/2 statute miles')
    expect(result.decoded.remarksSummary).toContain('visibility northeast 2 statute miles')
    expect(result.decoded.remarksSummary).toContain(
      'visibility varying between 1 and 3 statute miles',
    )
    expect(result.decoded.remarksSummary).toContain('peak wind 180° at 28 kt at :45Z')
    expect(result.decoded.remarksSummary).toContain('wind shift at :30Z due to frontal passage')
    expect(result.decoded.remarksSummary).toContain('pressure rising rapidly')
    expect(result.decoded.remarksSummary).toContain('runway visual range unavailable')
    expect(result.decoded.remarksSummary).toContain('precipitation identifier sensor unavailable')
    expect(result.decoded.remarksSummary).toContain('thunderstorm information unavailable')
    expect(result.decoded.remarksSummary).toContain('sea-level pressure unavailable')
    expect(result.decoded.remarksSummary).toContain(
      '24-hour maximum temperature 12.3°C, minimum temperature -6.7°C',
    )
    expect(result.decoded.remarksSummary).toContain('UNK')
  })

  it('maps runway visual range and vertical visibility from the METAR body', () => {
    const result = mapNoaaMetarResponse([
      {
        icaoId: 'KJFK',
        rawOb:
          'METAR KJFK 072351Z 18008G18KT 1/4SM R04R/4500FT -DZ FG VV003 06/06 A2997 RMK AO2 SFC VIS 1/2 SLP149 P0000 60000 T00560056 10061 20056 56024',
        reportTime: '2026-03-08T00:00:00.000Z',
        fltCat: 'LIFR',
        temp: 5.6,
        dewp: 5.6,
        wdir: 180,
        wspd: 8,
        wgst: 18,
        visib: 0.25,
        altim: 1015,
        vertVis: 3,
        wxString: '-DZ FG',
        lat: 40.6392,
        lon: -73.7639,
        name: 'New York/JF Kennedy Intl, NY, US',
        clouds: [{ cover: 'OVX', base: 300 }],
      },
    ])

    expect(result.decoded.wind.text).toBe('180° at 8 kt gusting 18 kt')
    expect(result.decoded.runwayVisualRange.text).toBe('04R: 4,500 ft')
    expect(result.decoded.verticalVisibility.text).toBe('300 ft')
    expect(result.decoded.clouds).toEqual([])
    expect(result.decoded.cloudsText).toBe('No cloud layers reported')
  })

  it('decodes runway visual range bounds and variation groups', () => {
    const result = mapNoaaMetarResponse([
      {
        icaoId: 'KORD',
        rawOb:
          'METAR KORD 072351Z 21012KT 1/2SM R10L/M0600FT R10C/P6000FT R10R/4500V6000FT FG OVC002 01/01 A2988',
        reportTime: '2026-03-08T00:00:00.000Z',
        fltCat: 'LIFR',
        temp: 1,
        dewp: 1,
        wdir: 210,
        wspd: 12,
        visib: 0.5,
        altim: 1011.5,
        wxString: 'FG',
        lat: 41.9786,
        lon: -87.9048,
        name: 'Chicago O Hare Intl, IL, US',
        clouds: [{ cover: 'OVC', base: 200 }],
      },
    ])

    expect(result.decoded.runwayVisualRange.text).toBe(
      '10L: less than 600 ft; 10C: more than 6,000 ft; 10R: 4,500 ft to 6,000 ft',
    )
  })

  it('throws a distinct not-found error for empty NOAA responses', () => {
    expect(() => mapNoaaMetarResponse([])).toThrow(METAR_NOT_FOUND_ERROR)
  })
})
