const PILOT_ANALYSIS_RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 60_000,
}

const rateLimitState = new Map<string, { count: number; resetAt: number }>()

export function consumePilotAnalysisRateLimit(key: string) {
  const now = Date.now()
  const current = rateLimitState.get(key)

  if (!current || current.resetAt <= now) {
    rateLimitState.set(key, {
      count: 1,
      resetAt: now + PILOT_ANALYSIS_RATE_LIMIT.windowMs,
    })
    pruneExpiredRateLimits(now)
    return true
  }

  if (current.count >= PILOT_ANALYSIS_RATE_LIMIT.maxRequests) {
    return false
  }

  current.count += 1
  return true
}

export function resetPilotAnalysisRateLimit() {
  rateLimitState.clear()
}

function pruneExpiredRateLimits(now: number) {
  for (const [key, value] of rateLimitState.entries()) {
    if (value.resetAt <= now) {
      rateLimitState.delete(key)
    }
  }
}
