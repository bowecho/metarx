import { describe, expect, it } from 'vitest'
import { buildPilotAnalysisPrompt, PILOT_ANALYSIS_MODEL } from './pilotAnalysis'
import type { MetarReport } from './metar'

const sampleReport: MetarReport = {
  rawMetar: 'METAR KJFK 052251Z 07009KT 2SM -DZ BR FEW000 OVC005 06/05 A3023 RMK AO2',
  station: {
    icao: 'KJFK',
    name: 'New York/JF Kennedy Intl, NY, US',
    lat: 40.6392,
    lon: -73.7639,
  },
  observedAt: '2026-03-05T23:00:00.000Z',
  flightCategory: 'IFR',
  source: 'NOAA_AWC',
  decoded: {
    wind: { text: '070° at 9 kt' },
    visibility: { text: '2 statute miles' },
    clouds: [],
    cloudsText: 'Few clouds at 0 ft, Overcast at 500 ft',
    temperature: { celsius: 5.6, fahrenheit: 42.1, text: '5.6°C / 42.1°F' },
    dewPoint: { celsius: 5, fahrenheit: 41, text: '5.0°C / 41.0°F' },
    altimeter: { hpa: 1023.8, inHg: 30.23, text: '1023.8 hPa / 30.23 inHg' },
    weather: { text: 'Light drizzle, Mist' },
    remarksSummary:
      'automated station with precipitation discriminator; surface visibility 2 1/2 statute miles',
    remarksItems: [
      'automated station with precipitation discriminator',
      'surface visibility 2 1/2 statute miles',
    ],
  },
}

describe('pilot analysis prompt', () => {
  it('pins the requested OpenRouter model id', () => {
    expect(PILOT_ANALYSIS_MODEL).toBe('google/gemini-3-flash-preview')
  })

  it('builds a pilot-focused prompt from the current METAR report', () => {
    const prompt = buildPilotAnalysisPrompt(sampleReport)

    expect(prompt).toContain('Station: KJFK')
    expect(prompt).toContain('Raw METAR: METAR KJFK')
    expect(prompt).toContain('Flight category: IFR')
    expect(prompt).toContain('Remarks: automated station with precipitation discriminator')
    expect(prompt).toContain('senior pilot or instructor')
  })
})
