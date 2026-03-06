import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import {
  mapNoaaMetarResponse,
  METAR_FETCH_ERROR,
  METAR_NOT_FOUND_ERROR,
  normalizeAirportCode,
  type NoaaMetarRecord,
} from './src/lib/metar'
import { handlePilotAnalysisRequest } from './server/pilotAnalysis'

function metarProxyPlugin(): Plugin {
  return {
    name: 'metar-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/metar', async (request, response) => {
        const requestUrl = new URL(request.url ?? '/', 'http://localhost:5173')
        const airportCode = normalizeAirportCode(requestUrl.searchParams.get('code') ?? '')

        if (airportCode.length !== 4) {
          response.statusCode = 400
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ error: 'Enter a valid 4-letter ICAO airport code.' }))
          return
        }

        try {
          const upstreamResponse = await fetch(
            `https://aviationweather.gov/api/data/metar?ids=${airportCode}&format=json`,
          )

          if (upstreamResponse.status === 204) {
            response.statusCode = 404
            response.setHeader('Content-Type', 'application/json')
            response.end(JSON.stringify({ error: METAR_NOT_FOUND_ERROR }))
            return
          }

          const payload = (await upstreamResponse.json()) as NoaaMetarRecord[]

          response.statusCode = upstreamResponse.ok ? 200 : 502
          response.setHeader('Content-Type', 'application/json')
          response.end(
            JSON.stringify(
              upstreamResponse.ok
                ? mapNoaaMetarResponse(payload)
                : { error: 'Unable to retrieve a METAR for that airport right now.' },
            ),
          )
        } catch (error) {
          response.statusCode =
            error instanceof Error && error.message === METAR_NOT_FOUND_ERROR ? 404 : 502
          response.setHeader('Content-Type', 'application/json')
          response.end(
            JSON.stringify({
              error:
                error instanceof Error && error.message === METAR_NOT_FOUND_ERROR
                  ? METAR_NOT_FOUND_ERROR
                  : METAR_FETCH_ERROR,
            }),
          )
        }
      })

      server.middlewares.use('/api/pilot-analysis', async (request, response) => {
        await handlePilotAnalysisRequest(request, response)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), metarProxyPlugin()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: './src/test/setup.ts',
  },
})
