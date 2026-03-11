import { loadStoredJson, saveStoredValue } from './browserStorage'

export const MAX_STORED_CODES = 6
export const RECENT_SEARCHES_STORAGE_KEY = 'metarx:recent-searches'
export const FAVORITES_STORAGE_KEY = 'metarx:favorites'

export function loadStoredCodes(key: string) {
  const parsedValue = loadStoredJson<unknown>(key, [])

  return Array.isArray(parsedValue)
    ? parsedValue.filter((item): item is string => typeof item === 'string')
    : []
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
  saveStoredValue(key, JSON.stringify(value))
}
