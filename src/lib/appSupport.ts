import { METAR_FETCH_ERROR, type MetarLookupResponse } from './metar'
import {
  MAX_STORED_CODES,
  RECENT_SEARCHES_STORAGE_KEY,
  loadStoredCodes,
  upsertStoredCode,
} from './storage'

export type EventStreamHandlers = {
  onDone: () => void
  onError: (message: string) => void
  onToken: (token: string) => void
}

export function formatTrendValue(value: number | null, unitLabel: string) {
  if (value == null) {
    return 'NR'
  }

  if (unitLabel === 'ft') {
    return `${Math.round(value).toLocaleString()} ft`
  }

  if (unitLabel === 'inHg') {
    return `${value.toFixed(2)} inHg`
  }

  if (unitLabel === 'SM') {
    return formatTrendVisibility(value)
  }

  return `${Math.round(value)} ${unitLabel}`
}

export function formatTrendDelta(current: number | null, previous: number | null, unitLabel: string) {
  if (current == null || previous == null) {
    return 'No previous comparison'
  }

  const delta = current - previous
  if (Math.abs(delta) < 0.01) {
    return 'Steady from the previous report'
  }

  const prefix = delta > 0 ? '+' : ''
  if (unitLabel === 'inHg') {
    return `${prefix}${delta.toFixed(2)} ${unitLabel} vs previous`
  }

  if (unitLabel === 'ft') {
    return `${prefix}${Math.round(delta).toLocaleString()} ${unitLabel} vs previous`
  }

  if (unitLabel === 'SM') {
    return `${prefix}${delta.toFixed(2)} ${unitLabel} vs previous`
  }

  return `${prefix}${Math.round(delta)} ${unitLabel} vs previous`
}

export async function fetchMetarLookup(code: string, signal?: AbortSignal) {
  const response = await fetch(`/api/metar?code=${code}`, { signal })
  const payload = (await response.json()) as MetarLookupResponse | { error?: string }

  if (!response.ok || !('rawMetar' in payload)) {
    throw new Error('error' in payload ? payload.error : METAR_FETCH_ERROR)
  }

  return {
    ...payload,
    history: Array.isArray(payload.history) ? payload.history : [payload],
  } satisfies MetarLookupResponse
}

export function upsertLookupCodes(codes: string[]) {
  let nextRecentSearches = loadStoredCodes(RECENT_SEARCHES_STORAGE_KEY)

  for (const code of [...codes].reverse()) {
    nextRecentSearches = upsertStoredCode(RECENT_SEARCHES_STORAGE_KEY, code, MAX_STORED_CODES)
  }

  return nextRecentSearches
}

export function shouldScrollAnalysisSectionIntoView(element: HTMLElement) {
  if (typeof window === 'undefined') {
    return false
  }

  const rect = element.getBoundingClientRect()
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight

  if (viewportHeight <= 0) {
    return false
  }

  const visibleTop = Math.max(rect.top, 0)
  const visibleBottom = Math.min(rect.bottom, viewportHeight)
  const visibleHeight = Math.max(0, visibleBottom - visibleTop)
  const elementHeight = rect.height > 0 ? rect.height : Math.max(rect.bottom - rect.top, 1)
  const minimumVisibleHeight = Math.min(elementHeight, viewportHeight) * 0.6

  return visibleHeight < minimumVisibleHeight
}

export async function consumeEventStream(
  stream: ReadableStream<Uint8Array>,
  handlers: EventStreamHandlers,
) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      let separatorIndex = buffer.indexOf('\n\n')

      while (separatorIndex !== -1) {
        const block = buffer.slice(0, separatorIndex)
        buffer = buffer.slice(separatorIndex + 2)
        processEventBlock(block, handlers)
        separatorIndex = buffer.indexOf('\n\n')
      }
    }

    if (buffer.trim()) {
      processEventBlock(buffer, handlers)
    }
  } finally {
    reader.releaseLock()
  }
}

export function processEventBlock(block: string, handlers: EventStreamHandlers) {
  const lines = block.split('\n')
  let eventName = 'message'
  let data = ''

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
      continue
    }

    if (line.startsWith('data:')) {
      data += line.slice(5).trim()
    }
  }

  const parsedData = data ? (JSON.parse(data) as string) : ''

  if (eventName === 'token') {
    handlers.onToken(parsedData)
    return
  }

  if (eventName === 'error') {
    handlers.onError(parsedData || 'Pilot analysis failed.')
    return
  }

  if (eventName === 'done') {
    handlers.onDone()
  }
}

function formatTrendVisibility(value: number) {
  if (value >= 10) {
    return '10+ SM'
  }

  if (value >= 1) {
    return `${value.toFixed(value % 1 === 0 ? 0 : 1)} SM`
  }

  return `${value.toFixed(2)} SM`
}
