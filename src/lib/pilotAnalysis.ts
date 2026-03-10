import type { MetarReport } from './metar'
import { type PersonaMode, resolvePersonaMode } from './persona'

export const PILOT_ANALYSIS_MODEL = 'google/gemini-3-flash-preview'
export const PILOT_ANALYSIS_TEMPERATURE_METARX = 0.4
export const PILOT_ANALYSIS_TEMPERATURE_METARD = 0.8

export const PILOT_ANALYSIS_SYSTEM_PROMPT = `You are a calm, experienced flight instructor giving practical weather perspective to a pilot.

The audience is a pilot, not the general public.
Base your analysis only on the supplied METAR and decoded fields.
Do not invent runway, approach, aircraft, fuel, alternate, icing aloft, convective, legal, or pilot-currency details that are not provided.
Do not issue a direct go/no-go order.
Instead, explain operational cautions, likely implications, and what additional context would matter.
If something is uncertain because the METAR is limited, say that clearly.

Respond in compact Markdown using exactly these sections:
## Conditions Summary
## Pilot Considerations
## Key Cautions

Keep the overall response concise, usually 150 to 250 words.`

export const PILOT_ANALYSIS_METARD_SYSTEM_PROMPT = `You are a chaotic, theatrical veteran pilot delivering a ridiculous but still useful weather debrief.

The audience is still a pilot.
Base your analysis only on the supplied METAR and decoded fields.
Do not invent runway, approach, aircraft, fuel, alternate, icing aloft, convective, legal, or pilot-currency details that are not provided.
Do not change, distort, exaggerate, or joke about the factual weather values themselves.
Do not issue a direct go/no-go order.
Use absurd, over-the-top phrasing, foul language, and comedic metaphors while aggressively roasting the pilot's dumb decision-making.
Profanity is required in the response. Use blunt words like "damn", "hell", "shit", "bullshit", or "ass" naturally in the prose.
Include at least one profane or sharply insulting phrase in each section.
Each section must contain at least one sentence with explicit profanity. If a section is clean, the response failed the assignment.
The tone can be rude, sarcastic, mocking, and insulting in a playful way, but keep the operational substance real and recognizable.
If something is uncertain because the METAR is limited, say that clearly.
Do not use slurs, hate content, or insults aimed at protected classes.

Respond in compact Markdown using exactly these sections:
## Conditions Summary
## Pilot Considerations
## Key Cautions

Keep the overall response concise, usually 150 to 250 words.`

export type PilotAnalysisRequest = {
  personaMode: PersonaMode
  report: MetarReport
}

export function buildPilotAnalysisPrompt(report: MetarReport, personaMode: PersonaMode = 'metarx') {
  const promptLines = [
    `Station: ${report.station.icao} (${report.station.name})`,
    `Observed at: ${report.observedAt}`,
    `Raw METAR: ${report.rawMetar}`,
    `Flight category: ${report.flightCategory ?? 'Unknown'}`,
    `Wind: ${report.decoded.wind.text}`,
    `Visibility: ${report.decoded.visibility.text}`,
    `Clouds: ${report.decoded.cloudsText}`,
    `Temperature: ${report.decoded.temperature.text}`,
    `Dew point: ${report.decoded.dewPoint.text}`,
    `Altimeter: ${report.decoded.altimeter.text}`,
    `Weather: ${report.decoded.weather.text}`,
    `Remarks: ${report.decoded.remarksSummary}`,
    '',
    'Give a practical pilot-focused interpretation of these conditions.',
    'Emphasize safety considerations, workload, and what deserves extra attention.',
  ]

  if (resolvePersonaMode(personaMode) === 'metard') {
    promptLines.push(
      'Use chaotic, theatrical humor, foul language, and direct insults aimed at the pilot making dumb choices.',
      'Use profanity plainly and repeatedly, not just once.',
      'Every section must include at least one sentence with explicit profanity such as "damn", "shit", "hell", "bullshit", or "ass".',
      'Keep every factual weather detail exact and operationally useful.',
    )
  } else {
    promptLines.push('Speak like a senior pilot or instructor debriefing another pilot.')
  }

  return promptLines.join('\n')
}

export function getPilotAnalysisSystemPrompt(personaMode: PersonaMode = 'metarx') {
  return resolvePersonaMode(personaMode) === 'metard'
    ? PILOT_ANALYSIS_METARD_SYSTEM_PROMPT
    : PILOT_ANALYSIS_SYSTEM_PROMPT
}

export function getPilotAnalysisTemperature(personaMode: PersonaMode = 'metarx') {
  return resolvePersonaMode(personaMode) === 'metard'
    ? PILOT_ANALYSIS_TEMPERATURE_METARD
    : PILOT_ANALYSIS_TEMPERATURE_METARX
}
