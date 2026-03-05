import { mapNoaaMetarResponse, METAR_FETCH_ERROR, normalizeAirportCode, type NoaaMetarRecord } from '../src/lib/metar'

type RequestLike = {
  method?: string
  query?: {
    code?: string
  }
  url?: string
}

type ResponseLike = {
  status: (code: number) => ResponseLike
  json: (value: unknown) => void
  setHeader: (name: string, value: string) => void
}

export default async function handler(request: RequestLike, response: ResponseLike) {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300')

  if (request.method && request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed.' })
    return
  }

  const codeFromQuery = request.query?.code
  const codeFromUrl =
    request.url ? new URL(request.url, 'https://metarx.local').searchParams.get('code') : null
  const airportCode = normalizeAirportCode(codeFromQuery ?? codeFromUrl ?? '')

  if (airportCode.length !== 4) {
    response.status(400).json({ error: 'Enter a valid 4-letter ICAO airport code.' })
    return
  }

  try {
    const upstreamResponse = await fetch(
      `https://aviationweather.gov/api/data/metar?ids=${airportCode}&format=json`,
    )

    if (!upstreamResponse.ok) {
      throw new Error(METAR_FETCH_ERROR)
    }

    const payload = (await upstreamResponse.json()) as NoaaMetarRecord[]
    const metar = mapNoaaMetarResponse(payload)
    response.status(200).json(metar)
  } catch {
    response.status(502).json({ error: METAR_FETCH_ERROR })
  }
}
