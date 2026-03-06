import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { streamText } from 'ai'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildPilotAnalysisPrompt,
  PILOT_ANALYSIS_MODEL,
  PILOT_ANALYSIS_SYSTEM_PROMPT,
  type PilotAnalysisRequest,
} from '../src/lib/pilotAnalysis'

const FALLBACK_ENV_PATH = '/home/tonyc/source/tonybot/.env.local'

type RequestLike = AsyncIterable<Uint8Array | string> & {
  body?: unknown
  method?: string
}

type ResponseLike = {
  end: (chunk?: string) => void
  setHeader: (name: string, value: string) => void
  statusCode: number
  write: (chunk: string) => void
  headersSent?: boolean
  flushHeaders?: () => void
}

type EnvCache = Record<string, string>

let envCache: EnvCache | null = null

export async function handlePilotAnalysisRequest(request: RequestLike, response: ResponseLike) {
  if (request.method && request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed.' })
    return
  }

  const payload = await readJsonBody(request)

  if (!isPilotAnalysisRequest(payload)) {
    sendJson(response, 400, { error: 'A decoded METAR report is required for pilot analysis.' })
    return
  }

  try {
    const apiKey = resolveEnvValue('OPENROUTER_API_KEY')
    if (!apiKey) {
      throw new Error('OpenRouter API key is not configured.')
    }

    const openrouter = createOpenRouter({ apiKey })
    const result = streamText({
      model: openrouter(PILOT_ANALYSIS_MODEL),
      temperature: 0.4,
      system: PILOT_ANALYSIS_SYSTEM_PROMPT,
      prompt: buildPilotAnalysisPrompt(payload.report),
    })

    response.statusCode = 200
    response.setHeader('Cache-Control', 'no-cache, no-transform')
    response.setHeader('Connection', 'keep-alive')
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    response.flushHeaders?.()

    for await (const chunk of result.textStream) {
      writeSseEvent(response, 'token', chunk)
    }

    writeSseEvent(response, 'done', '')
    response.end()
  } catch (error) {
    if (!response.headersSent) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : 'Pilot analysis failed.',
      })
      return
    }

    writeSseEvent(
      response,
      'error',
      error instanceof Error ? error.message : 'Pilot analysis failed.',
    )
    response.end()
  }
}

function sendJson(response: ResponseLike, statusCode: number, payload: { error: string }) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(payload))
}

function writeSseEvent(response: ResponseLike, event: string, data: string) {
  response.write(`event: ${event}\n`)
  response.write(`data: ${JSON.stringify(data)}\n\n`)
}

async function readJsonBody(request: RequestLike) {
  if (typeof request.body === 'object' && request.body !== null) {
    return request.body
  }

  let rawBody = ''
  for await (const chunk of request) {
    rawBody += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
  }

  return rawBody ? (JSON.parse(rawBody) as unknown) : {}
}

function isPilotAnalysisRequest(value: unknown): value is PilotAnalysisRequest {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as { report?: { rawMetar?: unknown; station?: { icao?: unknown } } }
  return (
    typeof candidate.report?.rawMetar === 'string' &&
    typeof candidate.report?.station?.icao === 'string'
  )
}

function resolveEnvValue(key: string) {
  if (process.env[key]) {
    return process.env[key]
  }

  if (envCache === null) {
    envCache = {
      ...readEnvFile(FALLBACK_ENV_PATH),
      ...readEnvFile(resolve(process.cwd(), '.env.local')),
    }
  }

  return envCache[key]
}

function readEnvFile(path: string) {
  if (!existsSync(path)) {
    return {}
  }

  const content = readFileSync(path, 'utf8')
  const values: EnvCache = {}

  for (const line of content.split('\n')) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex)
    const value = trimmed.slice(separatorIndex + 1).replace(/^['"]|['"]$/g, '')
    values[key] = value
  }

  return values
}
