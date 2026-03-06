import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the idle state', () => {
    render(<App />)

    expect(screen.getByText('MX')).toBeInTheDocument()
    expect(screen.getByText('Start with any ICAO code')).toBeInTheDocument()
  })

  it('shows a decoded METAR after a successful lookup', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        rawMetar: 'METAR KJFK 052151Z 06009KT 2SM -DZ BR OVC006 06/05 A3022 RMK AO2',
        station: {
          icao: 'KJFK',
          name: 'New York/JF Kennedy Intl, NY, US',
          lat: 40.6392,
          lon: -73.7639,
        },
        observedAt: '2026-03-05T22:00:00.000Z',
        flightCategory: 'IFR',
        source: 'NOAA_AWC',
        decoded: {
          wind: { text: '060° at 9 kt' },
          visibility: { text: '2 statute miles' },
          clouds: [],
          cloudsText: 'Overcast at 600 ft',
          temperature: { celsius: 5.6, fahrenheit: 42.1, text: '5.6°C / 42.1°F' },
          dewPoint: { celsius: 5, fahrenheit: 41, text: '5.0°C / 41.0°F' },
          altimeter: { hpa: 1023.5, inHg: 30.22, text: '1023.5 hPa / 30.22 inHg' },
          weather: { text: 'Light drizzle, Mist' },
          remarksSummary: 'automated station with precipitation discriminator',
          remarksItems: ['automated station with precipitation discriminator'],
        },
      }),
    } as Response)

    render(<App />)

    await userEvent.type(screen.getByLabelText('ICAO airport code'), 'kjfk')
    await userEvent.click(screen.getByRole('button', { name: /decode metar/i }))

    await screen.findByText('New York/JF Kennedy Intl, NY, US')
    expect(screen.getByText('Overcast at 600 ft')).toBeInTheDocument()
    expect(screen.getByText('Light drizzle, Mist')).toBeInTheDocument()
    expect(
      screen.getByText('automated station with precipitation discriminator'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('streams pilot perspective markdown on demand', async () => {
    vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rawMetar: 'METAR KJFK 052151Z 06009KT 2SM -DZ BR OVC006 06/05 A3022 RMK AO2',
          station: {
            icao: 'KJFK',
            name: 'New York/JF Kennedy Intl, NY, US',
            lat: 40.6392,
            lon: -73.7639,
          },
          observedAt: '2026-03-05T22:00:00.000Z',
          flightCategory: 'IFR',
          source: 'NOAA_AWC',
          decoded: {
            wind: { text: '060° at 9 kt' },
            visibility: { text: '2 statute miles' },
            clouds: [],
            cloudsText: 'Overcast at 600 ft',
            temperature: { celsius: 5.6, fahrenheit: 42.1, text: '5.6°C / 42.1°F' },
            dewPoint: { celsius: 5, fahrenheit: 41, text: '5.0°C / 41.0°F' },
            altimeter: { hpa: 1023.4, inHg: 30.22, text: '1023.4 hPa / 30.22 inHg' },
            weather: { text: 'Light drizzle, Mist' },
            remarksSummary: 'automated station with precipitation discriminator',
            remarksItems: ['automated station with precipitation discriminator'],
          },
        }),
      } as Response)
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

    await userEvent.click(screen.getByRole('button', { name: /pilot perspective/i }))

    await screen.findByText('Instructor-style review')
    expect(screen.getByText('Conditions Summary')).toBeInTheDocument()
    expect(
      screen.getByText('Low ceilings and reduced visibility increase workload.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Expect higher workload on departure or arrival.'),
    ).toBeInTheDocument()
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

  it('clears the previous result when a later lookup fails', async () => {
    const fetchMock = vi
      .spyOn(window, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rawMetar: 'METAR KJFK 052151Z 06009KT 2SM -DZ BR OVC006 06/05 A3022 RMK AO2',
          station: {
            icao: 'KJFK',
            name: 'New York/JF Kennedy Intl, NY, US',
            lat: 40.6392,
            lon: -73.7639,
          },
          observedAt: '2026-03-05T22:00:00.000Z',
          flightCategory: 'IFR',
          source: 'NOAA_AWC',
          decoded: {
            wind: { text: '060° at 9 kt' },
            visibility: { text: '2 statute miles' },
            clouds: [],
            cloudsText: 'Overcast at 600 ft',
            temperature: { celsius: 5.6, fahrenheit: 42.1, text: '5.6°C / 42.1°F' },
            dewPoint: { celsius: 5, fahrenheit: 41, text: '5.0°C / 41.0°F' },
            altimeter: { hpa: 1023.5, inHg: 30.22, text: '1023.5 hPa / 30.22 inHg' },
            weather: { text: 'Light drizzle, Mist' },
            remarksSummary: 'automated station with precipitation discriminator',
            remarksItems: ['automated station with precipitation discriminator'],
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'No report found.' }),
      } as Response)

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
