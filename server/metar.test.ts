import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleMetarRequest } from './metar'

describe('handleMetarRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a mapped METAR payload for valid requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
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
        ],
      }),
    )

    const response = createJsonResponseRecorder()

    await handleMetarRequest(
      {
        method: 'GET',
        url: 'https://metarx.local/api/metar?code=kjfk',
      },
      response,
    )

    expect(response.statusCode).toBe(200)
    expect(response.headers['cache-control']).toContain('stale-while-revalidate')
    expect(response.jsonPayload).toMatchObject({
      rawMetar: 'METAR KJFK 052151Z 06009KT 2SM -DZ BR OVC006 06/05 A3022 RMK AO2',
      station: { icao: 'KJFK' },
    })
  })

  it('rejects invalid airport codes before calling NOAA', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const response = createJsonResponseRecorder()

    await handleMetarRequest(
      {
        method: 'GET',
        url: 'https://metarx.local/api/metar?code=bad',
      },
      response,
    )

    expect(response.statusCode).toBe(400)
    expect(response.jsonPayload).toEqual({
      error: 'Enter a valid 4-letter ICAO airport code.',
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects unsupported methods', async () => {
    const response = createJsonResponseRecorder()

    await handleMetarRequest(
      {
        method: 'POST',
        url: 'https://metarx.local/api/metar?code=KJFK',
      },
      response,
    )

    expect(response.statusCode).toBe(405)
    expect(response.jsonPayload).toEqual({ error: 'Method not allowed.' })
  })

  it('maps NOAA 204 responses to not found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: async () => [],
      }),
    )
    const response = createJsonResponseRecorder()

    await handleMetarRequest(
      {
        method: 'GET',
        url: 'https://metarx.local/api/metar?code=KJFK',
      },
      response,
    )

    expect(response.statusCode).toBe(404)
    expect(response.jsonPayload).toEqual({
      error: 'No current METAR found for that airport.',
    })
  })

  it('uses the status/json response path when available', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => [],
    })
    vi.stubGlobal('fetch', fetchSpy)

    let payload: unknown
    let statusCode = 0
    const response = {
      json(value: unknown) {
        payload = value
      },
      setHeader() {},
      status(code: number) {
        statusCode = code
        return this
      },
    }

    await handleMetarRequest(
      {
        method: 'GET',
        query: { code: 'KJFK' },
      },
      response,
    )

    expect(statusCode).toBe(502)
    expect(payload).toEqual({
      error: 'Unable to retrieve a METAR for that airport right now.',
    })
    expect(fetchSpy).toHaveBeenCalledOnce()
  })
})

function createJsonResponseRecorder() {
  const headers: Record<string, string> = {}

  return {
    headers,
    jsonPayload: null as unknown,
    statusCode: 200,
    end(chunk?: string) {
      this.jsonPayload = chunk ? JSON.parse(chunk) : null
    },
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value
    },
  }
}
