import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  wind: { directionDegrees?: number | 'VRB' | null; gustKt?: number | null; speedKt?: number | null; text: string }
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
    expect(screen.getByText('Start with any ICAO code')).toBeInTheDocument()
  })

  it('does not render a persona switcher', () => {
    render(<App />)

    expect(screen.queryByRole('group', { name: /persona mode/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'MetarZ' })).not.toBeInTheDocument()
  })

  it('shows a decoded METAR after a successful lookup', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(createJsonResponse(createMetarPayload()))

    render(<App />)

    await userEvent.type(screen.getByLabelText('ICAO airport code'), 'kjfk')
    await userEvent.click(screen.getByRole('button', { name: /decode metar/i }))

    await screen.findByText('New York/JF Kennedy Intl, NY, US')
    expect(screen.getByText(/Mar 5, 2026, 5:00 PM EST/)).toBeInTheDocument()
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
    expect(
      within(analysisSection).queryByRole('button', { name: /collapse pilot perspective/i }),
    ).not.toBeInTheDocument()
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

    expect(await screen.findByText(/Conditions Summary/)).toBeInTheDocument()
    expect(
      await screen.findByText(/Low ceilings and reduced visibility increase workload/),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/Expect higher workload on departure or arrival/),
    ).toBeInTheDocument()
    expect(
      within(analysisSection).getByRole('button', { name: /collapse pilot perspective/i }),
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

  it('renders streamed analysis errors and handles unterminated event buffers', async () => {
    vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce(createJsonResponse(createMetarPayload()))
      .mockResolvedValueOnce(createStreamingResponse([
        'event: token\ndata: "## Conditions Summary\\nPartial token"',
        '\n\nevent: error\ndata: ""',
      ]))

    render(<App />)

    await userEvent.type(screen.getByLabelText('ICAO airport code'), 'kjfk')
    await userEvent.click(screen.getByRole('button', { name: /decode metar/i }))
    await screen.findByText('New York/JF Kennedy Intl, NY, US')

    const analysisSection = screen.getByRole('region', { name: 'Pilot perspective' })
    mockElementRect(analysisSection, { top: 120, bottom: 420, height: 300 })

    await userEvent.click(within(analysisSection).getByRole('button', { name: /pilot perspective/i }))

    await screen.findByText('Pilot analysis failed.')
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

  it('collapses and re-expands report sections', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(createJsonResponse(createMetarPayload()))

    render(<App />)

    await userEvent.type(screen.getByLabelText('ICAO airport code'), 'kjfk')
    await userEvent.click(screen.getByRole('button', { name: /decode metar/i }))

    const remarksHeading = await screen.findByText('Decoded remarks')
    const remarksSection = remarksHeading.closest('section')

    expect(remarksSection).not.toBeNull()
    expect(screen.getByText('automated station with precipitation discriminator')).toBeInTheDocument()

    await userEvent.click(
      within(remarksSection as HTMLElement).getByRole('button', { name: /collapse operational notes/i }),
    )

    await waitFor(() => {
      expect(screen.queryByText('automated station with precipitation discriminator')).not.toBeInTheDocument()
    })
    expect(
      within(remarksSection as HTMLElement).getByRole('button', { name: /expand operational notes/i }),
    ).toBeInTheDocument()

    await userEvent.click(
      within(remarksSection as HTMLElement).getByRole('button', { name: /expand operational notes/i }),
    )

    expect(screen.getByText('automated station with precipitation discriminator')).toBeInTheDocument()
  })

  it('renders the expanded recent trend strip after lookup', async () => {
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
                wind: { text: '040° at 8 kt', directionDegrees: 40, speedKt: 8, gustKt: null },
                altimeter: { hpa: 1022.1, inHg: 30.18, text: '1022.1 hPa / 30.18 inHg' },
              },
            }),
            createBaseMetarPayload({
              observedAt: '2026-03-05T21:00:00.000Z',
              decoded: {
                wind: { text: '090° at 12 kt gusting 18 kt', directionDegrees: 90, speedKt: 12, gustKt: 18 },
              },
            }),
            createBaseMetarPayload({
              observedAt: '2026-03-05T22:00:00.000Z',
              decoded: {
                wind: { text: '180° at 18 kt gusting 28 kt', directionDegrees: 180, speedKt: 18, gustKt: 28 },
              },
            }),
          ],
        }),
      ),
    )

    render(<App />)

    await userEvent.type(screen.getByLabelText('ICAO airport code'), 'kjfk')
    await userEvent.click(screen.getByRole('button', { name: /decode metar/i }))

    await screen.findByText('Trend strip')
    expect(screen.getByText(/Trend summary:/i)).toBeInTheDocument()
    expect(screen.getByText(/wind veering from 040° to 180°, speed building, gusts building to 28 kt/i)).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Trend strip' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Visibility trend graph' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Ceiling trend graph' })).toBeInTheDocument()
    expect(screen.getByText('180° 18 kt G28')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Wind trend graph' })).not.toBeInTheDocument()
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

  it('fills the compare field from recent searches when that input is focused', async () => {
    window.localStorage.setItem('metarx:recent-searches', JSON.stringify(['KAUS', 'KJFK']))

    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /compare airports/i }))

    const primaryInput = screen.getByLabelText('ICAO airport code')
    const compareInput = screen.getByLabelText('Compare against another ICAO airport')

    await userEvent.type(primaryInput, 'kjfk')
    await userEvent.click(compareInput)
    await userEvent.click(screen.getByRole('button', { name: 'KAUS' }))

    expect(primaryInput).toHaveValue('KJFK')
    expect(compareInput).toHaveValue('KAUS')
  })

  it('does not allow selecting the same airport into both compare fields from saved chips', async () => {
    window.localStorage.setItem('metarx:recent-searches', JSON.stringify(['KJFK']))

    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /compare airports/i }))

    const primaryInput = screen.getByLabelText('ICAO airport code')
    const compareInput = screen.getByLabelText('Compare against another ICAO airport')

    await userEvent.type(primaryInput, 'kjfk')
    await userEvent.click(compareInput)
    await userEvent.click(screen.getByRole('button', { name: 'KJFK' }))

    expect(primaryInput).toHaveValue('KJFK')
    expect(compareInput).toHaveValue('')
  })

  it('sends only the report in pilot-analysis requests', async () => {
    const fetchMock = vi
      .spyOn(window, 'fetch')
      .mockResolvedValueOnce(createJsonResponse(createMetarPayload()))
      .mockResolvedValueOnce(createStreamingResponse([
        'event: token\ndata: "## Conditions Summary\\nProfessional weather brief."\n\n',
        'event: done\ndata: ""\n\n',
      ]))

    render(<App />)

    await userEvent.type(screen.getByLabelText('ICAO airport code'), 'kjfk')
    await userEvent.click(screen.getByRole('button', { name: /decode metar/i }))
    await screen.findByText('New York/JF Kennedy Intl, NY, US')

    const analysisSection = screen.getByRole('region', { name: 'Pilot perspective' })
    mockElementRect(analysisSection, { top: 1200, bottom: 1600, height: 400 })
    await userEvent.click(within(analysisSection).getByRole('button', { name: /pilot perspective/i }))

    await screen.findByText('Professional weather brief.')

    const analysisRequest = fetchMock.mock.calls[1]
    expect(analysisRequest?.[0]).toBe('/api/pilot-analysis')
    expect(JSON.parse(String((analysisRequest?.[1] as RequestInit).body))).not.toHaveProperty('personaMode')
    expect(JSON.parse(String((analysisRequest?.[1] as RequestInit).body))).toHaveProperty('report')
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

  it('keeps the latest lookup result when an older request resolves afterward', async () => {
    const firstLookup = createDeferredResponse()
    const secondLookup = createDeferredResponse()

    vi.spyOn(window, 'fetch')
      .mockImplementationOnce(() => firstLookup.promise)
      .mockImplementationOnce(() => secondLookup.promise)

    render(<App />)

    const input = screen.getByLabelText('ICAO airport code')
    await userEvent.type(input, 'kjfk')
    await userEvent.click(screen.getByRole('button', { name: /decode metar/i }))

    await userEvent.clear(input)
    await userEvent.type(input, 'kaus')
    fireEvent.submit(input.closest('form') as HTMLFormElement)

    secondLookup.resolve(
      createJsonResponse(
        createMetarPayload({
          station: {
            icao: 'KAUS',
            lat: 30.1831,
            lon: -97.6806,
            name: 'Austin/Bergstrom Intl, TX, US',
          },
          rawMetar: 'METAR KAUS 052151Z 02011KT 10SM SCT025 BKN040 18/11 A3008 RMK AO2',
        }),
      ),
    )

    await screen.findByText('Austin/Bergstrom Intl, TX, US')

    firstLookup.resolve(createJsonResponse(createMetarPayload()))

    await waitFor(() => {
      expect(screen.queryByText('New York/JF Kennedy Intl, NY, US')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Austin/Bergstrom Intl, TX, US')).toBeInTheDocument()
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

function createDeferredResponse() {
  let resolve!: (value: Response) => void

  return {
    promise: new Promise<Response>((nextResolve) => {
      resolve = nextResolve
    }),
    resolve,
  }
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
    wind: { text: '060° at 9 kt', directionDegrees: 60, speedKt: 9, gustKt: null },
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
