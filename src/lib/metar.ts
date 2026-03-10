export const METAR_FETCH_ERROR = 'Unable to retrieve a METAR for that airport right now.'
export const METAR_NOT_FOUND_ERROR = 'No current METAR found for that airport.'

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
type ParsedRemark = {
  consumed: number
  decoded: string
}

type RemarkParser = (tokens: string[], index: number) => ParsedRemark | null

export type Measurement = {
  celsius: number | null
  fahrenheit: number | null
  text: string
}

export type DecodedTextBlock = {
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
  visib?: number | null
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
        gustKt: report.wgst ?? null,
        speedKt: report.wspd ?? null,
        text: formatWind(report.wdir, report.wspd, report.wgst),
      },
      visibility: { miles: report.visib ?? null, text: formatVisibility(report.visib) },
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
  } else if (ceilingFeet != null && ceilingFeet <= 1_000) {
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

  const directionLabel =
    direction === 'VRB' || direction == null ? 'Variable' : `${String(direction).padStart(3, '0')}°`

  const gustText = gust != null ? ` gusting ${gust} kt` : ''

  return `${directionLabel} at ${speed ?? 0} kt${gustText}`
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
  const rawRemarks = extractRawRemarks(rawMetar)

  if (!rawRemarks) {
    return ['No remarks section']
  }

  const tokens = rawRemarks.split(/\s+/)
  const decoded: string[] = []

  for (let index = 0; index < tokens.length; index += 1) {
    const parsedRemark = parseRemarkAt(tokens, index)
    if (parsedRemark) {
      decoded.push(parsedRemark.decoded)
      index += parsedRemark.consumed - 1
      continue
    }

    decoded.push(tokens[index])
  }

  return decoded
}

function extractRawRemarks(rawMetar: string) {
  const remarksIndex = rawMetar.indexOf(' RMK ')

  if (remarksIndex === -1) {
    return ''
  }

  return rawMetar.slice(remarksIndex + 5).trim()
}

function extractMetarBody(rawMetar: string) {
  const remarksIndex = rawMetar.indexOf(' RMK ')
  const body = remarksIndex === -1 ? rawMetar : rawMetar.slice(0, remarksIndex)

  return body.trim()
}

function decodeRunwayVisualRange(rawMetar: string) {
  const body = extractMetarBody(rawMetar)
  const runwayVisualRangeTokens = body.match(/R\d{2}[LCR]?\/(?:M|P)?\d{4}(?:V(?:M|P)?\d{4})?FT(?:\/[UDN])?/g)

  if (!runwayVisualRangeTokens || runwayVisualRangeTokens.length === 0) {
    return 'Not reported'
  }

  return runwayVisualRangeTokens.map((token) => decodeRunwayVisualRangeToken(token)).join('; ')
}

function decodeRunwayVisualRangeToken(token: string) {
  const match = token.match(
    /^R(?<runway>\d{2}[LCR]?)\/(?<lowerQualifier>M|P)?(?<lower>\d{4})(?:V(?<upperQualifier>M|P)?(?<upper>\d{4}))?FT(?:\/(?<trend>[UDN]))?$/,
  )

  if (!match?.groups) {
    return token
  }

  const runwayLabel = match.groups.runway
  const lowerText = formatRunwayVisualRangeValue(match.groups.lower, match.groups.lowerQualifier)
  const upper = match.groups.upper

  if (!upper) {
    return `${runwayLabel}: ${lowerText}`
  }

  const upperText = formatRunwayVisualRangeValue(upper, match.groups.upperQualifier)
  return `${runwayLabel}: ${lowerText} to ${upperText}`
}

function formatRunwayVisualRangeValue(value: string, qualifier?: string) {
  const feet = Number.parseInt(value, 10).toLocaleString()

  if (qualifier === 'M') {
    return `less than ${feet} ft`
  }

  if (qualifier === 'P') {
    return `more than ${feet} ft`
  }

  return `${feet} ft`
}

function parseRemarkAt(tokens: string[], index: number) {
  for (const parser of REMARK_PARSERS) {
    const parsedRemark = parser(tokens, index)
    if (parsedRemark) {
      return parsedRemark
    }
  }

  return null
}

function parseLightningRemark(tokens: string[], index: number): ParsedRemark | null {
  const frequencyToken = LIGHTNING_FREQUENCY_LABELS[tokens[index]]
    ? tokens[index]
    : null
  const lightningIndex = frequencyToken ? index + 1 : index

  const lightningDescription = decodeLightningDescription(tokens[lightningIndex])
  if (!lightningDescription) {
    return null
  }

  let cursor = lightningIndex + 1
  const distanceToken = LIGHTNING_DISTANCE_LABELS[tokens[cursor]]
  if (!distanceToken) {
    const locationResult = parseLocationSequence(tokens, cursor)
    if (!locationResult) {
      return {
        consumed: lightningIndex - index + 1,
        decoded: `${frequencyToken ? `${LIGHTNING_FREQUENCY_LABELS[frequencyToken]} ` : ''}${lightningDescription}`.trim(),
      }
    }

    return {
      consumed: locationResult.nextIndex - index,
      decoded: `${frequencyToken ? `${LIGHTNING_FREQUENCY_LABELS[frequencyToken]} ` : ''}${lightningDescription} ${locationResult.text}`.trim(),
    }
  }

  cursor += 1
  const locationResult = parseLocationSequence(tokens, cursor)
  if (!locationResult) {
    return null
  }

  let decoded = `${frequencyToken ? `${LIGHTNING_FREQUENCY_LABELS[frequencyToken]} ` : ''}${lightningDescription} ${distanceToken} ${locationResult.text}`

  const movementToken = tokens[locationResult.nextIndex]
  const movementDirection = parseLocationToken(tokens[locationResult.nextIndex + 1])
  if (movementToken === 'MOV' && movementDirection) {
    decoded += ` moving ${movementDirection}`
    return {
      consumed: locationResult.nextIndex + 2 - index,
      decoded,
    }
  }

  return {
    consumed: locationResult.nextIndex - index,
    decoded,
  }
}

function parseCloudTypeRemark(tokens: string[], index: number): ParsedRemark | null {
  const cloudType = CLOUD_TYPE_LABELS[tokens[index]]
  if (!cloudType) {
    return null
  }

  let cursor = index + 1
  let decoded = cloudType
  const distanceToken = LIGHTNING_DISTANCE_LABELS[tokens[cursor]]

  if (distanceToken) {
    cursor += 1
    const locationResult = parseLocationSequence(tokens, cursor)
    if (!locationResult) {
      return null
    }

    decoded += ` ${distanceToken} ${locationResult.text}`
    cursor = locationResult.nextIndex
  } else {
    const locationResult = parseLocationSequence(tokens, cursor)
    if (locationResult) {
      decoded += ` ${locationResult.text}`
      cursor = locationResult.nextIndex
    }
  }

  const movementToken = tokens[cursor]
  const movementDirection = parseLocationToken(tokens[cursor + 1])
  if (movementToken === 'MOV' && movementDirection) {
    decoded += ` moving ${movementDirection}`
    cursor += 2
  }

  return {
    consumed: cursor - index,
    decoded,
  }
}

function parseSurfaceVisibilityRemark(tokens: string[], index: number): ParsedRemark | null {
  if (tokens[index] !== 'SFC' || tokens[index + 1] !== 'VIS' || !tokens[index + 2]) {
    return null
  }

  const visibilityValue = parseVisibilityValue(tokens, index + 2)
  if (!visibilityValue) {
    return null
  }

  return {
    consumed: visibilityValue.nextIndex - index,
    decoded: `surface visibility ${visibilityValue.value} statute miles`,
  }
}

function parseTowerVisibilityRemark(tokens: string[], index: number): ParsedRemark | null {
  if (tokens[index] !== 'TWR' || tokens[index + 1] !== 'VIS' || !tokens[index + 2]) {
    return null
  }

  const visibilityValue = parseVisibilityValue(tokens, index + 2)
  if (!visibilityValue) {
    return null
  }

  return {
    consumed: visibilityValue.nextIndex - index,
    decoded: `tower visibility ${visibilityValue.value} statute miles`,
  }
}

function parseVariableVisibilityRemark(tokens: string[], index: number): ParsedRemark | null {
  if (tokens[index] !== 'VIS') {
    return null
  }

  const rangeToken = tokens[index + 1]
  if (rangeToken && /^\d+(?:\s\d\/\d)?V\d+(?:\s\d\/\d)?$/.test(rangeToken)) {
    const [low, high] = rangeToken.split('V')
    return {
      consumed: 2,
      decoded: `visibility varying between ${low} and ${high} statute miles`,
    }
  }

  const directionToken = tokens[index + 1]
  const visibilityValue = tokens[index + 2]
  const directionText = parseLocationToken(directionToken)
  if (directionText && visibilityValue) {
    return {
      consumed: 3,
      decoded: `visibility ${directionText} ${visibilityValue} statute miles`,
    }
  }

  return null
}

function parsePeakWindRemark(tokens: string[], index: number): ParsedRemark | null {
  if (tokens[index] !== 'PK' || tokens[index + 1] !== 'WND') {
    return null
  }

  const peakWindToken = tokens[index + 2]
  if (!peakWindToken || !/^\d{5,6}\/\d{2,4}$/.test(peakWindToken)) {
    return null
  }

  const [windToken, timeToken] = peakWindToken.split('/')
  const direction = windToken.slice(0, 3)
  const speed = Number.parseInt(windToken.slice(3), 10)

  return {
    consumed: 3,
    decoded: `peak wind ${direction}° at ${speed} kt at ${formatRemarkTimestamp(timeToken)}`,
  }
}

function parseWindShiftRemark(tokens: string[], index: number): ParsedRemark | null {
  if (tokens[index] !== 'WSHFT') {
    return null
  }

  const minuteToken = tokens[index + 1]
  if (!minuteToken || !/^\d{2,4}$/.test(minuteToken)) {
    return null
  }

  if (tokens[index + 2] === 'FROPA') {
    return {
      consumed: 3,
      decoded: `wind shift at ${formatRemarkTimestamp(minuteToken)} due to frontal passage`,
    }
  }

  return {
    consumed: 2,
    decoded: `wind shift at ${formatRemarkTimestamp(minuteToken)}`,
  }
}

function parseAutomatedStationRemark(tokens: string[], index: number): ParsedRemark | null {
  if (tokens[index] === 'AO1') {
    return {
      consumed: 1,
      decoded: 'automated station without precipitation discriminator',
    }
  }

  if (tokens[index] === 'AO2') {
    return {
      consumed: 1,
      decoded: 'automated station with precipitation discriminator',
    }
  }

  return null
}

function parseRemarkTime(tokens: string[], index: number): ParsedRemark | null {
  const token = tokens[index]
  return decodeCompactTimingRemark(token)
    ? {
        consumed: 1,
        decoded: decodeCompactTimingRemark(token)!,
      }
    : null
}

function parseSeaLevelPressureRemark(tokens: string[], index: number): ParsedRemark | null {
  const token = tokens[index]

  if (token === 'SLPNO') {
    return {
      consumed: 1,
      decoded: 'sea-level pressure unavailable',
    }
  }

  if (/^SLP\d{3}$/.test(token)) {
    return {
      consumed: 1,
      decoded: decodeSeaLevelPressure(token),
    }
  }

  return null
}

function parseCloudLayerRemark(tokens: string[], index: number): ParsedRemark | null {
  const token = tokens[index]

  if (/^(CLR|FEW|SCT|BKN|OVC|VV)\d{3}$/.test(token)) {
    return {
      consumed: 1,
      decoded: decodeCloudRemark(token),
    }
  }

  return null
}

function parseHourlyPrecipitationRemark(tokens: string[], index: number): ParsedRemark | null {
  const token = tokens[index]

  if (/^P\d{4}$/.test(token)) {
    return {
      consumed: 1,
      decoded: decodeHourlyPrecipitation(token),
    }
  }

  return null
}

function parseThreeOrSixHourPrecipitationRemark(tokens: string[], index: number): ParsedRemark | null {
  const token = tokens[index]
  if (!/^6(?:\d{4}|\/\/\/\/)$/.test(token)) {
    return null
  }

  return {
    consumed: 1,
    decoded: decodeThreeOrSixHourPrecipitation(token),
  }
}

function parsePreciseTemperatureRemark(tokens: string[], index: number): ParsedRemark | null {
  const token = tokens[index]

  if (/^T\d{8}$/.test(token)) {
    return {
      consumed: 1,
      decoded: decodePreciseTemperature(token),
    }
  }

  return null
}

function parseSixHourTemperatureRemark(tokens: string[], index: number): ParsedRemark | null {
  const token = tokens[index]

  if (/^1\d{4}$/.test(token)) {
    return {
      consumed: 1,
      decoded: `6-hour maximum temperature ${decodeSignedTenths(token.slice(1)).toFixed(1)}°C`,
    }
  }

  if (/^2\d{4}$/.test(token)) {
    return {
      consumed: 1,
      decoded: `6-hour minimum temperature ${decodeSignedTenths(token.slice(1)).toFixed(1)}°C`,
    }
  }

  return null
}

function parseTwentyFourHourTemperatureRemark(tokens: string[], index: number): ParsedRemark | null {
  const token = tokens[index]
  if (!/^4\d{8}$/.test(token)) {
    return null
  }

  const maxTemperature = decodeSignedTenths(token.slice(1, 5))
  const minimumTemperature = decodeSignedTenths(token.slice(5))

  return {
    consumed: 1,
    decoded: `24-hour maximum temperature ${maxTemperature.toFixed(1)}°C, minimum temperature ${minimumTemperature.toFixed(1)}°C`,
  }
}

function parsePressureTendencyRemark(tokens: string[], index: number): ParsedRemark | null {
  const token = tokens[index]
  if (!/^5\d{4}$/.test(token)) {
    return null
  }

  const tendencyCode = token[1]
  const hectopascals = Number.parseInt(token.slice(2), 10) / 10

  return {
    consumed: 1,
    decoded: `3-hour pressure tendency code ${tendencyCode}, ${hectopascals.toFixed(1)} hPa`,
  }
}

function parsePressureRisingOrFallingRemark(tokens: string[], index: number): ParsedRemark | null {
  if (tokens[index] === 'PRESRR') {
    return {
      consumed: 1,
      decoded: 'pressure rising rapidly',
    }
  }

  if (tokens[index] === 'PRESFR') {
    return {
      consumed: 1,
      decoded: 'pressure falling rapidly',
    }
  }

  return null
}

function parseVariableCeilingRemark(tokens: string[], index: number): ParsedRemark | null {
  if (tokens[index] !== 'CIG') {
    return null
  }

  const ceilingToken = tokens[index + 1]
  if (!ceilingToken) {
    return null
  }

  const variableMatch = ceilingToken.match(/^(?<low>\d{3})V(?<high>\d{3})$/)
  if (variableMatch?.groups) {
    return {
      consumed: 2,
      decoded: `ceiling varying between ${Number.parseInt(variableMatch.groups.low, 10) * 100} and ${Number.parseInt(variableMatch.groups.high, 10) * 100} ft`,
    }
  }

  return null
}

function parseSecondaryLocationUnavailableRemark(tokens: string[], index: number): ParsedRemark | null {
  if (tokens[index] !== 'CHINO') {
    return null
  }

  const locationResult = parseLocationSequence(tokens, index + 1)
  if (locationResult) {
    return {
      consumed: locationResult.nextIndex - index,
      decoded: `sky condition at secondary location ${locationResult.text} unavailable`,
    }
  }

  return {
    consumed: 1,
    decoded: 'sky condition at secondary location unavailable',
  }
}

function parseVirgaRemark(tokens: string[], index: number): ParsedRemark | null {
  if (tokens[index] !== 'VIRGA') {
    return null
  }

  const locationResult = parseLocationSequence(tokens, index + 1)
  if (!locationResult) {
    return {
      consumed: 1,
      decoded: 'virga',
    }
  }

  return {
    consumed: locationResult.nextIndex - index,
    decoded: `virga ${locationResult.text}`,
  }
}

function parseThunderstormLocationRemark(tokens: string[], index: number): ParsedRemark | null {
  if (tokens[index] !== 'TS') {
    return null
  }

  const locationResult = parseLocationSequence(tokens, index + 1)
  if (!locationResult) {
    return null
  }

  let decoded = `thunderstorm ${locationResult.text}`
  let cursor = locationResult.nextIndex

  if (tokens[cursor] === 'MOV') {
    const movementDirection = parseLocationToken(tokens[cursor + 1])
    if (movementDirection) {
      decoded += ` moving ${movementDirection}`
      cursor += 2
    }
  }

  return {
    consumed: cursor - index,
    decoded,
  }
}

function parseWeatherLocationRemark(tokens: string[], index: number): ParsedRemark | null {
  const weatherLabel = REMARK_WEATHER_LOCATION_LABELS[tokens[index]]
  if (!weatherLabel) {
    return null
  }

  const locationResult = parseLocationSequence(tokens, index + 1)
  if (!locationResult) {
    return null
  }

  return {
    consumed: locationResult.nextIndex - index,
    decoded: `${weatherLabel} ${locationResult.text}`,
  }
}

function parseSensorStatusRemark(tokens: string[], index: number): ParsedRemark | null {
  const decoded = SENSOR_STATUS_LABELS[tokens[index]]
  if (!decoded) {
    return null
  }

  return {
    consumed: 1,
    decoded,
  }
}

function parseMaintenanceRemark(tokens: string[], index: number): ParsedRemark | null {
  if (tokens[index] !== '$') {
    return null
  }

  return {
    consumed: 1,
    decoded: 'maintenance required indicator',
  }
}

function parseStandaloneWeatherRemark(tokens: string[], index: number): ParsedRemark | null {
  const weatherLabel = WEATHER_LABELS[tokens[index]]
  if (!weatherLabel) {
    return null
  }

  return {
    consumed: 1,
    decoded: weatherLabel.toLowerCase(),
  }
}

function decodeCompactTimingRemark(token: string) {
  const decodedSegments: string[] = []
  let cursor = 0

  while (cursor < token.length) {
    const phenomenonCode = REMARK_TIMING_CODES.find((code) => token.startsWith(code, cursor))
    if (!phenomenonCode) {
      return null
    }

    cursor += phenomenonCode.length
    const timingSegments: string[] = []

    while (cursor < token.length && ['B', 'E'].includes(token[cursor])) {
      const actionCode = token[cursor]
      cursor += 1
      const timeMatch = token.slice(cursor).match(/^\d{4}|^\d{2}/)
      if (!timeMatch) {
        return null
      }

      const timeValue = timeMatch[0]
      cursor += timeValue.length
      timingSegments.push(
        `${REMARK_TIMING_LABELS[phenomenonCode] ?? phenomenonCode} ${actionCode === 'B' ? 'began' : 'ended'} ${formatRemarkTimestamp(timeValue)}`,
      )
    }

    if (timingSegments.length === 0) {
      return null
    }

    decodedSegments.push(timingSegments.join(' and '))
  }

  return decodedSegments.join('; ')
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

function decodeThreeOrSixHourPrecipitation(token: string) {
  if (token === '6////') {
    return '3- or 6-hour precipitation amount indeterminable'
  }

  const inches = Number.parseInt(token.slice(1), 10) / 100

  return `3- or 6-hour precipitation ${inches.toFixed(2)} in`
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

function decodeSignedTenths(token: string) {
  const sign = token[0] === '1' ? -1 : 1
  return (Number.parseInt(token.slice(1), 10) / 10) * sign
}

function decodeLightningDescription(token: string) {
  if (token === 'LTG') {
    return 'lightning'
  }

  if (!token.startsWith('LTG')) {
    return null
  }

  let remainder = token.slice(3)
  const types: string[] = []

  while (remainder.length > 0) {
    const nextType = LIGHTNING_TYPE_CODES.find((typeCode) => remainder.startsWith(typeCode))
    if (!nextType) {
      return null
    }

    types.push(LIGHTNING_TYPE_LABELS[nextType])
    remainder = remainder.slice(nextType.length)
  }

  if (types.length === 0) {
    return null
  }

  return `${formatDirectionList(types)} lightning`
}

function parseLocationSequence(tokens: string[], index: number) {
  const locations: string[] = []
  let cursor = index

  while (cursor < tokens.length) {
    const location = parseLocationToken(tokens[cursor])
    if (!location) {
      break
    }

    locations.push(location)
    cursor += 1

    if (tokens[cursor] === 'AND') {
      cursor += 1
      continue
    }

    break
  }

  if (locations.length === 0) {
    return null
  }

  return {
    nextIndex: cursor,
    text: formatDirectionList(locations),
  }
}

function parseLocationToken(token: string | undefined) {
  if (!token) {
    return null
  }

  const parts = token.split('-')
  const labels = parts.map((part) => LOCATION_LABELS[part]).filter(Boolean)
  if (labels.length !== parts.length) {
    return null
  }

  return labels.length === 1
    ? labels[0]
    : `${labels.slice(0, -1).join(' through ')} through ${labels[labels.length - 1]}`
}

function formatRemarkTimestamp(value: string) {
  if (value.length === 2) {
    return `:${value}Z`
  }

  return `${value.slice(0, 2)}:${value.slice(2)}Z`
}

function parseVisibilityValue(tokens: string[], index: number) {
  const whole = tokens[index]
  const fraction = tokens[index + 1]

  if (!whole) {
    return null
  }

  if (fraction && /^\d\/\d$/.test(fraction)) {
    return {
      nextIndex: index + 2,
      value: `${whole} ${fraction}`,
    }
  }

  return {
    nextIndex: index + 1,
    value: whole,
  }
}

function formatDirectionList(directions: string[]) {
  if (directions.length === 1) {
    return directions[0]
  }

  if (directions.length === 2) {
    return `${directions[0]} and ${directions[1]}`
  }

  return `${directions.slice(0, -1).join(', ')}, and ${directions[directions.length - 1]}`
}

const REMARK_PARSERS: RemarkParser[] = [
  parseLightningRemark,
  parseCloudTypeRemark,
  parseThunderstormLocationRemark,
  parseVirgaRemark,
  parseWeatherLocationRemark,
  parseSurfaceVisibilityRemark,
  parseTowerVisibilityRemark,
  parseVariableVisibilityRemark,
  parsePeakWindRemark,
  parseWindShiftRemark,
  parseAutomatedStationRemark,
  parseRemarkTime,
  parseSeaLevelPressureRemark,
  parsePressureRisingOrFallingRemark,
  parseVariableCeilingRemark,
  parseSecondaryLocationUnavailableRemark,
  parseSensorStatusRemark,
  parseCloudLayerRemark,
  parseHourlyPrecipitationRemark,
  parseThreeOrSixHourPrecipitationRemark,
  parsePreciseTemperatureRemark,
  parseSixHourTemperatureRemark,
  parseTwentyFourHourTemperatureRemark,
  parsePressureTendencyRemark,
  parseMaintenanceRemark,
  parseStandaloneWeatherRemark,
]

const DIRECTION_LABELS: Record<string, string> = {
  E: 'east',
  N: 'north',
  NE: 'northeast',
  NW: 'northwest',
  S: 'south',
  SE: 'southeast',
  SW: 'southwest',
  W: 'west',
}

const LOCATION_LABELS: Record<string, string> = {
  ...DIRECTION_LABELS,
  ALQDS: 'all quadrants',
  OHD: 'overhead',
}

const LIGHTNING_DISTANCE_LABELS: Record<string, string> = {
  DSNT: 'distant',
  VC: 'in the vicinity',
  VCY: 'in the vicinity',
}

const LIGHTNING_FREQUENCY_LABELS: Record<string, string> = {
  FRQ: 'frequent',
  OCNL: 'occasional',
}

const CLOUD_TYPE_LABELS: Record<string, string> = {
  ACC: 'altocumulus castellanus',
  ACSL: 'altocumulus standing lenticular',
  CB: 'cumulonimbus',
  CBMAM: 'cumulonimbus mammatus',
  CCSL: 'cirrocumulus standing lenticular',
  SCSL: 'stratocumulus standing lenticular',
}

const LIGHTNING_TYPE_CODES = ['IC', 'CG', 'CC', 'CA'] as const

const LIGHTNING_TYPE_LABELS: Record<(typeof LIGHTNING_TYPE_CODES)[number], string> = {
  CA: 'cloud-to-air',
  CC: 'cloud-to-cloud',
  CG: 'cloud-to-ground',
  IC: 'in-cloud',
}

const SENSOR_STATUS_LABELS: Record<string, string> = {
  FZRANO: 'freezing rain sensor unavailable',
  PNO: 'tipping bucket precipitation gauge unavailable',
  PWINO: 'precipitation identifier sensor unavailable',
  RVRNO: 'runway visual range unavailable',
  TSNO: 'thunderstorm information unavailable',
}

const REMARK_TIMING_LABELS: Record<string, string> = {
  DZ: 'drizzle',
  FZDZ: 'freezing drizzle',
  FZRA: 'freezing rain',
  PL: 'ice pellets',
  RA: 'rain',
  SHRA: 'rain showers',
  SHSN: 'snow showers',
  SN: 'snow',
  TS: 'thunderstorm',
}

const REMARK_TIMING_CODES = Object.keys(REMARK_TIMING_LABELS).sort(
  (left, right) => right.length - left.length,
)

const REMARK_WEATHER_LOCATION_LABELS: Record<string, string> = {
  VCSH: 'showers in the vicinity',
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
  VCSH: 'Showers in the vicinity',
  DZ: 'Drizzle',
}
