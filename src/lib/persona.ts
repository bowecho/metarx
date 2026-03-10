export type PersonaMode = 'metarx' | 'metard'

export const PERSONA_STORAGE_KEY = 'metarx:persona-mode'

type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export type PersonaCopy = {
  analysisEmpty: string
  analysisIdleButton: string
  analysisKicker: string
  analysisRefreshButton: string
  analysisRegionLabel: string
  analysisRetryButton: string
  analysisStreamingLabel: string
  analysisStreamingNote: string
  brand: string
  compareKicker: string
  compareTitle: string
  compareToggleOff: string
  compareToggleOn: string
  compareInputLabel: string
  errorTitle: string
  favoritesEmpty: string
  favoritesTitle: string
  historyEmpty: string
  historyKicker: string
  historyTitle: string
  idleBody: string
  idleTitle: string
  loadingMessage: string
  observedPrefix: string
  rawMetarLabel: string
  recentEmpty: string
  recentTitle: string
  reportKicker: string
  reportTitle: string
  reportSections: {
    atmosphere: {
      kicker: string
      title: string
    }
    thermal: {
      kicker: string
      title: string
    }
  }
  saveActive: string
  saveIdle: string
  searchIdleButton: string
  searchLoadingButton: string
  subtitle: string
  watchoutsEmpty: string
  watchoutsKicker: string
  watchoutsTitle: string
  metricLabels: {
    altimeter: string
    clouds: string
    dewPoint: string
    flightRules: string
    runwayVisualRange: string
    temperature: string
    verticalVisibility: string
    visibility: string
    weather: string
    wind: string
  }
  remarks: {
    kicker: string
    title: string
  }
}

export const PERSONA_COPY: Record<PersonaMode, PersonaCopy> = {
  metard: {
    analysisEmpty:
      'Want the cursed operational take, you absolute dipshit? Hit the button and let the app explain your clown weather choices.',
    analysisIdleButton: 'Humiliate Me',
    analysisKicker: 'Idiot advisory desk',
    analysisRefreshButton: 'Kick Me Again',
    analysisRegionLabel: 'Idiot advisory desk',
    analysisRetryButton: 'Try Roasting Me Again',
    analysisStreamingLabel: 'Fermenting',
    analysisStreamingNote: 'A deranged cockpit ass-chewing is bubbling into existence.',
    brand: 'MetarD',
    compareInputLabel: 'Second airport for extra stupidity',
    compareKicker: 'Fight card',
    compareTitle: 'Airport cage match',
    compareToggleOff: 'Add Another Disaster',
    compareToggleOn: 'Lose The Second Disaster',
    errorTitle: 'You managed to screw up the weather machine',
    favoritesEmpty: 'Stash your recurring mistakes here, hotshot.',
    favoritesTitle: 'Favorite disasters',
    historyEmpty: 'No recent sky tantrums on file.',
    historyKicker: 'Weather crime tape',
    historyTitle: 'Trend spiral',
    idleBody: 'Try KJFK, EGLL, KLAX, or whatever airport your dumb little impulses dragged you toward.',
    idleTitle: 'Type an ICAO code, jackass',
    loadingMessage: 'Beating the METAR machine until it spits out weather, you impatient clown.',
    observedPrefix: 'Witnessed',
    rawMetarLabel: 'Raw Sky Garbage',
    recentEmpty: 'No questionable airport choices yet. Miraculous.',
    recentTitle: 'Recent stupid ideas',
    reportKicker: 'Atmospheric bullshit desk',
    reportTitle: 'Current sky stupidity',
    reportSections: {
      atmosphere: {
        kicker: 'Bullshit',
        title: 'Flight and other poor decisions',
      },
      thermal: {
        kicker: 'Sweat',
        title: 'Temperature and soggy nonsense',
      },
    },
    saveActive: 'Fine, Saved',
    saveIdle: 'Save This Mess',
    searchIdleButton: 'Commit Weather Crimes',
    searchLoadingButton: 'Doing dumb shit',
    subtitle: 'Questionable Pilot Briefing For Dumbasses',
    watchoutsEmpty: 'Nothing especially explosive in this report. Try not to ruin that.',
    watchoutsKicker: 'Hazard goblin',
    watchoutsTitle: 'Stuff most likely to bite your ass',
    metricLabels: {
      altimeter: 'Pressure Nonsense',
      clouds: 'Cloud Crap',
      dewPoint: 'Moist Garbage',
      flightRules: 'Rule Mood',
      runwayVisualRange: 'Runway Weird Shit',
      temperature: 'Hot/Cold Problem',
      verticalVisibility: 'Ceiling Soup',
      visibility: 'How Far You Can See, Moron',
      weather: 'Sky Bullshit',
      wind: 'Wind Shenanigans',
    },
    remarks: {
      kicker: 'Muttered crap',
      title: 'Tower trash talk',
    },
  },
  metarx: {
    analysisEmpty: 'Want the operational take? Generate an instructor-style read on this METAR.',
    analysisIdleButton: 'Pilot Perspective',
    analysisKicker: 'Pilot perspective',
    analysisRefreshButton: 'Refresh Perspective',
    analysisRegionLabel: 'Pilot perspective',
    analysisRetryButton: 'Retry Perspective',
    analysisStreamingLabel: 'Streaming',
    analysisStreamingNote: 'Senior-pilot perspective is streaming in.',
    brand: 'MetarX',
    compareInputLabel: 'Compare against another ICAO airport',
    compareKicker: 'Side-by-side briefing',
    compareTitle: 'Airport comparison',
    compareToggleOff: 'Compare Airports',
    compareToggleOn: 'Single Airport',
    errorTitle: 'Lookup failed',
    favoritesEmpty: 'Save stations for quick access.',
    favoritesTitle: 'Favorites',
    historyEmpty: 'No recent reports available.',
    historyKicker: 'Recent METAR history',
    historyTitle: 'Trend strip',
    idleBody: 'Try KJFK, EGLL, KLAX, or the airport you track most often.',
    idleTitle: 'Start with any ICAO code',
    loadingMessage: 'Collecting the latest METAR and decoding station conditions.',
    observedPrefix: 'Observed',
    rawMetarLabel: 'Raw METAR',
    recentEmpty: 'No airport lookups yet.',
    recentTitle: 'Recent searches',
    reportKicker: 'Operational weather report',
    reportTitle: 'Current conditions',
    reportSections: {
      atmosphere: {
        kicker: 'Core',
        title: 'Flight and atmosphere',
      },
      thermal: {
        kicker: 'Thermal',
        title: 'Temperature and moisture',
      },
    },
    saveActive: 'Saved',
    saveIdle: 'Save',
    searchIdleButton: 'Decode METAR',
    searchLoadingButton: 'Loading',
    subtitle: 'Pilot Weather Briefing',
    watchoutsEmpty: 'No standout watchouts from this METAR snapshot.',
    watchoutsKicker: 'Deterministic watchouts',
    watchoutsTitle: 'Why this matters',
    metricLabels: {
      altimeter: 'Altimeter',
      clouds: 'Clouds',
      dewPoint: 'Dew Point',
      flightRules: 'Flight Rules',
      runwayVisualRange: 'Runway Visual Range',
      temperature: 'Temperature',
      verticalVisibility: 'Vertical Visibility',
      visibility: 'Visibility',
      weather: 'Weather',
      wind: 'Wind',
    },
    remarks: {
      kicker: 'Decoded remarks',
      title: 'Operational notes',
    },
  },
}

export function isPersonaMode(value: unknown): value is PersonaMode {
  return value === 'metarx' || value === 'metard'
}

export function resolvePersonaMode(value: unknown): PersonaMode {
  return isPersonaMode(value) ? value : 'metarx'
}

export function loadStoredPersonaMode(): PersonaMode {
  const storage = getLocalStorage()
  if (!storage) {
    return 'metarx'
  }

  return resolvePersonaMode(storage.getItem(PERSONA_STORAGE_KEY))
}

export function savePersonaMode(mode: PersonaMode) {
  const storage = getLocalStorage()
  if (!storage) {
    return
  }

  storage.setItem(PERSONA_STORAGE_KEY, mode)
}

function getLocalStorage(): StorageLike | null {
  const candidate = globalThis as typeof globalThis & {
    localStorage?: StorageLike
  }

  return candidate.localStorage ?? null
}
