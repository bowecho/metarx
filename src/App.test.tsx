import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

type TestDecodedPayload = {
  altimeter: { hpa: number; inHg: number; text: string }
  clouds: Array<{ baseFtAgl: number | null; coverCode: string; coverLabel: string; text: string }>
  cloudsText: string
  dewPoint: { celsius: number; fahrenheit: number; text: string }
  remarksItems: string[]
  remarksSummary: string
  runwayVisualRange: { text: string }
  temperature: { celsius: number; fahrenheit: number; text: string }
  verticalVisibility: { feet?: number | null; text: string }
  visibility: { miles?: number | null; text: string }
  weather: { text: string }
  wind: { gustKt?: number | null; speedKt?: number | null; text: string }
}

type TestMetarPayload = {
  decoded: TestDecodedPayload
  flightCategory: string
  history: TestMetarPayload[]
  observedAt: string
  rawMetar: string
  source: 'NOAA_AWC'
  station: {
    icao: string
    lat: number
    lon: number
    name: string
  }
}

type TestMetarOverrides = Partial<Omit<TestMetarPayload, 'decoded' | 'history'>> & {
  decoded?: Partial<TestDecodedPayload>
  history?: TestMetarPayload[]
}

describe('App', () => {
  let scrollIntoViewMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    window.localStorage.clear()
    scrollIntoViewMock = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
      writable: true,
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the idle state', () => {
    render(<App />)

    expect(screen.getAllByText('MetarX').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'MetarX' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'MetarD' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Start with any ICAO code')).toBeInTheDocument()
  })

  it('switches personas, updates copy, and persists the selection', async () => {
    const { unmount } = render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'MetarD' }))

    expect(screen.getByText('Questionable Pilot Briefing For Dumbasses')).toBeInTheDocument()
    expect(screen.getByText('Type an ICAO code, jackass')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /commit weather crimes/i })).toBeInTheDocument()
    expect(window.localStorage.getItem('metarx:persona-mode')).toBe('metard')

    unmount()
    render(<App />)

    expect(screen.getByRole('button', { name: 'MetarD' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Questionable Pilot Briefing For Dumbasses')).toBeInTheDocument()
  })

  it('shows a decoded METAR after a successful lookup', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(createJsonResponse(createMetarPayload()))

    render(<App />)

    await userEvent.type(screen.getByLabelText('ICAO airport code'), 'kjfk')
    await userEvent.click(screen.getByRole('button', { name: /decode metar/i }))

    await screen.findByText('New York/JF Kennedy Intl, NY, US')
    expect(screen.getByText('Overcast at 600 ft')).toBeInTheDocument()
    expect(screen.getByText('Light drizzle, Mist')).toBeInTheDocument()
    expect(screen.getAllByText('Not reported')).toHaveLength(2)
    expect(
      screen.getByText('automated station with precipitation discriminator'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()

    const analysisSection = screen.getByRole('region', { name: 'Pilot perspective' })
    expect(within(analysisSection).getByText(/generate an instructor-style read on this metar/i))
      .toBeInTheDocument()
    expect(within(analysisSection).getByRole('button', { name: /pilot perspective/i }))
      .toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /pilot perspective/i })).toHaveLength(1)
  })

  it('streams pilot perspective markdown on demand', async () => {
    vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce(createJsonResponse(createMetarPayload()))
      .mockResolvedValueOnce(createStreamingResponse([
        'event: token\ndata: "## Conditions Summary\\n"\n\n',
        'event: token\ndata: "Low ceilings and reduced visibility increase workload.\\n\\n"\n\n',
        'event: token\ndata: "## Key Cautions\\n- Expect higher workload on departure or arrival."\n\n',
        'event: done\ndata: ""\n\n',
      ]))

    render(<App />)

    await userEvent.type(screen.getByLabelText('ICAO airport code'), 'kjfk')
    await userEvent.click(screen.getByRole('button', { name: /decode metar/i }))
    await screen.findByText('New York/JF Kennedy Intl, NY, US')

    const analysisSection = screen.getByRole('region', { name: 'Pilot perspective' })
    mockElementRect(analysisSection, { top: 1200, bottom: 1600, height: 400 })

    await userEvent.click(within(analysisSection).getByRole('button', { name: /pilot perspective/i }))

    expect(screen.getByText('Conditions Summary')).toBeInTheDocument()
    expect(
      screen.getByText('Low ceilings and reduced visibility increase workload.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Expect higher workload on departure or arrival.'),
    ).toBeInTheDocument()
    expect(within(analysisSection).getByRole('button', { name: /refresh perspective/i }))
      .toBeInTheDocument()
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('does not auto-scroll when the pilot perspective section is already visible', async () => {
    vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce(createJsonResponse(createMetarPayload()))
      .mockResolvedValueOnce(createStreamingResponse([
        'event: token\ndata: "## Conditions Summary\\nVisible section."\n\n',
        'event: done\ndata: ""\n\n',
      ]))

    render(<App />)

    await userEvent.type(screen.getByLabelText('ICAO airport code'), 'kjfk')
    await userEvent.click(screen.getByRole('button', { name: /decode metar/i }))
    await screen.findByText('New York/JF Kennedy Intl, NY, US')

    const analysisSection = screen.getByRole('region', { name: 'Pilot perspective' })
    mockElementRect(analysisSection, { top: 120, bottom: 420, height: 300 })

    await userEvent.click(within(analysisSection).getByRole('button', { name: /pilot perspective/i }))

    await screen.findByText('Conditions Summary')
    expect(scrollIntoViewMock).not.toHaveBeenCalled()
  })

  it('shows an inline analysis error and allows retry', async () => {
    vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce(createJsonResponse(createMetarPayload()))
      .mockResolvedValueOnce(createJsonResponse({ error: 'Pilot analysis failed.' }, false))
      .mockResolvedValueOnce(createStreamingResponse([
        'event: token\ndata: "## Conditions Summary\\nRetry worked."\n\n',
        'event: done\ndata: ""\n\n',
      ]))

    render(<App />)

    await userEvent.type(screen.getByLabelText('ICAO airport code'), 'kjfk')
    await userEvent.click(screen.getByRole('button', { name: /decode metar/i }))
    await screen.findByText('New York/JF Kennedy Intl, NY, US')

    const analysisSection = screen.getByRole('region', { name: 'Pilot perspective' })
    mockElementRect(analysisSection, { top: 120, bottom: 420, height: 300 })

    await userEvent.click(within(analysisSection).getByRole('button', { name: /pilot perspective/i }))

    await screen.findByText('Pilot analysis failed.')
    await userEvent.click(within(analysisSection).getByRole('button', { name: /retry perspective/i }))

    await screen.findByText('Retry worked.')
    expect(within(analysisSection).queryByText('Pilot analysis failed.')).not.toBeInTheDocument()
  })

  it('shows an error message when the lookup fails', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'No report found.' }),
    } as Response)

    render(<App />)

    await userEvent.type(screen.getByLabelText('ICAO airport code'), 'zzzz')
    await userEvent.click(screen.getByRole('button', { name: /decode metar/i }))

    await screen.findByText('Lookup failed')
    expect(screen.getByText('No report found.')).toBeInTheDocument()
  })

  it('renders runway visual range, vertical visibility, and gusting wind when present', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(
      createJsonResponse(createMetarPayload({
        rawMetar:
          'METAR KJFK 072351Z 18008G18KT 1/4SM R04R/4500FT -DZ FG VV003 06/06 A2997 RMK AO2',
        decoded: {
          wind: { text: '180° at 8 kt gusting 18 kt' },
          visibility: { text: '0.25 statute miles' },
          runwayVisualRange: { text: '04R: 4,500 ft' },
          verticalVisibility: { text: '300 ft' },
          clouds: [],
          cloudsText: 'No cloud layers reported',
          temperature: { celsius: 5.6, fahrenheit: 42.1, text: '5.6°C / 42.1°F' },
          dewPoint: { celsius: 5.6, fahrenheit: 42.1, text: '5.6°C / 42.1°F' },
          altimeter: { hpa: 1015, inHg: 29.97, text: '1015.0 hPa / 29.97 inHg' },
          weather: { text: 'Light drizzle, Fog' },
          remarksSummary: 'automated station with precipitation discriminator',
          remarksItems: ['automated station with precipitation discriminator'],
        },
      })),
    )

    render(<App />)

    await userEvent.type(screen.getByLabelText('ICAO airport code'), 'kjfk')
    await userEvent.click(screen.getByRole('button', { name: /decode metar/i }))

    await screen.findByText('04R: 4,500 ft')
    expect(screen.getByText('300 ft')).toBeInTheDocument()
    expect(screen.getByText('180° at 8 kt gusting 18 kt')).toBeInTheDocument()
    expect(screen.getByText('No cloud layers reported')).toBeInTheDocument()
    expect(screen.queryByText('OVX at 300 ft')).not.toBeInTheDocument()
  })

  it('renders deterministic watchouts and a recent trend strip after lookup', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(
      createJsonResponse(
        createMetarPayload({
          decoded: {
            clouds: [{ baseFtAgl: 600, coverCode: 'OVC', coverLabel: 'Overcast', text: 'Overcast at 600 ft' }],
            cloudsText: 'Overcast at 600 ft',
          },
          history: [
            createBaseMetarPayload({
              observedAt: '2026-03-05T20:00:00.000Z',
              flightCategory: 'MVFR',
              decoded: {
                visibility: { text: '4 statute miles', miles: 4 },
                cloudsText: 'Broken at 1,800 ft',
                clouds: [{ baseFtAgl: 1800, coverCode: 'BKN', coverLabel: 'Broken', text: 'Broken at 1,800 ft' }],
                wind: { text: '040° at 8 kt', speedKt: 8, gustKt: null },
                altimeter: { hpa: 1022.1, inHg: 30.18, text: '1022.1 hPa / 30.18 inHg' },
              },
            }),
            createBaseMetarPayload({
              observedAt: '2026-03-05T21:00:00.000Z',
            }),
          ],
        }),
      ),
    )

    render(<App />)

    await userEvent.type(screen.getByLabelText('ICAO airport code'), 'kjfk')
    await userEvent.click(screen.getByRole('button', { name: /decode metar/i }))

    await screen.findByText('Trend strip')
    expect(screen.getByText('Why this matters')).toBeInTheDocument()
    expect(screen.getByText('Visibility is reduced')).toBeInTheDocument()
    expect(screen.getByText('Low-level obscuration is in play')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Trend strip' })).toBeInTheDocument()
  })

  it('compares two airports side by side', async () => {
    vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce(createJsonResponse(createMetarPayload()))
      .mockResolvedValueOnce(
        createJsonResponse(
          createMetarPayload({
            rawMetar: 'METAR KAUS 052151Z 02011KT 10SM SCT025 BKN040 18/11 A3008 RMK AO2',
            station: {
              icao: 'KAUS',
              name: 'Austin/Bergstrom Intl, TX, US',
              lat: 30.1831,
              lon: -97.6806,
            },
            flightCategory: 'VFR',
            decoded: {
              wind: { text: '020° at 11 kt', speedKt: 11, gustKt: null },
              visibility: { text: '10 statute miles', miles: 10 },
              runwayVisualRange: { text: 'Not reported' },
              verticalVisibility: { text: 'Not reported', feet: null },
              clouds: [{ coverCode: 'SCT', coverLabel: 'Scattered', baseFtAgl: 2500, text: 'Scattered at 2,500 ft' }],
              cloudsText: 'Scattered at 2,500 ft, Broken at 4,000 ft',
              temperature: { celsius: 18, fahrenheit: 64.4, text: '18.0°C / 64.4°F' },
              dewPoint: { celsius: 11, fahrenheit: 51.8, text: '11.0°C / 51.8°F' },
              altimeter: { hpa: 1018.3, inHg: 30.08, text: '1018.3 hPa / 30.08 inHg' },
              weather: { text: 'No significant weather reported' },
              remarksSummary: 'automated station with precipitation discriminator',
              remarksItems: ['automated station with precipitation discriminator'],
            },
            history: [],
          }),
        ),
      )

    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /compare airports/i }))
    await userEvent.type(screen.getByLabelText('ICAO airport code'), 'kjfk')
    await userEvent.type(screen.getByLabelText('Compare against another ICAO airport'), 'kaus')
    await userEvent.click(screen.getByRole('button', { name: /decode metar/i }))

    await screen.findByText('New York/JF Kennedy Intl, NY, US')
    expect(screen.getByText('Austin/Bergstrom Intl, TX, US')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Pilot perspective' })).not.toBeInTheDocument()
  })

  it('uses the metard persona for copy and pilot-analysis requests without clearing results', async () => {
    const fetchMock = vi
      .spyOn(window, 'fetch')
      .mockResolvedValueOnce(createJsonResponse(createMetarPayload()))
      .mockResolvedValueOnce(createStreamingResponse([
        'event: token\ndata: "## Conditions Summary\\nGoblin mode engaged."\n\n',
        'event: done\ndata: ""\n\n',
      ]))

    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'MetarD' }))
    await userEvent.type(screen.getByLabelText('ICAO airport code'), 'kjfk')
    await userEvent.click(screen.getByRole('button', { name: /commit weather crimes/i }))
    await screen.findByText('New York/JF Kennedy Intl, NY, US')

    expect(screen.getByText('Current sky stupidity')).toBeInTheDocument()
    expect(screen.getByText('Recent stupid ideas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /humiliate me/i })).toBeInTheDocument()

    const analysisSection = screen.getByRole('region', { name: 'Idiot advisory desk' })
    mockElementRect(analysisSection, { top: 1200, bottom: 1600, height: 400 })

    await userEvent.click(within(analysisSection).getByRole('button', { name: /humiliate me/i }))

    await screen.findByText('Goblin mode engaged.')
    expect(screen.getByText('New York/JF Kennedy Intl, NY, US')).toBeInTheDocument()

    const analysisRequest = fetchMock.mock.calls[1]
    expect(analysisRequest?.[0]).toBe('/api/pilot-analysis')
    expect(JSON.parse(String((analysisRequest?.[1] as RequestInit).body))).toMatchObject({
      personaMode: 'metard',
    })
  })

  it('keeps pilot perspectives separate for metarx and metard when toggling personas', async () => {
    const fetchMock = vi
      .spyOn(window, 'fetch')
      .mockResolvedValueOnce(createJsonResponse(createMetarPayload()))
      .mockResolvedValueOnce(createStreamingResponse([
        'event: token\ndata: "## Conditions Summary\\nGoblin weather rant."\n\n',
        'event: done\ndata: ""\n\n',
      ]))
      .mockResolvedValueOnce(createStreamingResponse([
        'event: token\ndata: "## Conditions Summary\\nProfessional weather brief."\n\n',
        'event: done\ndata: ""\n\n',
      ]))

    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'MetarD' }))
    await userEvent.type(screen.getByLabelText('ICAO airport code'), 'kjfk')
    await userEvent.click(screen.getByRole('button', { name: /commit weather crimes/i }))
    await screen.findByText('New York/JF Kennedy Intl, NY, US')

    let analysisSection = screen.getByRole('region', { name: 'Idiot advisory desk' })
    mockElementRect(analysisSection, { top: 1200, bottom: 1600, height: 400 })
    await userEvent.click(within(analysisSection).getByRole('button', { name: /humiliate me/i }))

    await screen.findByText('Goblin weather rant.')

    await userEvent.click(screen.getByRole('button', { name: 'MetarX' }))

    analysisSection = screen.getByRole('region', { name: 'Pilot perspective' })
    expect(screen.queryByText('Goblin weather rant.')).not.toBeInTheDocument()
    expect(within(analysisSection).getByRole('button', { name: /pilot perspective/i }))
      .toBeInTheDocument()

    mockElementRect(analysisSection, { top: 1200, bottom: 1600, height: 400 })
    await userEvent.click(within(analysisSection).getByRole('button', { name: /pilot perspective/i }))

    await screen.findByText('Professional weather brief.')

    await userEvent.click(screen.getByRole('button', { name: 'MetarD' }))

    analysisSection = screen.getByRole('region', { name: 'Idiot advisory desk' })
    expect(screen.getByText('Goblin weather rant.')).toBeInTheDocument()
    expect(screen.queryByText('Professional weather brief.')).not.toBeInTheDocument()

    expect(JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body))).toMatchObject({
      personaMode: 'metard',
    })
    expect(JSON.parse(String((fetchMock.mock.calls[2][1] as RequestInit).body))).toMatchObject({
      personaMode: 'metarx',
    })
  })

  it('clears the previous result when a later lookup fails', async () => {
    const fetchMock = vi
      .spyOn(window, 'fetch')
      .mockResolvedValueOnce(createJsonResponse(createMetarPayload()))
      .mockResolvedValueOnce(createJsonResponse({ error: 'No report found.' }, false))

    render(<App />)

    await userEvent.type(screen.getByLabelText('ICAO airport code'), 'kjfk')
    await userEvent.click(screen.getByRole('button', { name: /decode metar/i }))
    await screen.findByText('New York/JF Kennedy Intl, NY, US')

    const input = screen.getByLabelText('ICAO airport code')
    await userEvent.clear(input)
    await userEvent.type(input, 'zzzz')
    await userEvent.click(screen.getByRole('button', { name: /decode metar/i }))

    await screen.findByText('Lookup failed')
    expect(screen.queryByText('New York/JF Kennedy Intl, NY, US')).not.toBeInTheDocument()
    expect(screen.getByText('No report found.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('cycles theme mode when the theme button is pressed', async () => {
    render(<App />)

    const themeButton = screen.getByRole('button', { name: /theme mode:/i })
    expect(themeButton).toHaveAttribute('title', 'Theme: dark (auto)')

    await userEvent.click(themeButton)

    await waitFor(() => {
      expect(window.localStorage.getItem('metarx:theme-mode')).toBe('light')
    })

    expect(screen.getByRole('button', { name: /theme mode:/i })).toHaveAttribute(
      'title',
      'Theme: light',
    )
  })
})

function createStreamingResponse(chunks: string[]) {
  const encoder = new TextEncoder()

  return {
    ok: true,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk))
        }
        controller.close()
      },
    }),
  } as Response
}

function createJsonResponse(payload: unknown, ok = true) {
  return {
    ok,
    json: async () => payload,
  } as Response
}

function createMetarPayload(
  overrides: TestMetarOverrides = {},
) {
  const basePayload = createBaseMetarPayload()

  return {
    ...basePayload,
    ...overrides,
    station: {
      ...basePayload.station,
      ...overrides.station,
    },
    decoded: {
      ...basePayload.decoded,
      ...overrides.decoded,
    },
    history: overrides.history ?? basePayload.history,
  }
}

function createBaseMetarPayload(
  overrides: TestMetarOverrides = {},
) {
  const baseDecoded: TestDecodedPayload = {
    wind: { text: '060° at 9 kt', speedKt: 9, gustKt: null },
    visibility: { text: '2 statute miles', miles: 2 },
    runwayVisualRange: { text: 'Not reported' },
    verticalVisibility: { text: 'Not reported', feet: null },
    clouds: [],
    cloudsText: 'Overcast at 600 ft',
    temperature: { celsius: 5.6, fahrenheit: 42.1, text: '5.6°C / 42.1°F' },
    dewPoint: { celsius: 5, fahrenheit: 41, text: '5.0°C / 41.0°F' },
    altimeter: { hpa: 1023.5, inHg: 30.22, text: '1023.5 hPa / 30.22 inHg' },
    weather: { text: 'Light drizzle, Mist' },
    remarksSummary: 'automated station with precipitation discriminator',
    remarksItems: ['automated station with precipitation discriminator'],
  }

  return {
    rawMetar: 'METAR KJFK 052151Z 06009KT 2SM -DZ BR OVC006 06/05 A3022 RMK AO2',
    station: {
      icao: 'KJFK',
      name: 'New York/JF Kennedy Intl, NY, US',
      lat: 40.6392,
      lon: -73.7639,
    },
    observedAt: overrides.observedAt ?? '2026-03-05T22:00:00.000Z',
    flightCategory: overrides.flightCategory ?? 'IFR',
    source: 'NOAA_AWC',
    decoded: {
      ...baseDecoded,
      ...overrides.decoded,
    },
    history: overrides.history ?? [],
  } satisfies TestMetarPayload
}

function mockElementRect(
  element: Element,
  rect: Pick<DOMRect, 'bottom' | 'height' | 'top'>,
) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () =>
      ({
        bottom: rect.bottom,
        height: rect.height,
        left: 0,
        right: 0,
        top: rect.top,
        width: 0,
        x: 0,
        y: rect.top,
        toJSON: () => ({}),
      }) satisfies DOMRect,
  })
}
