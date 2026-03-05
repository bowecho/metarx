export const RECENT_SEARCHES_STORAGE_KEY = 'metarx:recent-searches'
export const FAVORITES_STORAGE_KEY = 'metarx:favorites'

export function loadStoredCodes(key: string) {
  if (typeof window === 'undefined') {
    return [] as string[]
  }

  try {
    const rawValue = window.localStorage.getItem(key)
    const parsedValue = rawValue ? (JSON.parse(rawValue) as unknown) : []

    return Array.isArray(parsedValue)
      ? parsedValue.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

export function upsertStoredCode(key: string, value: string, maxItems: number) {
  const existing = loadStoredCodes(key).filter((item) => item !== value)
  const nextValues = [value, ...existing].slice(0, maxItems)
  persistCodes(key, nextValues)
  return nextValues
}

export function toggleStoredCode(key: string, value: string, maxItems: number) {
  const existing = loadStoredCodes(key)
  const nextValues = existing.includes(value)
    ? existing.filter((item) => item !== value)
    : [value, ...existing].slice(0, maxItems)

  persistCodes(key, nextValues)
  return nextValues
}

function persistCodes(key: string, value: string[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}
