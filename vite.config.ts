import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
import { handleMetarRequest } from './server/metar'
import { handlePilotAnalysisRequest } from './server/pilotAnalysis'

function metarProxyPlugin(): Plugin {
  return {
    name: 'metar-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/metar', async (request, response) => {
        await handleMetarRequest(request, response)
      })

      server.middlewares.use('/api/pilot-analysis', async (request, response) => {
        await handlePilotAnalysisRequest(request, response)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Expose Vite env files to the local dev middleware, which reads process.env.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [react(), metarProxyPlugin()],
    test: {
      coverage: {
        exclude: [
          'dist/**',
          'src/**/*.css',
          'src/assets/**',
          'src/test/**',
        ],
        provider: 'v8',
        reporter: ['text', 'html'],
        thresholds: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
      environment: 'jsdom',
      globals: false,
      setupFiles: './src/test/setup.ts',
    },
  }
})
