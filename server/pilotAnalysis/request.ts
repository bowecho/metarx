import type { PilotAnalysisRequest } from '../../src/lib/pilotAnalysis'

const MAX_REQUEST_BYTES = 64 * 1024
const TRUSTED_FORWARDED_HOST_HEADERS = new Set([
  'localhost:5173',
  '127.0.0.1:5173',
  'localhost:4173',
  '127.0.0.1:4173',
])

export type RequestLike = AsyncIterable<Uint8Array | string> & {
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
  method?: string
  socket?: {
    remoteAddress?: string
  }
}

export function readHeader(request: RequestLike, name: string) {
  const rawValue = request.headers?.[name]
  if (Array.isArray(rawValue)) {
    return rawValue[0]
  }

  return rawValue
}

export function isJsonRequest(request: RequestLike) {
  const contentType = readHeader(request, 'content-type')
  return typeof contentType === 'string' && contentType.includes('application/json')
}

export function isAllowedOrigin(request: RequestLike) {
  const origin = readHeader(request, 'origin')
  const host = readHeader(request, 'x-forwarded-host') ?? readHeader(request, 'host')
  const proto = readHeader(request, 'x-forwarded-proto') ?? 'https'

  if (!origin || !host) {
    return false
  }

  const allowedOrigins = new Set([
    `${proto}://${host}`,
    `http://${host}`,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ])

  return allowedOrigins.has(origin)
}

export function getClientAddress(request: RequestLike) {
  const forwardedFor = readHeader(request, 'x-forwarded-for')
  const forwardedHost = readHeader(request, 'x-forwarded-host')
  if (forwardedFor && forwardedHost && isTrustedForwardedHost(forwardedHost)) {
    return forwardedFor.split(',')[0]?.trim() ?? 'unknown'
  }

  return request.socket?.remoteAddress ?? 'unknown'
}

export async function readJsonBody(request: RequestLike) {
  if (typeof request.body === 'object' && request.body !== null) {
    if (Buffer.byteLength(JSON.stringify(request.body), 'utf8') > MAX_REQUEST_BYTES) {
      throw new Error('Pilot analysis request body is too large.')
    }

    return request.body
  }

  let rawBody = ''
  for await (const chunk of request) {
    rawBody += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')

    if (Buffer.byteLength(rawBody, 'utf8') > MAX_REQUEST_BYTES) {
      throw new Error('Pilot analysis request body is too large.')
    }
  }

  if (!rawBody) {
    return {}
  }

  try {
    return JSON.parse(rawBody) as unknown
  } catch {
    throw new Error('Pilot analysis request body must be valid JSON.')
  }
}

function isTrustedForwardedHost(value: string) {
  return TRUSTED_FORWARDED_HOST_HEADERS.has(value)
}

export function isPilotAnalysisRequest(value: unknown): value is PilotAnalysisRequest {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as {
    report?: {
      decoded?: unknown
      observedAt?: unknown
      rawMetar?: unknown
      source?: unknown
      station?: { icao?: unknown }
    }
  }

  return (
    candidate.report?.source === 'NOAA_AWC' &&
    typeof candidate.report?.observedAt === 'string' &&
    typeof candidate.report?.rawMetar === 'string' &&
    typeof candidate.report?.station?.icao === 'string' &&
    typeof candidate.report?.decoded === 'object' &&
    candidate.report.rawMetar.length > 0 &&
    candidate.report.rawMetar.length <= 512 &&
    candidate.report.station.icao.length === 4
  )
}
