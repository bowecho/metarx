import { describe, expect, it } from 'vitest'
import {
  buildPilotAnalysisPrompt,
  getPilotAnalysisTemperature,
  getPilotAnalysisSystemPrompt,
  PILOT_ANALYSIS_MODEL,
  PILOT_ANALYSIS_SYSTEM_PROMPT,
  PILOT_ANALYSIS_TEMPERATURE,
} from './pilotAnalysis'
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
    runwayVisualRange: { text: 'Not reported' },
    verticalVisibility: { text: 'Not reported' },
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
    expect(PILOT_ANALYSIS_MODEL).toBe('deepseek/deepseek-v3.2')
  })

  it('builds a pilot-focused prompt from the current METAR report', () => {
    const prompt = buildPilotAnalysisPrompt(sampleReport)

    expect(prompt).toContain('Station: KJFK')
    expect(prompt).toContain('Raw METAR: METAR KJFK')
    expect(prompt).toContain('Flight category: IFR')
    expect(prompt).toContain('Remarks: automated station with precipitation discriminator')
    expect(prompt).toContain('senior pilot or instructor')
    expect(prompt).toContain('Use only the supplied METAR and decoded fields as facts.')
    expect(prompt).toContain('Do not mention a specific runway number, approach type, traffic flow, fuel plan, alternate, or legal conclusion')
    expect(prompt).toContain('Do not use bullet lists. Write three short paragraphs under the required headings.')
    expect(prompt).toContain('Do not leave the final section unfinished.')
  })

  it('falls back to unknown when flight category is missing', () => {
    const prompt = buildPilotAnalysisPrompt({
      ...sampleReport,
      flightCategory: null,
    })

    expect(prompt).toContain('Flight category: Unknown')
  })

  it('returns the fixed system prompt', () => {
    expect(getPilotAnalysisSystemPrompt()).toBe(PILOT_ANALYSIS_SYSTEM_PROMPT)
    expect(PILOT_ANALYSIS_SYSTEM_PROMPT).toContain('Do not invent runway identifiers, runway configurations, traffic flow, approach types')
    expect(PILOT_ANALYSIS_SYSTEM_PROMPT).toContain('If you infer an operational implication')
    expect(PILOT_ANALYSIS_SYSTEM_PROMPT).toContain('Write short paragraphs, not bullet lists.')
    expect(PILOT_ANALYSIS_SYSTEM_PROMPT).toContain('Each heading must appear exactly once, in that order.')
    expect(PILOT_ANALYSIS_SYSTEM_PROMPT).toContain('Finish cleanly with a complete final sentence')
  })

  it('uses the fixed pilot-analysis temperature', () => {
    expect(getPilotAnalysisTemperature()).toBe(PILOT_ANALYSIS_TEMPERATURE)
    expect(PILOT_ANALYSIS_TEMPERATURE).toBe(0.4)
  })
})
