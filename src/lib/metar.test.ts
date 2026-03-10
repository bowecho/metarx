import { describe, expect, it } from 'vitest'
import {
  deriveMetarWatchouts,
  mapNoaaMetarResponse,
  mapNoaaMetarResponses,
  METAR_NOT_FOUND_ERROR,
  normalizeAirportCode,
} from './metar'

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

  it('decodes peak wind groups with hhmm timestamps', () => {
    const result = mapNoaaMetarResponse([
      {
        icaoId: 'KSFO',
        rawOb:
          'METAR KSFO 100256Z 27021G28KT 10SM FEW009 SCT200 12/07 A2989 RMK AO2 PK WND 28032/0228 SLP123 T01220072 51011 $',
        reportTime: '2026-03-10T02:56:00.000Z',
        fltCat: 'VFR',
        temp: 12.2,
        dewp: 7.2,
        wdir: 270,
        wspd: 21,
        wgst: 28,
        visib: 10,
        altim: 1012.5,
        lat: 37.6196,
        lon: -122.3656,
        name: 'San Francisco Intl, CA, US',
        clouds: [
          { cover: 'FEW', base: 900 },
          { cover: 'SCT', base: 20000 },
        ],
      },
    ])

    expect(result.decoded.remarksItems).toContain('peak wind 280° at 32 kt at 02:28Z')
  })

  it('decodes lightning type groups, thunderstorm location, and wind shift timestamps', () => {
    const result = mapNoaaMetarResponse([
      {
        icaoId: 'KATL',
        rawOb:
          'SPECI KATL 100315Z 30013G26KT 3SM TSRA BR SCT020CB BKN035 OVC080 18/16 A3020 RMK AO2 PK WND 31026/0309 WSHFT 0242 OCNL LTGICCGCA OHD-ALQDS TS OHD-ALQDS MOV E P0041 T01780156 $',
        reportTime: '2026-03-10T03:15:00.000Z',
        fltCat: 'IFR',
        temp: 17.8,
        dewp: 15.6,
        wdir: 300,
        wspd: 13,
        wgst: 26,
        visib: 3,
        altim: 1022.0,
        wxString: 'TSRA BR',
        lat: 33.6367,
        lon: -84.4281,
        name: 'Atlanta Hartsfield-Jackson Intl, GA, US',
        clouds: [
          { cover: 'SCT', base: 2000 },
          { cover: 'BKN', base: 3500 },
          { cover: 'OVC', base: 8000 },
        ],
      },
    ])

    expect(result.decoded.remarksItems).toContain('peak wind 310° at 26 kt at 03:09Z')
    expect(result.decoded.remarksItems).toContain('wind shift at 02:42Z')
    expect(result.decoded.remarksItems).toContain(
      'occasional in-cloud, cloud-to-ground, and cloud-to-air lightning overhead through all quadrants',
    )
    expect(result.decoded.remarksItems).toContain(
      'thunderstorm overhead through all quadrants moving east',
    )
  })

  it('decodes compact begin/end timing groups like RAB14E24', () => {
    const result = mapNoaaMetarResponse([
      {
        icaoId: 'KJAN',
        rawOb:
          'METAR KJAN 100254Z 20009KT 10SM FEW060 BKN085 22/19 A3008 RMK AO2 RAB14E24 SLP183 P0000 60000 T02170194 53020 $',
        reportTime: '2026-03-10T02:54:00.000Z',
        fltCat: 'VFR',
        temp: 21.7,
        dewp: 19.4,
        wdir: 200,
        wspd: 9,
        visib: 10,
        altim: 1018.3,
        lat: 32.3112,
        lon: -90.0759,
        name: 'Jackson Intl, MS, US',
        clouds: [
          { cover: 'FEW', base: 6000 },
          { cover: 'BKN', base: 8500 },
        ],
      },
    ])

    expect(result.decoded.remarksItems).toContain('rain began :14Z and rain ended :24Z')
  })

  it('decodes variable ceiling, virga, secondary-location, and indeterminable precipitation remarks', () => {
    const memphis = mapNoaaMetarResponse([
      {
        icaoId: 'KMEM',
        rawOb:
          'SPECI KMEM 100331Z 17006KT 10SM OVC010 19/18 A2999 RMK AO2 CIG 007V013 T01940183 $',
        reportTime: '2026-03-10T03:31:00.000Z',
        fltCat: 'IFR',
        temp: 19.4,
        dewp: 18.3,
        wdir: 170,
        wspd: 6,
        visib: 10,
        altim: 1015.6,
        lat: 35.0424,
        lon: -89.9767,
        name: 'Memphis Intl, TN, US',
        clouds: [{ cover: 'OVC', base: 1000 }],
      },
    ])

    const elPaso = mapNoaaMetarResponse([
      {
        icaoId: 'KELP',
        rawOb:
          'METAR KELP 100251Z 32007KT 10SM FEW100 SCT150 SCT250 21/M06 A2989 RMK AO2 SLP072 OCNL LTGICCG DSNT S VIRGA SE-OHD-NW CB DSNT S MOV N T02111061 53005',
        reportTime: '2026-03-10T02:51:00.000Z',
        fltCat: 'VFR',
        temp: 21.1,
        dewp: -6.1,
        wdir: 320,
        wspd: 7,
        visib: 10,
        altim: 1012.5,
        lat: 31.8072,
        lon: -106.3776,
        name: 'El Paso Intl, TX, US',
        clouds: [
          { cover: 'FEW', base: 10000 },
          { cover: 'SCT', base: 15000 },
          { cover: 'SCT', base: 25000 },
        ],
      },
    ])

    const syracuse = mapNoaaMetarResponse([
      {
        icaoId: 'KSYR',
        rawOb:
          'METAR KSYR 100254Z 23004KT 10SM CLR 11/M02 A2990 RMK AO2 SLP122 T01061022 53015 CHINO NW $',
        reportTime: '2026-03-10T02:54:00.000Z',
        fltCat: 'VFR',
        temp: 10.6,
        dewp: -2.2,
        wdir: 230,
        wspd: 4,
        visib: 10,
        altim: 1012.2,
        lat: 43.1112,
        lon: -76.1063,
        name: 'Syracuse Hancock Intl, NY, US',
        clouds: [],
      },
    ])

    const keyWest = mapNoaaMetarResponse([
      {
        icaoId: 'KEYW',
        rawOb:
          'METAR KEYW 100253Z AUTO 08007KT 10SM CLR 25/21 A3015 RMK AO2 SLP216 6//// T02500211 53018 PNO $',
        reportTime: '2026-03-10T02:53:00.000Z',
        fltCat: 'VFR',
        temp: 25,
        dewp: 21.1,
        wdir: 80,
        wspd: 7,
        visib: 10,
        altim: 1021.7,
        lat: 24.5561,
        lon: -81.7596,
        name: 'Key West Intl, FL, US',
        clouds: [],
      },
    ])

    expect(memphis.decoded.remarksItems).toContain('ceiling varying between 700 and 1300 ft')
    expect(elPaso.decoded.remarksItems).toContain(
      'virga southeast through overhead through northwest',
    )
    expect(elPaso.decoded.remarksItems).toContain(
      'occasional in-cloud and cloud-to-ground lightning distant south',
    )
    expect(syracuse.decoded.remarksItems).toContain(
      'sky condition at secondary location northwest unavailable',
    )
    expect(keyWest.decoded.remarksItems).toContain(
      '3- or 6-hour precipitation amount indeterminable',
    )
  })

  it('decodes weather-location remarks like VCSH NW', () => {
    const result = mapNoaaMetarResponse([
      {
        icaoId: 'KGEG',
        rawOb:
          'METAR KGEG 100253Z 25011KT 10SM SCT045 BKN110 03/M09 A2990 RMK AO2 SLP143 VCSH NW T00331094 53002',
        reportTime: '2026-03-10T02:53:00.000Z',
        fltCat: 'VFR',
        temp: 3.3,
        dewp: -9.4,
        wdir: 250,
        wspd: 11,
        visib: 10,
        altim: 1012.8,
        lat: 47.6199,
        lon: -117.5338,
        name: 'Spokane Intl, WA, US',
        clouds: [
          { cover: 'SCT', base: 4500 },
          { cover: 'BKN', base: 11000 },
        ],
      },
    ])

    expect(result.decoded.remarksItems).toContain('showers in the vicinity northwest')
  })

  it('returns newest-first reports when mapping a history payload', () => {
    const results = mapNoaaMetarResponses([
      {
        icaoId: 'KJFK',
        rawOb: 'METAR KJFK 052051Z 06008KT 3SM BR OVC008 06/05 A3021 RMK AO2',
        reportTime: '2026-03-05T20:51:00.000Z',
        fltCat: 'IFR',
        temp: 5.6,
        dewp: 5,
        wdir: 60,
        wspd: 8,
        visib: 3,
        altim: 1023.1,
        lat: 40.6392,
        lon: -73.7639,
        name: 'New York/JF Kennedy Intl, NY, US',
      },
      {
        icaoId: 'KJFK',
        rawOb: 'METAR KJFK 052151Z 06009KT 2SM -DZ BR OVC006 06/05 A3022 RMK AO2',
        reportTime: '2026-03-05T21:51:00.000Z',
        fltCat: 'IFR',
        temp: 5.6,
        dewp: 5,
        wdir: 60,
        wspd: 9,
        visib: 2,
        altim: 1023.5,
        lat: 40.6392,
        lon: -73.7639,
        name: 'New York/JF Kennedy Intl, NY, US',
      },
    ])

    expect(results).toHaveLength(2)
    expect(results[0].observedAt).toBe('2026-03-05T21:51:00.000Z')
    expect(results[1].observedAt).toBe('2026-03-05T20:51:00.000Z')
  })

  it('derives deterministic watchouts from low ceilings, low visibility, and saturation', () => {
    const report = mapNoaaMetarResponse([
      {
        icaoId: 'KJFK',
        rawOb:
          'METAR KJFK 072351Z 18008G18KT 1/4SM R04R/4500FT -DZ FG VV003 06/06 A2997 RMK AO2 SLP149 56024',
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

    expect(deriveMetarWatchouts(report)).toEqual([
      expect.objectContaining({ severity: 'high', title: 'Visibility is severely reduced' }),
      expect.objectContaining({ severity: 'high', title: 'Low-level obscuration is in play' }),
      expect.objectContaining({ severity: 'high', title: 'Ceiling is in the basement' }),
    ])
  })

  it('throws a distinct not-found error for empty NOAA responses', () => {
    expect(() => mapNoaaMetarResponse([])).toThrow(METAR_NOT_FOUND_ERROR)
  })
})
