import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  handlePilotAnalysisRequest,
  resetPilotAnalysisRateLimit,
} from './pilotAnalysis'

const validPayload = {
  report: {
    decoded: {
      altimeter: { hpa: 1023.8, inHg: 30.23, text: '1023.8 hPa / 30.23 inHg' },
      clouds: [],
      cloudsText: 'Overcast at 500 ft',
      dewPoint: { celsius: 5, fahrenheit: 41, text: '5.0°C / 41.0°F' },
      remarksItems: ['automated station'],
      remarksSummary: 'automated station',
      runwayVisualRange: { text: 'Not reported' },
      temperature: { celsius: 5.6, fahrenheit: 42.1, text: '5.6°C / 42.1°F' },
      verticalVisibility: { text: 'Not reported' },
      visibility: { miles: 2, text: '2 statute miles' },
      weather: { text: 'Light drizzle, Mist' },
      wind: { text: '060° at 9 kt' },
    },
    observedAt: '2026-03-05T23:00:00.000Z',
    rawMetar: 'METAR KJFK 052151Z 06009KT 2SM -DZ BR OVC006 06/05 A3022 RMK AO2',
    source: 'NOAA_AWC',
    station: {
      icao: 'KJFK',
      lat: 40.6392,
      lon: -73.7639,
      name: 'New York/JF Kennedy Intl, NY, US',
    },
  },
}

describe('handlePilotAnalysisRequest', () => {
  beforeEach(() => {
    resetPilotAnalysisRateLimit()
    delete process.env.OPENROUTER_API_KEY
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects cross-origin requests', async () => {
    const response = createResponseRecorder()

    await handlePilotAnalysisRequest(
      createJsonRequest(validPayload, {
        'content-type': 'application/json',
        host: 'metarx.local',
        origin: 'https://evil.example',
      }),
      response,
    )

    expect(response.statusCode).toBe(403)
    expect(response.body).toContain('Cross-origin pilot analysis requests are not allowed.')
  })

  it('rejects unsupported methods', async () => {
    const response = createResponseRecorder()

    await handlePilotAnalysisRequest(
      {
        headers: {},
        method: 'GET',
        async *[Symbol.asyncIterator]() {},
      },
      response,
    )

    expect(response.statusCode).toBe(405)
    expect(response.body).toContain('Method not allowed.')
  })

  it('rejects requests without an allowed origin/host pair', async () => {
    const response = createResponseRecorder()

    await handlePilotAnalysisRequest(
      createJsonRequest(validPayload, {
        'content-type': 'application/json',
        origin: 'http://localhost:5173',
      }),
      response,
    )

    expect(response.statusCode).toBe(403)
  })

  it('rejects invalid JSON bodies', async () => {
    const response = createResponseRecorder()

    await handlePilotAnalysisRequest(
      createStreamingRequest('{bad json', {
        'content-type': 'application/json',
        host: 'localhost:5173',
        origin: 'http://localhost:5173',
      }),
      response,
    )

    expect(response.statusCode).toBe(400)
    expect(response.body).toContain('Pilot analysis request body must be valid JSON.')
  })

  it('rejects non-json content types', async () => {
    const response = createResponseRecorder()

    await handlePilotAnalysisRequest(
      createStreamingRequest('{}', {
        'content-type': 'text/plain',
        host: 'localhost:5173',
        origin: 'http://localhost:5173',
      }),
      response,
    )

    expect(response.statusCode).toBe(415)
    expect(response.body).toContain('application/json')
  })

  it('rejects oversized payloads', async () => {
    const response = createResponseRecorder()

    await handlePilotAnalysisRequest(
      createStreamingRequest('x'.repeat(70_000), {
        'content-type': 'application/json',
        host: 'localhost:5173',
        origin: 'http://localhost:5173',
      }),
      response,
    )

    expect(response.statusCode).toBe(413)
    expect(response.body).toContain('too large')
  })

  it('treats empty request bodies as invalid analysis requests', async () => {
    const response = createResponseRecorder()

    await handlePilotAnalysisRequest(
      createStreamingRequest('', {
        'content-type': 'application/json',
        host: 'localhost:5173',
        origin: 'http://localhost:5173',
      }),
      response,
    )

    expect(response.statusCode).toBe(400)
    expect(response.body).toContain('decoded METAR report is required')
  })

  it('rejects structurally invalid pilot-analysis payloads', async () => {
    const response = createResponseRecorder()

    await handlePilotAnalysisRequest(
      createJsonRequest(
        { report: { rawMetar: 'METAR KJFK', station: { icao: 'KJFK' } } },
        {
          'content-type': 'application/json',
          host: 'localhost:5173',
          origin: 'http://localhost:5173',
        },
      ),
      response,
    )

    expect(response.statusCode).toBe(400)
    expect(response.body).toContain('decoded METAR report is required')
  })

  it('rate limits repeated requests from the same client', async () => {
    for (let index = 0; index < 10; index += 1) {
      const response = createResponseRecorder()
      await handlePilotAnalysisRequest(
        createJsonRequest(validPayload, {
          'content-type': 'application/json',
          host: 'localhost:5173',
          origin: 'http://localhost:5173',
          'x-forwarded-for': '1.2.3.4',
        }),
        response,
      )

      expect(response.statusCode).toBe(503)
      expect(response.body).toContain('Pilot analysis is not configured')
    }

    const limitedResponse = createResponseRecorder()
    await handlePilotAnalysisRequest(
      createJsonRequest(validPayload, {
        'content-type': 'application/json',
        host: 'localhost:5173',
        origin: 'http://localhost:5173',
        'x-forwarded-for': '1.2.3.4',
      }),
      limitedResponse,
    )

    expect(limitedResponse.statusCode).toBe(429)
    expect(limitedResponse.body).toContain('temporarily rate limited')
  })

  it('does not trust x-forwarded-for without a trusted forwarded host', async () => {
    const firstResponse = createResponseRecorder()
    await handlePilotAnalysisRequest(
      createJsonRequest(validPayload, {
        'content-type': 'application/json',
        host: 'localhost:5173',
        origin: 'http://localhost:5173',
        'x-forwarded-for': '1.2.3.4',
      }, '10.0.0.1'),
      firstResponse,
    )

    const secondResponse = createResponseRecorder()
    await handlePilotAnalysisRequest(
      createJsonRequest(validPayload, {
        'content-type': 'application/json',
        host: 'localhost:5173',
        origin: 'http://localhost:5173',
        'x-forwarded-for': '9.9.9.9',
      }, '10.0.0.1'),
      secondResponse,
    )

    expect(firstResponse.statusCode).toBe(503)
    expect(secondResponse.statusCode).toBe(503)
  })

  it('rejects oversized pre-parsed request bodies', async () => {
    const response = createResponseRecorder()

    await handlePilotAnalysisRequest(
      createJsonRequest(
        {
          report: {
            ...validPayload.report,
            rawMetar: `METAR ${'X'.repeat(70_000)}`,
          },
        },
        {
          'content-type': 'application/json',
          host: 'localhost:5173',
          origin: 'http://localhost:5173',
        },
      ),
      response,
    )

    expect(response.statusCode).toBe(413)
    expect(response.body).toContain('too large')
  })

  it('accepts forwarded host/proto headers and array-valued headers', async () => {
    const response = createResponseRecorder()

    await handlePilotAnalysisRequest(
      createJsonRequest(validPayload, {
        'content-type': ['application/json'],
        origin: 'https://metarx.example',
        'x-forwarded-host': 'metarx.example',
        'x-forwarded-proto': 'https',
      } as unknown as Record<string, string>),
      response,
    )

    expect(response.statusCode).toBe(503)
    expect(response.body).toContain('Pilot analysis is not configured')
  })
})

function createJsonRequest(
  body: unknown,
  headers: Record<string, string>,
  remoteAddress = '127.0.0.1',
) {
  return {
    body,
    headers,
    method: 'POST',
    socket: { remoteAddress },
    async *[Symbol.asyncIterator]() {},
  }
}

function createStreamingRequest(
  body: string,
  headers: Record<string, string>,
) {
  return {
    headers,
    method: 'POST',
    socket: { remoteAddress: '127.0.0.1' },
    async *[Symbol.asyncIterator]() {
      yield body
    },
  }
}

function createResponseRecorder() {
  const headers: Record<string, string> = {}

  return {
    body: '',
    headers,
    headersSent: false,
    statusCode: 200,
    end(chunk = '') {
      this.headersSent = true
      this.body += chunk
    },
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value
    },
    write(chunk: string) {
      this.headersSent = true
      this.body += chunk
    },
  }
}
