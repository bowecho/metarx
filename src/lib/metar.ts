export const METAR_FETCH_ERROR = 'Unable to retrieve a METAR for that airport right now.'

const COVER_LABELS: Record<string, string> = {
  CLR: 'Clear',
  FEW: 'Few clouds',
  SCT: 'Scattered',
  BKN: 'Broken',
  OVC: 'Overcast',
  VV: 'Vertical visibility',
}

const FLIGHT_CATEGORY_LABELS: Record<string, string> = {
  VFR: 'VFR',
  MVFR: 'MVFR',
  IFR: 'IFR',
  LIFR: 'LIFR',
}

type NullableNumber = number | null | undefined

export type Measurement = {
  celsius: number | null
  fahrenheit: number | null
  text: string
}

export type DecodedTextBlock = {
  text: string
}

export type CloudLayer = {
  coverCode: string
  coverLabel: string
  baseFtAgl: number | null
  text: string
}

export type MetarReport = {
  rawMetar: string
  station: {
    icao: string
    name: string
    lat: number
    lon: number
  }
  observedAt: string
  flightCategory: string | null
  source: 'NOAA_AWC'
  decoded: {
    wind: DecodedTextBlock
    visibility: DecodedTextBlock
    clouds: CloudLayer[]
    cloudsText: string
    temperature: Measurement
    dewPoint: Measurement
    altimeter: {
      hpa: number | null
      inHg: number | null
      text: string
    }
    weather: DecodedTextBlock
    remarksSummary: string
    remarksItems: string[]
  }
}

export type NoaaMetarRecord = {
  icaoId?: string
  rawOb?: string
  reportTime?: string
  fltCat?: string
  temp?: number | null
  dewp?: number | null
  wdir?: number | null | 'VRB'
  wspd?: number | null
  visib?: number | null
  altim?: number | null
  wxString?: string | null
  lat?: number
  lon?: number
  name?: string
  clouds?: Array<{
    cover?: string
    base?: number | null
  }>
}

export function normalizeAirportCode(value: string) {
  return value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 4)
}

export function isValidAirportCode(value: string) {
  return /^[A-Z]{4}$/.test(normalizeAirportCode(value))
}

export function summarizeFlightCategory(category: string | null) {
  if (!category) {
    return 'Unknown'
  }

  return FLIGHT_CATEGORY_LABELS[category] ?? category
}

export function mapNoaaMetarResponse(records: NoaaMetarRecord[]) {
  const report = records[0]

  if (!report?.icaoId || !report.rawOb || !report.reportTime || report.lat === undefined || report.lon === undefined) {
    throw new Error(METAR_FETCH_ERROR)
  }

  const clouds = (report.clouds ?? []).map((layer) => {
    const coverCode = layer.cover ?? 'UNK'
    const baseFtAgl = layer.base ?? null

    return {
      coverCode,
      coverLabel: COVER_LABELS[coverCode] ?? coverCode,
      baseFtAgl,
      text: `${COVER_LABELS[coverCode] ?? coverCode}${baseFtAgl ? ` at ${baseFtAgl.toLocaleString()} ft` : ''}`,
    }
  })

  const remarksItems = decodeRemarks(report.rawOb)

  return {
    rawMetar: report.rawOb,
    station: {
      icao: report.icaoId,
      name: report.name ?? report.icaoId,
      lat: report.lat,
      lon: report.lon,
    },
    observedAt: report.reportTime,
    flightCategory: report.fltCat ?? null,
    source: 'NOAA_AWC' as const,
    decoded: {
      wind: { text: formatWind(report.wdir, report.wspd) },
      visibility: { text: formatVisibility(report.visib) },
      clouds,
      cloudsText: clouds.length > 0 ? clouds.map((cloud) => cloud.text).join(', ') : 'No cloud layers reported',
      temperature: formatTemperature(report.temp),
      dewPoint: formatTemperature(report.dewp),
      altimeter: formatAltimeter(report.altim),
      weather: { text: decodeWeather(report.wxString) },
      remarksSummary: remarksItems.join('; '),
      remarksItems,
    },
  } satisfies MetarReport
}

function formatWind(direction: NoaaMetarRecord['wdir'], speed: NullableNumber) {
  if (speed == null && direction == null) {
    return 'Calm or not reported'
  }

  if (speed === 0) {
    return 'Calm'
  }

  const directionLabel =
    direction === 'VRB' || direction == null ? 'Variable' : `${String(direction).padStart(3, '0')}°`

  return `${directionLabel} at ${speed ?? 0} kt`
}

function formatVisibility(visibility: NullableNumber) {
  if (visibility == null) {
    return 'Not reported'
  }

  return `${visibility} statute mile${visibility === 1 ? '' : 's'}`
}

function formatTemperature(value: NullableNumber): Measurement {
  if (value == null) {
    return {
      celsius: null,
      fahrenheit: null,
      text: 'Not reported',
    }
  }

  const fahrenheit = Math.round(((value * 9) / 5 + 32) * 10) / 10
  return {
    celsius: value,
    fahrenheit,
    text: `${value.toFixed(1)}°C / ${fahrenheit.toFixed(1)}°F`,
  }
}

function formatAltimeter(value: NullableNumber) {
  if (value == null) {
    return {
      hpa: null,
      inHg: null,
      text: 'Not reported',
    }
  }

  const inHg = Math.round((value * 0.0295299830714) * 100) / 100
  return {
    hpa: value,
    inHg,
    text: `${value.toFixed(1)} hPa / ${inHg.toFixed(2)} inHg`,
  }
}

function decodeWeather(wxString: string | null | undefined) {
  if (!wxString) {
    return 'No significant weather reported'
  }

  return wxString
    .split(' ')
    .map((token) => WEATHER_LABELS[token] ?? token)
    .join(', ')
}

function decodeRemarks(rawMetar: string) {
  const remarksIndex = rawMetar.indexOf(' RMK ')

  if (remarksIndex === -1) {
    return ['No remarks section']
  }

  const rawRemarks = rawMetar.slice(remarksIndex + 5).trim()

  if (!rawRemarks) {
    return ['No remarks section']
  }

  const tokens = rawRemarks.split(/\s+/)
  const decoded: string[] = []

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    const nextToken = tokens[index + 1]
    const combinedToken = nextToken ? `${token} ${nextToken}` : token

    if (combinedToken === 'SFC VIS' && nextToken && tokens[index + 2]) {
      const whole = tokens[index + 2]
      const fraction = tokens[index + 3]
      const visibilityValue = fraction && /^\d\/\d$/.test(fraction) ? `${whole} ${fraction}` : whole

      decoded.push(`surface visibility ${visibilityValue} statute miles`)
      index += visibilityValue === whole ? 2 : 3
      continue
    }

    if (token === 'AO1') {
      decoded.push('automated station without precipitation discriminator')
      continue
    }

    if (token === 'AO2') {
      decoded.push('automated station with precipitation discriminator')
      continue
    }

    if (/^[A-Z]{2}[EB]\d{2}$/.test(token)) {
      decoded.push(decodeRemarkTimeToken(token))
      continue
    }

    if (/^(?:[A-Z]{2}[EB]\d{2})+$/.test(token)) {
      decoded.push(
        token
          .match(/[A-Z]{2}[EB]\d{2}/g)!
          .map((segment) => decodeRemarkTimeToken(segment))
          .join('; '),
      )
      continue
    }

    if (/^SLP\d{3}$/.test(token)) {
      decoded.push(decodeSeaLevelPressure(token))
      continue
    }

    if (/^(CLR|FEW|SCT|BKN|OVC|VV)\d{3}$/.test(token)) {
      decoded.push(decodeCloudRemark(token))
      continue
    }

    if (/^P\d{4}$/.test(token)) {
      decoded.push(decodeHourlyPrecipitation(token))
      continue
    }

    if (/^T\d{8}$/.test(token)) {
      decoded.push(decodePreciseTemperature(token))
      continue
    }

    if (WEATHER_LABELS[token]) {
      decoded.push(WEATHER_LABELS[token].toLowerCase())
      continue
    }

    decoded.push(token)
  }

  return decoded
}

function decodeRemarkTimeToken(token: string) {
  const phenomenonCode = token.slice(0, 2)
  const actionCode = token[2]
  const minuteValue = token.slice(3)
  const actionLabel = actionCode === 'B' ? 'began' : actionCode === 'E' ? 'ended' : 'at'
  const phenomenonLabel = WEATHER_LABELS[phenomenonCode] ?? phenomenonCode

  return `${phenomenonLabel.toLowerCase()} ${actionLabel} :${minuteValue}Z`
}

function decodeSeaLevelPressure(token: string) {
  const hectopascals = Number.parseInt(token.slice(3), 10) / 10
  const normalizedPressure = hectopascals >= 50 ? 900 + hectopascals : 1000 + hectopascals

  return `sea-level pressure ${normalizedPressure.toFixed(1)} hPa`
}

function decodeHourlyPrecipitation(token: string) {
  const inches = Number.parseInt(token.slice(1), 10) / 100

  return `hourly precipitation ${inches.toFixed(2)} in`
}

function decodePreciseTemperature(token: string) {
  const tempSign = token[1] === '1' ? -1 : 1
  const dewPointSign = token[5] === '1' ? -1 : 1
  const tempCelsius = (Number.parseInt(token.slice(2, 5), 10) / 10) * tempSign
  const dewPointCelsius = (Number.parseInt(token.slice(6, 9), 10) / 10) * dewPointSign

  return `exact temperature ${tempCelsius.toFixed(1)}°C, dew point ${dewPointCelsius.toFixed(1)}°C`
}

function decodeCloudRemark(token: string) {
  const coverCode = token.slice(0, 3)
  const baseHundreds = Number.parseInt(token.slice(3), 10)
  const coverLabel = COVER_LABELS[coverCode] ?? coverCode

  return `${coverLabel.toLowerCase()} at ${(baseHundreds * 100).toLocaleString()} ft`
}

const WEATHER_LABELS: Record<string, string> = {
  '-DZ': 'Light drizzle',
  '-RA': 'Light rain',
  '-SN': 'Light snow',
  BR: 'Mist',
  FG: 'Fog',
  HZ: 'Haze',
  RA: 'Rain',
  SN: 'Snow',
  TS: 'Thunderstorm',
  DZ: 'Drizzle',
}
