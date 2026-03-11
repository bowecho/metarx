import { describe, expect, it, vi } from 'vitest'
import {
  consumeEventStream,
  fetchMetarLookup,
  formatTrendDelta,
  formatTrendValue,
  processEventBlock,
  shouldScrollAnalysisSectionIntoView,
  upsertLookupCodes,
} from './appSupport'

describe('appSupport helpers', () => {
  it('formats trend values and deltas across unit branches', () => {
    expect(formatTrendValue(null, 'ft')).toBe('NR')
    expect(formatTrendValue(1200, 'ft')).toBe('1,200 ft')
    expect(formatTrendValue(29.92, 'inHg')).toBe('29.92 inHg')
    expect(formatTrendValue(10, 'SM')).toBe('10+ SM')
    expect(formatTrendValue(0.5, 'SM')).toBe('0.50 SM')
    expect(formatTrendValue(14.2, 'kt')).toBe('14 kt')

    expect(formatTrendDelta(null, 1, 'ft')).toBe('No previous comparison')
    expect(formatTrendDelta(10, 10, 'ft')).toBe('Steady from the previous report')
    expect(formatTrendDelta(30.01, 30, 'inHg')).toBe('+0.01 inHg vs previous')
    expect(formatTrendDelta(1200, 1000, 'ft')).toBe('+200 ft vs previous')
    expect(formatTrendDelta(2.5, 1.25, 'SM')).toBe('+1.25 SM vs previous')
    expect(formatTrendDelta(12, 15, 'kt')).toBe('-3 kt vs previous')
  })

  it('normalizes METAR lookup responses and errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            rawMetar: 'METAR KJFK',
            history: null,
            station: { icao: 'KJFK' },
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'No report found.' }),
        }),
    )

    await expect(fetchMetarLookup('KJFK')).resolves.toMatchObject({
      history: [{ rawMetar: 'METAR KJFK', station: { icao: 'KJFK' } }],
    })
    await expect(fetchMetarLookup('ZZZZ')).rejects.toThrow('No report found.')
  })

  it('updates recent lookups in reverse insertion order', () => {
    window.localStorage.clear()

    expect(upsertLookupCodes(['KJFK', 'KAUS'])).toEqual(['KJFK', 'KAUS'])
  })

  it('decides whether to scroll the analysis section into view', () => {
    const element = {
      getBoundingClientRect: () => ({
        top: 900,
        bottom: 1200,
        height: 300,
      }),
    } as HTMLElement

    const originalInnerHeight = window.innerHeight
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 0,
    })
    expect(shouldScrollAnalysisSectionIntoView(element)).toBe(false)

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 800,
    })
    expect(shouldScrollAnalysisSectionIntoView(element)).toBe(true)

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    })
  })

  it('processes event blocks and trailing event stream buffers', async () => {
    const handlers = {
      onDone: vi.fn(),
      onError: vi.fn(),
      onToken: vi.fn(),
    }

    processEventBlock('event: token\ndata: "hello"', handlers)
    processEventBlock('event: error\ndata: ""', handlers)
    processEventBlock('event: done\ndata: ""', handlers)
    processEventBlock('data: "ignored"', handlers)

    expect(handlers.onToken).toHaveBeenCalledWith('hello')
    expect(handlers.onError).toHaveBeenCalledWith('Pilot analysis failed.')
    expect(handlers.onDone).toHaveBeenCalledTimes(1)

    const encoder = new TextEncoder()
    await consumeEventStream(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('event: token\ndata: "chunk-1"\n\n'))
          controller.enqueue(encoder.encode('event: done\ndata: ""'))
          controller.close()
        },
      }),
      handlers,
    )

    expect(handlers.onToken).toHaveBeenCalledWith('chunk-1')
    expect(handlers.onDone).toHaveBeenCalledTimes(2)
  })
})
