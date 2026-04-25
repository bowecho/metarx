import { describe, expect, it } from 'vitest'
import {
  getClientAddress,
  isAllowedOrigin,
  isJsonRequest,
  isPilotAnalysisRequest,
  readJsonBody,
  type RequestLike,
} from './request'

function createRequest(overrides: Partial<RequestLike> = {}): RequestLike {
  return {
    headers: {},
    method: 'POST',
    socket: { remoteAddress: '127.0.0.1' },
    async *[Symbol.asyncIterator]() {},
    ...overrides,
  }
}

describe('pilotAnalysis request helpers', () => {
  it('accepts json content types and rejects others', () => {
    expect(
      isJsonRequest(createRequest({ headers: { 'content-type': 'application/json; charset=utf-8' } })),
    ).toBe(true)
    expect(
      isJsonRequest(createRequest({ headers: { 'content-type': 'text/plain' } })),
    ).toBe(false)
    expect(isJsonRequest(createRequest())).toBe(false)
  })

  it('allows matching forwarded origins and local dev origins', () => {
    expect(
      isAllowedOrigin(
        createRequest({
          headers: {
            origin: 'https://metarx.example',
            'x-forwarded-host': 'metarx.example',
            'x-forwarded-proto': 'https',
          },
        }),
      ),
    ).toBe(true)

    expect(
      isAllowedOrigin(
        createRequest({
          headers: {
            host: 'metarx.example',
            origin: 'http://localhost:5173',
          },
        }),
      ),
    ).toBe(true)
  })

  it('uses forwarded addresses only for trusted forwarded hosts', () => {
    expect(
      getClientAddress(
        createRequest({
          headers: {
            'x-forwarded-for': '1.2.3.4, 5.6.7.8',
            'x-forwarded-host': 'localhost:5173',
          },
          socket: { remoteAddress: '10.0.0.1' },
        }),
      ),
    ).toBe('1.2.3.4')

    expect(
      getClientAddress(
        createRequest({
          headers: {
            'x-forwarded-for': '1.2.3.4',
          },
          socket: { remoteAddress: '10.0.0.1' },
        }),
      ),
    ).toBe('10.0.0.1')
  })

  it('enforces size limits for pre-parsed object bodies', async () => {
    await expect(
      readJsonBody(
        createRequest({
          body: { payload: 'x'.repeat(70_000) },
        }),
      ),
    ).rejects.toThrow('Pilot analysis request body is too large.')
  })

  it('parses streamed bodies and validates json', async () => {
    const parsed = await readJsonBody({
      headers: {},
      method: 'POST',
      socket: { remoteAddress: '127.0.0.1' },
      async *[Symbol.asyncIterator]() {
        yield '{"report":{"rawMetar":"METAR KJFK"}}'
      },
    })

    expect(parsed).toEqual({ report: { rawMetar: 'METAR KJFK' } })

    await expect(
      readJsonBody({
        headers: {},
        method: 'POST',
        socket: { remoteAddress: '127.0.0.1' },
        async *[Symbol.asyncIterator]() {
          yield '{bad json'
        },
      }),
    ).rejects.toThrow('Pilot analysis request body must be valid JSON.')
  })

  it('validates pilot-analysis payload shape', () => {
    expect(
      isPilotAnalysisRequest({
        report: {
          decoded: {},
          observedAt: '2026-03-05T23:00:00.000Z',
          rawMetar: 'METAR KJFK 052151Z 06009KT 2SM -DZ BR OVC006 06/05 A3022 RMK AO2',
          source: 'NOAA_AWC',
          station: { icao: 'KJFK' },
        },
      }),
    ).toBe(true)

    expect(
      isPilotAnalysisRequest({
        report: {
          decoded: {},
          observedAt: '2026-03-05T23:00:00.000Z',
          rawMetar: '',
          source: 'NOAA_AWC',
          station: { icao: 'KJFK' },
        },
      }),
    ).toBe(false)
  })
})
