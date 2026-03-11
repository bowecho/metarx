type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export function getBrowserStorage(): StorageLike | null {
  const candidate = globalThis as typeof globalThis & {
    localStorage?: StorageLike
  }

  return candidate.localStorage ?? null
}

export function loadStoredJson<T>(key: string, fallback: T): T {
  const storage = getBrowserStorage()
  if (!storage) {
    return fallback
  }

  try {
    const rawValue = storage.getItem(key)
    return rawValue ? (JSON.parse(rawValue) as T) : fallback
  } catch {
    return fallback
  }
}

export function loadStoredValue(key: string): string | null {
  const storage = getBrowserStorage()
  if (!storage) {
    return null
  }

  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

export function saveStoredValue(key: string, value: string) {
  const storage = getBrowserStorage()
  if (!storage) {
    return false
  }

  try {
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}
