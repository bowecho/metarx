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

const WEATHER_INTENSITY_LABELS: Record<string, string> = {
  '+': 'Heavy',
  '-': 'Light',
}

const WEATHER_DESCRIPTOR_LABELS: Record<string, string> = {
  BL: 'Blowing',
  DR: 'Low drifting',
  FZ: 'Freezing',
  MI: 'Shallow',
  PR: 'Partial',
  SH: 'Showers',
  TS: 'Thunderstorm',
}

const WEATHER_PHENOMENA_LABELS: Record<string, string> = {
  BR: 'Mist',
  DS: 'Duststorm',
  DU: 'Widespread dust',
  DZ: 'Drizzle',
  FC: 'Funnel cloud',
  FG: 'Fog',
  FU: 'Smoke',
  GR: 'Hail',
  GS: 'Small hail',
  HZ: 'Haze',
  IC: 'Ice crystals',
  PL: 'Ice pellets',
  PO: 'Dust or sand whirls',
  RA: 'Rain',
  SA: 'Sand',
  SG: 'Snow grains',
  SN: 'Snow',
  SQ: 'Squalls',
  SS: 'Sandstorm',
  TS: 'Thunderstorm',
  UP: 'Unknown precipitation',
  VA: 'Volcanic ash',
}

export function decodeWeather(wxString: string | null | undefined) {
  if (!wxString) {
    return 'No significant weather reported'
  }

  return wxString
    .split(' ')
    .map((token) => decodeWeatherToken(token))
    .join(', ')
}

export function decodeWeatherToken(token: string) {
  if (WEATHER_LABELS[token]) {
    return WEATHER_LABELS[token]
  }

  let remainder = token
  const modifiers: string[] = []

  const intensity = WEATHER_INTENSITY_LABELS[remainder.slice(0, 1)]
  if (intensity) {
    modifiers.push(intensity)
    remainder = remainder.slice(1)
  }

  if (remainder.startsWith('VC')) {
    modifiers.push('Vicinity')
    remainder = remainder.slice(2)
  }

  const descriptor = WEATHER_DESCRIPTOR_LABELS[remainder.slice(0, 2)]
  if (descriptor) {
    modifiers.push(descriptor)
    remainder = remainder.slice(2)
  }

  const phenomena: string[] = []
  for (let index = 0; index < remainder.length; index += 2) {
    const code = remainder.slice(index, index + 2)
    const label = WEATHER_PHENOMENA_LABELS[code]

    if (!label) {
      return token
    }

    phenomena.push(label)
  }

  if (phenomena.length === 0) {
    return token
  }

  return [...modifiers, ...phenomena].join(' ')
}
