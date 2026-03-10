import { describe, expect, it } from 'vitest'
import {
  buildPilotAnalysisPrompt,
  getPilotAnalysisTemperature,
  getPilotAnalysisSystemPrompt,
  PILOT_ANALYSIS_METARD_SYSTEM_PROMPT,
  PILOT_ANALYSIS_MODEL,
  PILOT_ANALYSIS_SYSTEM_PROMPT,
  PILOT_ANALYSIS_TEMPERATURE_METARD,
  PILOT_ANALYSIS_TEMPERATURE_METARX,
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
    expect(PILOT_ANALYSIS_MODEL).toBe('google/gemini-3-flash-preview')
  })

  it('builds a pilot-focused prompt from the current METAR report', () => {
    const prompt = buildPilotAnalysisPrompt(sampleReport, 'metarx')

    expect(prompt).toContain('Station: KJFK')
    expect(prompt).toContain('Raw METAR: METAR KJFK')
    expect(prompt).toContain('Flight category: IFR')
    expect(prompt).toContain('Remarks: automated station with precipitation discriminator')
    expect(prompt).toContain('senior pilot or instructor')
  })

  it('builds a chaotic but still factual metard prompt variant', () => {
    const prompt = buildPilotAnalysisPrompt(sampleReport, 'metard')

    expect(prompt).toContain('foul language')
    expect(prompt).toContain('direct insults aimed at the pilot')
    expect(prompt).toContain('Use profanity plainly and repeatedly')
    expect(prompt).toContain('Every section must include at least one sentence with explicit profanity')
    expect(prompt).toContain('Keep every factual weather detail exact')
  })

  it('selects persona-specific system prompts', () => {
    expect(getPilotAnalysisSystemPrompt('metarx')).toBe(PILOT_ANALYSIS_SYSTEM_PROMPT)
    expect(getPilotAnalysisSystemPrompt('metard')).toBe(PILOT_ANALYSIS_METARD_SYSTEM_PROMPT)
    expect(PILOT_ANALYSIS_METARD_SYSTEM_PROMPT).toContain('Do not change, distort, exaggerate')
    expect(PILOT_ANALYSIS_METARD_SYSTEM_PROMPT).toContain('Do not use slurs')
    expect(PILOT_ANALYSIS_METARD_SYSTEM_PROMPT).toContain("aggressively roasting the pilot's dumb decision-making")
    expect(PILOT_ANALYSIS_METARD_SYSTEM_PROMPT).toContain('Profanity is required in the response')
    expect(PILOT_ANALYSIS_METARD_SYSTEM_PROMPT).toContain('Include at least one profane or sharply insulting phrase in each section')
    expect(PILOT_ANALYSIS_METARD_SYSTEM_PROMPT).toContain('Each section must contain at least one sentence with explicit profanity')
  })

  it('uses a higher temperature for metard while keeping metarx stable', () => {
    expect(getPilotAnalysisTemperature('metarx')).toBe(PILOT_ANALYSIS_TEMPERATURE_METARX)
    expect(getPilotAnalysisTemperature('metard')).toBe(PILOT_ANALYSIS_TEMPERATURE_METARD)
    expect(PILOT_ANALYSIS_TEMPERATURE_METARX).toBe(0.4)
    expect(PILOT_ANALYSIS_TEMPERATURE_METARD).toBe(0.8)
  })
})
