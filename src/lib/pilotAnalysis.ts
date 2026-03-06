import type { MetarReport } from './metar'

export const PILOT_ANALYSIS_MODEL = 'google/gemini-3-flash-preview'

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

export type PilotAnalysisRequest = {
  report: MetarReport
}

export function buildPilotAnalysisPrompt(report: MetarReport) {
  return [
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
    'Speak like a senior pilot or instructor debriefing another pilot.',
    'Emphasize safety considerations, workload, and what deserves extra attention.',
  ].join('\n')
}
