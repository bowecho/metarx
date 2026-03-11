import { COVER_LABELS, FLIGHT_CATEGORY_LABELS, type NullableNumber } from './metarShared'
import {
  decodeCloudRemark,
  decodeLightningDescription,
  decodeRemarks,
  decodeRunwayVisualRange,
  formatRemarkTimestamp,
  parseLocationSequence,
  parseLocationToken,
  parseVisibilityValue,
} from './metarRemarks'
import { decodeWeather } from './metarWeather'

export const METAR_FETCH_ERROR = 'Unable to retrieve a METAR for that airport right now.'
export const METAR_NOT_FOUND_ERROR = 'No current METAR found for that airport.'

export type Measurement = {
  celsius: number | null
  fahrenheit: number | null
  text: string
}

export type DecodedTextBlock = {
  directionDegrees?: number | 'VRB' | null
  feet?: number | null
  gustKt?: number | null
  miles?: number | null
  speedKt?: number | null
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
    runwayVisualRange: DecodedTextBlock
    verticalVisibility: DecodedTextBlock
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

export type MetarLookupResponse = MetarReport & {
  history: MetarReport[]
}

export type Watchout = {
  detail: string
  severity: 'high' | 'medium' | 'low'
  title: string
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
  wgst?: number | null
  visib?: number | string | null
  altim?: number | null
  vertVis?: number | null
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
  const reports = mapNoaaMetarResponses(records)
  const report = reports[0]

  if (!report) {
    throw new Error(METAR_NOT_FOUND_ERROR)
  }

  return report
}

export function mapNoaaMetarResponses(records: NoaaMetarRecord[]) {
  if (records.length === 0) {
    return [] as MetarReport[]
  }

  return [...records]
    .sort(
      (left, right) =>
        new Date(right.reportTime ?? 0).getTime() - new Date(left.reportTime ?? 0).getTime(),
    )
    .map((report) => mapNoaaMetarRecord(report))
}

function mapNoaaMetarRecord(report: NoaaMetarRecord) {
  if (!report?.icaoId || !report.rawOb || !report.reportTime || report.lat === undefined || report.lon === undefined) {
    throw new Error(METAR_FETCH_ERROR)
  }

  const clouds = (report.clouds ?? [])
    .filter((layer) => !(report.vertVis != null && (layer.cover ?? 'UNK') === 'OVX'))
    .map((layer) => {
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
      wind: {
        directionDegrees: report.wdir ?? null,
        gustKt: report.wgst ?? null,
        speedKt: report.wspd ?? null,
        text: formatWind(report.wdir, report.wspd, report.wgst),
      },
      visibility: {
        miles: normalizeVisibilityMiles(report.visib),
        text: formatVisibility(report.visib),
      },
      runwayVisualRange: { text: decodeRunwayVisualRange(report.rawOb) },
      verticalVisibility: {
        feet: report.vertVis != null ? report.vertVis * 100 : null,
        text: formatVerticalVisibility(report.vertVis),
      },
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

export function getCeilingFeet(report: MetarReport) {
  const verticalVisibilityFeet = report.decoded.verticalVisibility.feet
  const cloudCeilingFeet = report.decoded.clouds
    .filter((layer) => layer.baseFtAgl != null && ['BKN', 'OVC', 'VV'].includes(layer.coverCode))
    .map((layer) => layer.baseFtAgl as number)
    .sort((left, right) => left - right)[0] ?? null

  if (verticalVisibilityFeet == null) {
    return cloudCeilingFeet
  }

  if (cloudCeilingFeet == null) {
    return verticalVisibilityFeet
  }

  return Math.min(verticalVisibilityFeet, cloudCeilingFeet)
}

export function deriveMetarWatchouts(report: MetarReport) {
  const watchouts: Watchout[] = []
  const visibilityMiles = report.decoded.visibility.miles
  const ceilingFeet = getCeilingFeet(report)
  const gustSpread =
    report.decoded.wind.gustKt != null && report.decoded.wind.speedKt != null
      ? report.decoded.wind.gustKt - report.decoded.wind.speedKt
      : null
  const dewPointSpread =
    report.decoded.temperature.celsius != null && report.decoded.dewPoint.celsius != null
      ? Math.abs(report.decoded.temperature.celsius - report.decoded.dewPoint.celsius)
      : null
  const weatherText = report.decoded.weather.text.toLowerCase()
  const remarksText = report.decoded.remarksSummary.toLowerCase()

  if (visibilityMiles != null && visibilityMiles <= 1) {
    watchouts.push({
      detail: `Visibility is down to ${report.decoded.visibility.text}, which compresses approach and taxi margin fast.`,
      severity: 'high',
      title: 'Visibility is severely reduced',
    })
  } else if (visibilityMiles != null && visibilityMiles <= 3) {
    watchouts.push({
      detail: `Visibility is ${report.decoded.visibility.text}, so workload and visual margin are both trimmed back.`,
      severity: 'medium',
      title: 'Visibility is reduced',
    })
  }

  if (
    visibilityMiles != null &&
    visibilityMiles <= 3 &&
    (weatherText.includes('fog') || weatherText.includes('mist'))
  ) {
    watchouts.push({
      detail: 'Fog or mist is stacked on top of reduced visibility, which usually means weak visual cues and a sticky low-level layer.',
      severity: visibilityMiles <= 1 ? 'high' : 'medium',
      title: 'Low-level obscuration is in play',
    })
  }

  if (ceilingFeet != null && ceilingFeet <= 500) {
    watchouts.push({
      detail: `Ceiling is about ${ceilingFeet.toLocaleString()} ft, which leaves almost no visual cushion below the deck.`,
      severity: 'high',
      title: 'Ceiling is in the basement',
    })
  } else if (ceilingFeet != null && ceilingFeet <= 1000) {
    watchouts.push({
      detail: `Ceiling is about ${ceilingFeet.toLocaleString()} ft, so pattern work and visual maneuvering margin are tight.`,
      severity: 'medium',
      title: 'Ceiling is tight',
    })
  }

  if (gustSpread != null && gustSpread >= 15) {
    watchouts.push({
      detail: `Wind is ${report.decoded.wind.text}, a gust spread big enough to change control feel from one minute to the next.`,
      severity: gustSpread >= 25 ? 'high' : 'medium',
      title: 'Gust spread is meaningful',
    })
  }

  if (dewPointSpread != null && dewPointSpread <= 2) {
    watchouts.push({
      detail: `Temperature and dew point are only ${dewPointSpread.toFixed(1)}°C apart, so low cloud, haze, or additional obscuration can linger.`,
      severity: dewPointSpread <= 1 ? 'medium' : 'low',
      title: 'Air mass is near saturation',
    })
  }

  if (
    weatherText.includes('thunderstorm') ||
    weatherText.includes('snow') ||
    weatherText.includes('freezing') ||
    weatherText.includes('ice pellets')
  ) {
    watchouts.push({
      detail: `Reported weather includes ${report.decoded.weather.text}, which can push handling and planning well beyond a routine METAR day.`,
      severity: 'high',
      title: 'Active weather is a major factor',
    })
  } else if (
    weatherText.includes('rain') ||
    weatherText.includes('drizzle') ||
    weatherText.includes('showers')
  ) {
    watchouts.push({
      detail: `Reported weather includes ${report.decoded.weather.text}, so expect a wet picture and more nuisance workload than a clean VFR report.`,
      severity: 'low',
      title: 'Precipitation is part of the picture',
    })
  }

  if (
    remarksText.includes('pressure falling') ||
    /pressure tendency code [5-8]/.test(remarksText)
  ) {
    watchouts.push({
      detail: 'Pressure tendency is falling in the remarks, which supports a deteriorating or unsettled trend rather than a stabilizing one.',
      severity: 'medium',
      title: 'Pressure trend is falling',
    })
  }

  const severityRank = { high: 0, medium: 1, low: 2 } as const

  return watchouts
    .sort((left, right) => severityRank[left.severity] - severityRank[right.severity])
    .slice(0, 3)
}

function formatWind(direction: NoaaMetarRecord['wdir'], speed: NullableNumber, gust?: NullableNumber) {
  if (speed == null && direction == null) {
    return 'Calm or not reported'
  }

  if (speed === 0) {
    return 'Calm'
  }

  const directionText =
    direction === 'VRB' || direction == null ? 'Variable' : `${String(direction).padStart(3, '0')}°`
  const gustText = gust != null ? ` gusting ${gust} kt` : ''
  return `${directionText} at ${speed ?? 0} kt${gustText}`
}

function formatVisibility(visibility: NoaaMetarRecord['visib']) {
  if (visibility == null) {
    return 'Not reported'
  }

  if (typeof visibility === 'string') {
    return `${visibility} statute miles`
  }

  return `${visibility} statute mile${visibility === 1 ? '' : 's'}`
}

function normalizeVisibilityMiles(visibility: NoaaMetarRecord['visib']) {
  if (typeof visibility === 'number') {
    return visibility
  }

  if (typeof visibility === 'string') {
    if (visibility === '10+') {
      return 10
    }

    const numericValue = Number.parseFloat(visibility)
    return Number.isFinite(numericValue) ? numericValue : null
  }

  return null
}

function formatTemperature(value: NullableNumber): Measurement {
  if (value == null) {
    return {
      celsius: null,
      fahrenheit: null,
      text: 'Not reported',
    }
  }

  const fahrenheit = (value * 9) / 5 + 32
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

  const hpa = Math.round(value * 10) / 10
  const inHg = Math.round((hpa * 0.0295299830714) * 100) / 100
  return {
    hpa,
    inHg,
    text: `${hpa.toFixed(1)} hPa / ${inHg.toFixed(2)} inHg`,
  }
}

function formatVerticalVisibility(value: NullableNumber) {
  if (value == null) {
    return 'Not reported'
  }

  return `${(value * 100).toLocaleString()} ft`
}

export {
  decodeCloudRemark,
  decodeLightningDescription,
  formatRemarkTimestamp,
  parseLocationSequence,
  parseLocationToken,
  parseVisibilityValue,
}
