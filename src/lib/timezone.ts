import tzLookup from 'tz-lookup'

type Coordinates = {
  lat: number
  lon: number
}

const timezoneCache = new Map<string, string>()

export function getAirportTimeZone({ lat, lon }: Coordinates) {
  const cacheKey = `${lat}:${lon}`
  const cachedTimeZone = timezoneCache.get(cacheKey)

  if (cachedTimeZone) {
    return cachedTimeZone
  }

  try {
    const timeZone = tzLookup(lat, lon)
    timezoneCache.set(cacheKey, timeZone)
    return timeZone
  } catch {
    return 'UTC'
  }
}

export function formatAirportDateTime(value: string, coordinates: Coordinates) {
  const timeZone = getAirportTimeZone(coordinates)

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    timeZone,
    timeZoneName: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatAirportTime(value: string, coordinates: Coordinates) {
  const timeZone = getAirportTimeZone(coordinates)

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  }).format(new Date(value))
}
