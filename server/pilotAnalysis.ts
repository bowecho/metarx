import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { streamText } from 'ai'
import {
  consumePilotAnalysisRateLimit,
} from './pilotAnalysis/rateLimit'
import {
  getClientAddress,
  isAllowedOrigin,
  isJsonRequest,
  isPilotAnalysisRequest,
  readJsonBody,
  type RequestLike,
} from './pilotAnalysis/request'
import {
  openEventStream,
  sendJson,
  type ResponseLike,
  writeSseEvent,
} from './pilotAnalysis/sse'
import {
  buildPilotAnalysisPrompt,
  getPilotAnalysisTemperature,
  getPilotAnalysisSystemPrompt,
  PILOT_ANALYSIS_MODEL,
} from '../src/lib/pilotAnalysis'
import { resolvePersonaMode } from '../src/lib/persona'

export { resetPilotAnalysisRateLimit } from './pilotAnalysis/rateLimit'

export async function handlePilotAnalysisRequest(request: RequestLike, response: ResponseLike) {
  if (request.method && request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed.' })
    return
  }

  if (!isJsonRequest(request)) {
    sendJson(response, 415, { error: 'Pilot analysis requires an application/json request body.' })
    return
  }

  if (!isAllowedOrigin(request)) {
    sendJson(response, 403, { error: 'Cross-origin pilot analysis requests are not allowed.' })
    return
  }

  if (!consumePilotAnalysisRateLimit(getClientAddress(request))) {
    sendJson(response, 429, { error: 'Pilot analysis is temporarily rate limited. Try again shortly.' })
    return
  }

  try {
    const payload = await readJsonBody(request)

    if (!isPilotAnalysisRequest(payload)) {
      sendJson(response, 400, { error: 'A decoded METAR report is required for pilot analysis.' })
      return
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      throw new Error('OpenRouter API key is not configured.')
    }

    const personaMode = resolvePersonaMode(
      (payload as { personaMode?: unknown }).personaMode,
    )
    const openrouter = createOpenRouter({ apiKey })
    const result = streamText({
      model: openrouter(PILOT_ANALYSIS_MODEL),
      temperature: getPilotAnalysisTemperature(personaMode),
      system: getPilotAnalysisSystemPrompt(personaMode),
      prompt: buildPilotAnalysisPrompt(payload.report, personaMode),
    })

    openEventStream(response)

    for await (const chunk of result.textStream) {
      writeSseEvent(response, 'token', chunk)
    }

    writeSseEvent(response, 'done', '')
    response.end()
  } catch (error) {
    if (
      !response.headersSent &&
      error instanceof Error &&
      (error.message === 'Pilot analysis request body must be valid JSON.' ||
        error.message === 'Pilot analysis request body is too large.')
    ) {
      sendJson(
        response,
        error.message === 'Pilot analysis request body is too large.' ? 413 : 400,
        { error: error.message },
      )
      return
    }

    if (!response.headersSent) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : 'Pilot analysis failed.',
      })
      return
    }

    writeSseEvent(
      response,
      'error',
      error instanceof Error ? error.message : 'Pilot analysis failed.',
    )
    response.end()
  }
}
