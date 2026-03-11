export type ResponseLike = {
  end: (chunk?: string) => void
  setHeader: (name: string, value: string) => void
  statusCode: number
  write: (chunk: string) => void
  headersSent?: boolean
  flushHeaders?: () => void
}

export function sendJson(response: ResponseLike, statusCode: number, payload: { error: string }) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(payload))
}

export function openEventStream(response: ResponseLike) {
  response.statusCode = 200
  response.setHeader('Cache-Control', 'no-cache, no-transform')
  response.setHeader('Connection', 'keep-alive')
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  response.flushHeaders?.()
}

export function writeSseEvent(response: ResponseLike, event: string, data: string) {
  response.write(`event: ${event}\n`)
  response.write(`data: ${JSON.stringify(data)}\n\n`)
}
