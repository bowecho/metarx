import {
  type MetarLookupResponse,
  mapNoaaMetarResponses,
  METAR_FETCH_ERROR,
  METAR_NOT_FOUND_ERROR,
  normalizeAirportCode,
  type NoaaMetarRecord,
} from '../src/lib/metar'

type RequestLike = {
  method?: string
  query?: {
    code?: string
  }
  url?: string
}

type ResponseLike = {
  end?: (chunk?: string) => void
  json?: (value: unknown) => void
  setHeader: (name: string, value: string) => void
  status?: (code: number) => ResponseLike
  statusCode?: number
}

const ICAO_ERROR = 'Enter a valid 4-letter ICAO airport code.'
const METAR_UPSTREAM_TIMEOUT_MS = 10_000

export async function handleMetarRequest(request: RequestLike, response: ResponseLike) {
  response.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300')

  if (request.method && request.method !== 'GET') {
    sendJson(response, 405, { error: 'Method not allowed.' })
    return
  }

  const codeFromQuery = request.query?.code
  const codeFromUrl =
    request.url ? new URL(request.url, 'https://metarx.local').searchParams.get('code') : null
  const airportCode = normalizeAirportCode(codeFromQuery ?? codeFromUrl ?? '')

  if (airportCode.length !== 4) {
    sendJson(response, 400, { error: ICAO_ERROR })
    return
  }

  try {
    const responsePayload = await lookupMetar(airportCode)
    sendJson(response, 200, responsePayload)
  } catch (error) {
    if (error instanceof Error && error.message === METAR_NOT_FOUND_ERROR) {
      sendJson(response, 404, { error: METAR_NOT_FOUND_ERROR })
      return
    }

    sendJson(response, 502, { error: METAR_FETCH_ERROR })
  }
}

export async function lookupMetar(airportCode: string): Promise<MetarLookupResponse> {
  const normalizedCode = normalizeAirportCode(airportCode)
  const abortController = new AbortController()
  const timeoutId = setTimeout(() => abortController.abort(), METAR_UPSTREAM_TIMEOUT_MS)
  try {
    const upstreamResponse = await fetch(
      `https://aviationweather.gov/api/data/metar?ids=${normalizedCode}&format=json&hours=24`,
      { signal: abortController.signal },
    )

    if (upstreamResponse.status === 204) {
      throw new Error(METAR_NOT_FOUND_ERROR)
    }

    if (!upstreamResponse.ok) {
      throw new Error(METAR_FETCH_ERROR)
    }

    const payload = (await upstreamResponse.json()) as NoaaMetarRecord[]
    const reports = mapNoaaMetarResponses(payload)
    const metar = reports[0]

    if (!metar) {
      throw new Error(METAR_NOT_FOUND_ERROR)
    }

    return {
      ...metar,
      history: reports.slice(0, 12),
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(METAR_FETCH_ERROR)
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

function sendJson(response: ResponseLike, statusCode: number, payload: unknown) {
  response.setHeader('Content-Type', 'application/json')

  if (response.status) {
    response.status(statusCode).json?.(payload)
    return
  }

  response.statusCode = statusCode
  response.end?.(JSON.stringify(payload))
}
