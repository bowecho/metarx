export type AppCopy = {
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

export const APP_COPY: AppCopy = {
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
}
