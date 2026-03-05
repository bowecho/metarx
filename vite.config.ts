import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { mapNoaaMetarResponse, normalizeAirportCode, type NoaaMetarRecord } from './src/lib/metar'

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
        } catch {
          response.statusCode = 502
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ error: 'Unable to retrieve a METAR for that airport right now.' }))
        }
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
