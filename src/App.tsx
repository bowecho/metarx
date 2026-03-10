import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import ReactMarkdown from 'react-markdown'
import {
  ArrowLeftRight,
  LoaderCircle,
  Moon,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  Sun,
  Telescope,
  Wind,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import './App.css'
import {
  deriveMetarWatchouts,
  getCeilingFeet,
  METAR_FETCH_ERROR,
  type MetarLookupResponse,
  type MetarReport,
  type Watchout,
  normalizeAirportCode,
  summarizeFlightCategory,
} from './lib/metar'
import {
  FAVORITES_STORAGE_KEY,
  RECENT_SEARCHES_STORAGE_KEY,
  loadStoredCodes,
  toggleStoredCode,
  upsertStoredCode,
} from './lib/storage'
import {
  type ThemeMode,
  loadStoredThemeMode,
  resolveTheme,
  saveThemeMode,
} from './lib/theme'
import type { PilotAnalysisRequest } from './lib/pilotAnalysis'
import {
  loadStoredPersonaMode,
  PERSONA_COPY,
  savePersonaMode,
  type PersonaCopy,
  type PersonaMode,
} from './lib/persona'

type RequestState = 'idle' | 'loading' | 'success' | 'error'
type AnalysisState = 'idle' | 'streaming' | 'success' | 'error'
type AnalysisEntry = {
  error: string
  markdown: string
  status: AnalysisState
}

const MAX_HISTORY_ITEMS = 6

const EMPTY_ANALYSIS_ENTRY: AnalysisEntry = {
  error: '',
  markdown: '',
  status: 'idle',
}

function createEmptyAnalysisState(): Record<PersonaMode, AnalysisEntry> {
  return {
    metard: { ...EMPTY_ANALYSIS_ENTRY },
    metarx: { ...EMPTY_ANALYSIS_ENTRY },
  }
}

function App() {
  const [query, setQuery] = useState('')
  const [compareEnabled, setCompareEnabled] = useState(false)
  const [compareQuery, setCompareQuery] = useState('')
  const [status, setStatus] = useState<RequestState>('idle')
  const [result, setResult] = useState<MetarLookupResponse | null>(null)
  const [compareResult, setCompareResult] = useState<MetarLookupResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [themeMode, setThemeMode] = useState<ThemeMode>('system')
  const [personaMode, setPersonaMode] = useState<PersonaMode>('metarx')
  const [prefersDark, setPrefersDark] = useState(false)
  const [analysisByPersona, setAnalysisByPersona] = useState<Record<PersonaMode, AnalysisEntry>>(
    () => createEmptyAnalysisState(),
  )
  const analysisAbortRef = useRef<AbortController | null>(null)
  const analysisSectionRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setRecentSearches(loadStoredCodes(RECENT_SEARCHES_STORAGE_KEY))
    setFavorites(loadStoredCodes(FAVORITES_STORAGE_KEY))
    setThemeMode(loadStoredThemeMode())
    setPersonaMode(loadStoredPersonaMode())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const updatePreference = () => setPrefersDark(mediaQuery.matches)
    updatePreference()
    mediaQuery.addEventListener('change', updatePreference)

    return () => mediaQuery.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    const nextTheme = resolveTheme(themeMode, prefersDark)
    document.documentElement.dataset.theme = nextTheme
    document.documentElement.style.colorScheme = nextTheme
    saveThemeMode(themeMode)
  }, [prefersDark, themeMode])

  useEffect(() => {
    document.documentElement.dataset.persona = personaMode
    savePersonaMode(personaMode)
  }, [personaMode])

  useEffect(() => {
    return () => {
      analysisAbortRef.current?.abort()
    }
  }, [])

  const activeTheme = resolveTheme(themeMode, prefersDark)
  const copy = PERSONA_COPY[personaMode]
  const activeAnalysis = analysisByPersona[personaMode]
  const analysisStatus = activeAnalysis.status
  const analysisMarkdown = activeAnalysis.markdown
  const analysisError = activeAnalysis.error

  const performLookup = async (requestedCode?: string, requestedCompareCode?: string) => {
    const code = normalizeAirportCode(requestedCode ?? query)
    const secondCode = compareEnabled
      ? normalizeAirportCode(requestedCompareCode ?? compareQuery)
      : ''
    setQuery(code)
    if (compareEnabled) {
      setCompareQuery(secondCode)
    }
    resetAnalysis()

    if (code.length !== 4) {
      setCompareResult(null)
      setResult(null)
      setStatus('error')
      setErrorMessage('Enter a 4-letter ICAO airport code.')
      return
    }

    if (compareEnabled && secondCode.length !== 4) {
      setCompareResult(null)
      setResult(null)
      setStatus('error')
      setErrorMessage('Enter a 4-letter ICAO airport code for the comparison airport.')
      return
    }

    if (compareEnabled && code === secondCode) {
      setCompareResult(null)
      setResult(null)
      setStatus('error')
      setErrorMessage('Choose two different airports to compare.')
      return
    }

    setResult(null)
    setCompareResult(null)
    setStatus('loading')
    setErrorMessage('')

    try {
      const [primaryPayload, secondaryPayload] = await Promise.all([
        fetchMetarLookup(code),
        compareEnabled ? fetchMetarLookup(secondCode) : Promise.resolve(null),
      ])

      setResult(primaryPayload)
      setCompareResult(secondaryPayload)
      setStatus('success')
      const nextRecents = upsertLookupCodes([code, secondCode].filter(Boolean))
      setRecentSearches(nextRecents)
    } catch (error) {
      setCompareResult(null)
      setResult(null)
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : METAR_FETCH_ERROR)
    }
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void performLookup()
  }

  const onToggleFavorite = (airportCode: string) => {
    const nextFavorites = toggleStoredCode(FAVORITES_STORAGE_KEY, airportCode, MAX_HISTORY_ITEMS)
    setFavorites(nextFavorites)
  }

  const onThemeChange = () => {
    setThemeMode((current) => {
      if (current === 'system') {
        return 'light'
      }

      if (current === 'light') {
        return 'dark'
      }

      return 'system'
    })
  }

  const themeLabel = themeMode === 'system' ? `${activeTheme} (auto)` : activeTheme

  const requestPilotAnalysis = async () => {
    if (!result) {
      return
    }

    const analysisSection = analysisSectionRef.current
    if (analysisSection && shouldScrollAnalysisSectionIntoView(analysisSection)) {
      analysisSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    analysisAbortRef.current?.abort()
    const abortController = new AbortController()
    analysisAbortRef.current = abortController
    const requestPersonaMode = personaMode
    setAnalysisStateForPersona(requestPersonaMode, {
      error: '',
      markdown: '',
      status: 'streaming',
    })

    try {
      const payload: PilotAnalysisRequest = { report: result, personaMode: requestPersonaMode }
      const response = await fetch('/api/pilot-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(errorPayload?.error ?? 'Pilot analysis failed.')
      }

      if (!response.body) {
        throw new Error('Pilot analysis stream was unavailable.')
      }

      let hasStreamError = false

      await consumeEventStream(response.body, {
        onDone: () => {
          setAnalysisStateForPersona(requestPersonaMode, {
            status: 'success',
          })
        },
        onError: (message) => {
          hasStreamError = true
          setAnalysisStateForPersona(requestPersonaMode, {
            error: message,
            status: 'error',
          })
        },
        onToken: (token) => {
          appendAnalysisMarkdown(requestPersonaMode, token)
        },
      })

      if (!hasStreamError) {
        setAnalysisStateForPersona(requestPersonaMode, {
          status: 'success',
        })
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      setAnalysisStateForPersona(requestPersonaMode, {
        error: error instanceof Error ? error.message : 'Pilot analysis failed.',
        status: 'error',
      })
    } finally {
      if (analysisAbortRef.current === abortController) {
        analysisAbortRef.current = null
      }
    }
  }

  const resetAnalysis = () => {
    analysisAbortRef.current?.abort()
    analysisAbortRef.current = null
    setAnalysisByPersona(createEmptyAnalysisState())
  }

  const setAnalysisStateForPersona = (
    mode: PersonaMode,
    nextEntry: Partial<AnalysisEntry>,
  ) => {
    setAnalysisByPersona((current) => ({
      ...current,
      [mode]: {
        ...current[mode],
        ...nextEntry,
      },
    }))
  }

  const appendAnalysisMarkdown = (mode: PersonaMode, token: string) => {
    setAnalysisByPersona((current) => ({
      ...current,
      [mode]: {
        ...current[mode],
        markdown: current[mode].markdown + token,
      },
    }))
  }

  return (
    <div className="app-shell">
      <div className="ambient-orb ambient-orb--primary" />
      <div className="ambient-orb ambient-orb--secondary" />
      <div className="scanlines" />
      <motion.main
        className="app"
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
      >
        {/* Command Center */}
        <motion.section
          className="command-center"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.45 }}
        >
          <div className="top-bar">
              <span className="top-bar-logo">{copy.brand}</span>
            <div className="top-bar-divider" />
            <span className="top-bar-subtitle">{copy.subtitle}</span>
            <div className="top-bar-spacer" />
            <div className="top-bar-controls">
              <div aria-label="Persona mode" className="persona-switcher" role="group">
                {(['metarx', 'metard'] as const).map((mode) => (
                  <button
                    aria-pressed={personaMode === mode}
                    className="persona-option"
                    key={mode}
                    type="button"
                    onClick={() => setPersonaMode(mode)}
                  >
                    {PERSONA_COPY[mode].brand}
                  </button>
                ))}
              </div>
              <button
                aria-label={`Theme mode: ${themeLabel}`}
                className="theme-button"
                type="button"
                title={`Theme: ${themeLabel}`}
                onClick={onThemeChange}
              >
                {activeTheme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            </div>
          </div>

          <div className="hero-search">
            <form className="search-form" onSubmit={onSubmit}>
              <div className="search-input-group">
                <Search className="search-icon" size={20} />
                <input
                  aria-label="ICAO airport code"
                  id="airport-code"
                  name="airport-code"
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  maxLength={4}
                  value={query}
                  placeholder="KJFK"
                  onChange={(event) => setQuery(normalizeAirportCode(event.target.value))}
                />
                <motion.button
                  className="search-submit"
                  type="submit"
                  disabled={status === 'loading'}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {status === 'loading' ? (
                    <>
                      <LoaderCircle className="spin" size={18} />
                      {copy.searchLoadingButton}
                    </>
                  ) : (
                    <>
                      <Telescope size={18} />
                      {copy.searchIdleButton}
                    </>
                  )}
                </motion.button>
              </div>
              <div className="compare-controls">
                <button
                  aria-pressed={compareEnabled}
                  className={clsx('compare-toggle', compareEnabled && 'compare-toggle--active')}
                  type="button"
                  onClick={() => {
                    setCompareEnabled((current) => {
                      const nextValue = !current
                      if (!nextValue) {
                        setCompareQuery('')
                        setCompareResult(null)
                      }
                      return nextValue
                    })
                  }}
                >
                  <ArrowLeftRight size={16} />
                  {compareEnabled ? copy.compareToggleOn : copy.compareToggleOff}
                </button>
                {compareEnabled ? (
                  <label className="search-input-group search-input-group--compare" htmlFor="compare-airport-code">
                    <ArrowLeftRight className="search-icon" size={18} />
                    <input
                      aria-label={copy.compareInputLabel}
                      id="compare-airport-code"
                      name="compare-airport-code"
                      type="text"
                      inputMode="text"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      maxLength={4}
                      value={compareQuery}
                      placeholder="KAUS"
                      onChange={(event) => setCompareQuery(normalizeAirportCode(event.target.value))}
                    />
                  </label>
                ) : null}
              </div>
            </form>
          </div>
        </motion.section>

        <div className="content-grid">
          <motion.section
            className="results-panel"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.45 }}
          >
            <div className="panel-header report-header">
              <div>
                <span className="panel-kicker">
                  {compareResult ? copy.compareKicker : copy.reportKicker}
                </span>
                <h2>{compareResult ? copy.compareTitle : copy.reportTitle}</h2>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {status === 'loading' ? (
                <motion.div
                  key="loading"
                  className="loading-state console-state"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <div className="loading-radar" />
                  <p>{copy.loadingMessage}</p>
                  <div className="loading-bars">
                    <span />
                    <span />
                    <span />
                  </div>
                </motion.div>
              ) : null}

              {status === 'error' ? (
                <motion.div
                  key="error"
                  className="message-state error console-state"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <ShieldAlert size={28} />
                  <h3>{copy.errorTitle}</h3>
                  <p>{errorMessage}</p>
                </motion.div>
              ) : null}

              {status !== 'loading' && status !== 'error' && !result ? (
                <motion.div
                  key="idle"
                  className="message-state idle console-state"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <Wind size={28} />
                  <h3>{copy.idleTitle}</h3>
                  <p>{copy.idleBody}</p>
                </motion.div>
              ) : null}

              {status === 'success' && result ? (
                <motion.div
                  key={`${result.station.icao}:${compareResult?.station.icao ?? 'single'}`}
                  className={clsx('result-content', compareResult && 'result-content--compare')}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <div className={clsx('airport-brief-grid', compareResult && 'airport-brief-grid--compare')}>
                    <AirportBriefing
                      copy={copy}
                      history={result.history}
                      isFavorite={favorites.includes(result.station.icao)}
                      onToggleFavorite={() => onToggleFavorite(result.station.icao)}
                      report={result}
                    >
                      {!compareResult ? (
                        <motion.section
                          ref={analysisSectionRef}
                          className={clsx(
                            'analysis-card',
                            analysisStatus === 'idle' && 'analysis-card--idle',
                          )}
                          role="region"
                          aria-label={copy.analysisRegionLabel}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.24, duration: 0.3 }}
                        >
                          <div className="analysis-header">
                            <div>
                              <span className="panel-kicker">{copy.analysisKicker}</span>
                            </div>
                            {analysisStatus === 'streaming' ? (
                              <div className="analysis-status">
                                <LoaderCircle className="spin" size={16} />
                                {copy.analysisStreamingLabel}
                              </div>
                            ) : null}
                            {analysisStatus === 'success' ? (
                              <motion.button
                                className="analysis-button"
                                type="button"
                                onClick={() => void requestPilotAnalysis()}
                                whileHover={{ scale: 1.03, y: -2 }}
                                whileTap={{ scale: 0.97 }}
                              >
                                <RefreshCw size={16} />
                                {copy.analysisRefreshButton}
                              </motion.button>
                            ) : null}
                          </div>

                          {analysisStatus === 'idle' ? (
                            <div className="analysis-empty-state">
                              <p>{copy.analysisEmpty}</p>
                              <motion.button
                                className="analysis-button analysis-button--primary"
                                type="button"
                                onClick={() => void requestPilotAnalysis()}
                                whileHover={{ scale: 1.03, y: -2 }}
                                whileTap={{ scale: 0.97 }}
                              >
                                <Sparkles size={16} />
                                {copy.analysisIdleButton}
                              </motion.button>
                            </div>
                          ) : analysisStatus === 'error' ? (
                            <div className="analysis-body">
                              <div className="analysis-error">{analysisError}</div>
                              <motion.button
                                className="analysis-button analysis-button--primary"
                                type="button"
                                onClick={() => void requestPilotAnalysis()}
                                whileHover={{ scale: 1.03, y: -2 }}
                                whileTap={{ scale: 0.97 }}
                              >
                                <RefreshCw size={16} />
                                {copy.analysisRetryButton}
                              </motion.button>
                            </div>
                          ) : (
                            <>
                              <div className="analysis-markdown">
                                <ReactMarkdown>{analysisMarkdown}</ReactMarkdown>
                              </div>
                              {analysisStatus === 'streaming' ? (
                                <div className="analysis-streaming-indicator">
                                  <span />
                                  {copy.analysisStreamingNote}
                                </div>
                              ) : null}
                            </>
                          )}
                        </motion.section>
                      ) : null}
                    </AirportBriefing>

                    {compareResult ? (
                      <AirportBriefing
                        copy={copy}
                        history={compareResult.history}
                        isFavorite={favorites.includes(compareResult.station.icao)}
                        onToggleFavorite={() => onToggleFavorite(compareResult.station.icao)}
                        report={compareResult}
                      />
                    ) : null}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.section>

          <motion.aside
            className="sidebar-stack"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.45 }}
          >
            <HistoryCard
              title={copy.recentTitle}
              items={recentSearches}
              emptyLabel={copy.recentEmpty}
              onSelect={(code) => void performLookup(code)}
            />
            <HistoryCard
              title={copy.favoritesTitle}
              items={favorites}
              emptyLabel={copy.favoritesEmpty}
              onSelect={(code) => void performLookup(code)}
            />
          </motion.aside>
        </div>
      </motion.main>
    </div>
  )
}

type ReportMetric = {
  label: string
  value: string
}

type ReportSectionProps = {
  accent: string
  items: ReportMetric[]
  kicker: string
  title: string
}

function ReportSection({ accent, items, kicker, title }: ReportSectionProps) {
  return (
    <section className={clsx('report-section', accent)}>
      <header className="report-section-header">
        <span className="panel-kicker">{kicker}</span>
        <h4>{title}</h4>
      </header>
      <div className="metrics-grid">
        {items.map((item, index) => (
          <motion.article
            className="metric-card"
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.3 }}
          >
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </motion.article>
        ))}
      </div>
    </section>
  )
}

type RemarksCardProps = {
  items: string[]
  kicker: string
  title: string
}

function RemarksCard({ items, kicker, title }: RemarksCardProps) {
  return (
    <section className="remarks-card">
      <div className="report-section-header">
        <span className="panel-kicker">{kicker}</span>
        <h4>{title}</h4>
      </div>
      <div className="remarks-list">
        {items.map((item) => (
          <div className="remarks-item" key={item}>
            {item}
          </div>
        ))}
      </div>
    </section>
  )
}

type HistoryCardProps = {
  kicker?: string
  title: string
  items: string[]
  emptyLabel: string
  onSelect: (code: string) => void
}

function HistoryCard({ title, kicker, items, emptyLabel, onSelect }: HistoryCardProps) {
  return (
    <section className="glass-card history-card side-panel">
      <div className="panel-header compact">
        <div>
          {kicker ? <span className="panel-kicker">{kicker}</span> : null}
          <h2>{title}</h2>
        </div>
      </div>
      {items.length > 0 ? (
        <div className="chip-wrap">
          {items.map((item) => (
            <motion.button
              className="history-chip"
              key={item}
              type="button"
              onClick={() => onSelect(item)}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              {item}
            </motion.button>
          ))}
        </div>
      ) : (
        <p className="empty-copy">{emptyLabel}</p>
      )}
    </section>
  )
}

type AirportBriefingProps = {
  children?: ReactNode
  copy: PersonaCopy
  history: MetarReport[]
  isFavorite: boolean
  onToggleFavorite: () => void
  report: MetarReport
}

function AirportBriefing({
  children,
  copy,
  history,
  isFavorite,
  onToggleFavorite,
  report,
}: AirportBriefingProps) {
  const displayedFlightRules = summarizeFlightCategory(report.flightCategory ?? null)
  const watchouts = deriveMetarWatchouts(report)

  return (
    <article className="airport-briefing">
      <motion.header
        className="station-header"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0 }}
      >
        <div>
          <span className="station-code">{report.station.icao}</span>
          <h3>{report.station.name}</h3>
          <p className="station-subtitle">
            {copy.observedPrefix} {formatUtc(report.observedAt)} UTC
          </p>
        </div>
        <div className="station-header-side">
          <div className={clsx('flight-chip', report.flightCategory?.toLowerCase() ?? 'unknown')}>
            {displayedFlightRules}
          </div>
          <motion.button
            className="favorite-button"
            type="button"
            onClick={onToggleFavorite}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
          >
            <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
            {isFavorite ? copy.saveActive : copy.saveIdle}
          </motion.button>
        </div>
      </motion.header>

      <motion.section
        className="raw-card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="raw-card-header">{copy.rawMetarLabel}</div>
        <code>{report.rawMetar}</code>
      </motion.section>

      <motion.div
        className="report-grid"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <ReportSection
          kicker={copy.reportSections.atmosphere.kicker}
          title={copy.reportSections.atmosphere.title}
          accent="accent-cyan"
          items={[
            { label: copy.metricLabels.flightRules, value: displayedFlightRules },
            { label: copy.metricLabels.wind, value: report.decoded.wind.text },
            { label: copy.metricLabels.visibility, value: report.decoded.visibility.text },
            {
              label: copy.metricLabels.runwayVisualRange,
              value: report.decoded.runwayVisualRange.text,
            },
            {
              label: copy.metricLabels.verticalVisibility,
              value: report.decoded.verticalVisibility.text,
            },
            { label: copy.metricLabels.altimeter, value: report.decoded.altimeter.text },
          ]}
        />
        <ReportSection
          kicker={copy.reportSections.thermal.kicker}
          title={copy.reportSections.thermal.title}
          accent="accent-mint"
          items={[
            { label: copy.metricLabels.temperature, value: report.decoded.temperature.text },
            { label: copy.metricLabels.dewPoint, value: report.decoded.dewPoint.text },
            { label: copy.metricLabels.clouds, value: report.decoded.cloudsText },
            { label: copy.metricLabels.weather, value: report.decoded.weather.text },
          ]}
        />
      </motion.div>

      <motion.div
        className="supplemental-grid"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
      >
        <TrendStripCard copy={copy} history={history} report={report} />
        <WatchoutsCard copy={copy} watchouts={watchouts} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <RemarksCard
          items={report.decoded.remarksItems}
          kicker={copy.remarks.kicker}
          title={copy.remarks.title}
        />
      </motion.div>

      {children}

      <footer className="result-footer">
        <span>Source NOAA</span>
      </footer>
    </article>
  )
}

type TrendStripCardProps = {
  copy: PersonaCopy
  history: MetarReport[]
  report: MetarReport
}

function TrendStripCard({ copy, history, report }: TrendStripCardProps) {
  const timeline = (history.length > 0 ? history : [report])
    .slice(0, 8)
    .sort((left, right) => new Date(left.observedAt).getTime() - new Date(right.observedAt).getTime())

  return (
    <section className="trend-card">
      <div className="report-section-header">
        <span className="panel-kicker">{copy.historyKicker}</span>
        <h4>{copy.historyTitle}</h4>
      </div>
      <div className="trend-strip" role="list" aria-label={copy.historyTitle}>
        {timeline.length > 0 ? (
          timeline.map((entry) => {
            const timeLabel = formatTrendTime(entry.observedAt)
            const ceilingFeet = getCeilingFeet(entry)
            const windLabel = entry.decoded.wind.speedKt != null ? `${entry.decoded.wind.speedKt} kt` : 'NR'
            const pressureLabel =
              entry.decoded.altimeter.inHg != null ? entry.decoded.altimeter.inHg.toFixed(2) : 'NR'

            return (
              <div className="trend-point" key={`${entry.station.icao}-${entry.observedAt}`} role="listitem">
                <div className="trend-point-header">
                  <span>{timeLabel}</span>
                  <span
                    className={clsx(
                      'trend-category',
                      entry.flightCategory?.toLowerCase() ?? 'unknown',
                    )}
                  >
                    {summarizeFlightCategory(entry.flightCategory)}
                  </span>
                </div>
                <dl className="trend-metrics">
                  <div>
                    <dt>Vis</dt>
                    <dd>{formatTrendVisibility(entry.decoded.visibility.miles)}</dd>
                  </div>
                  <div>
                    <dt>Ceil</dt>
                    <dd>{ceilingFeet != null ? `${ceilingFeet.toLocaleString()} ft` : 'None'}</dd>
                  </div>
                  <div>
                    <dt>Wind</dt>
                    <dd>{windLabel}</dd>
                  </div>
                  <div>
                    <dt>Alt</dt>
                    <dd>{pressureLabel}</dd>
                  </div>
                </dl>
              </div>
            )
          })
        ) : (
          <p className="empty-copy">{copy.historyEmpty}</p>
        )}
      </div>
    </section>
  )
}

type WatchoutsCardProps = {
  copy: PersonaCopy
  watchouts: Watchout[]
}

function WatchoutsCard({ copy, watchouts }: WatchoutsCardProps) {
  return (
    <section className="watchouts-card">
      <div className="report-section-header">
        <span className="panel-kicker">{copy.watchoutsKicker}</span>
        <h4>{copy.watchoutsTitle}</h4>
      </div>
      {watchouts.length > 0 ? (
        <div className="watchouts-list">
          {watchouts.map((watchout) => (
            <article className={clsx('watchout-item', `watchout-${watchout.severity}`)} key={`${watchout.title}-${watchout.detail}`}>
              <div className="watchout-heading">
                <span className="watchout-severity">{watchout.severity}</span>
                <strong>{watchout.title}</strong>
              </div>
              <p>{watchout.detail}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-copy">{copy.watchoutsEmpty}</p>
      )}
    </section>
  )
}

function formatUtc(value: string) {
  const date = new Date(value)

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date)
}

function formatTrendTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function formatTrendVisibility(value: number | null | undefined) {
  if (value == null) {
    return 'NR'
  }

  if (value >= 10) {
    return '10+ SM'
  }

  if (value < 1) {
    return `${value.toFixed(2)} SM`
  }

  return `${value} SM`
}

async function fetchMetarLookup(code: string) {
  const response = await fetch(`/api/metar?code=${code}`)
  const payload = (await response.json()) as MetarLookupResponse | { error?: string }

  if (!response.ok || !('rawMetar' in payload)) {
    throw new Error('error' in payload ? payload.error : METAR_FETCH_ERROR)
  }

  return {
    ...payload,
    history: Array.isArray(payload.history) ? payload.history : [payload],
  } satisfies MetarLookupResponse
}

function upsertLookupCodes(codes: string[]) {
  let nextRecentSearches = loadStoredCodes(RECENT_SEARCHES_STORAGE_KEY)

  for (const code of [...codes].reverse()) {
    nextRecentSearches = upsertStoredCode(RECENT_SEARCHES_STORAGE_KEY, code, MAX_HISTORY_ITEMS)
  }

  return nextRecentSearches
}

function shouldScrollAnalysisSectionIntoView(element: HTMLElement) {
  if (typeof window === 'undefined') {
    return false
  }

  const rect = element.getBoundingClientRect()
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight

  if (viewportHeight <= 0) {
    return false
  }

  const visibleTop = Math.max(rect.top, 0)
  const visibleBottom = Math.min(rect.bottom, viewportHeight)
  const visibleHeight = Math.max(0, visibleBottom - visibleTop)
  const elementHeight = rect.height > 0 ? rect.height : Math.max(rect.bottom - rect.top, 1)
  const minimumVisibleHeight = Math.min(elementHeight, viewportHeight) * 0.6

  return visibleHeight < minimumVisibleHeight
}

type EventStreamHandlers = {
  onDone: () => void
  onError: (message: string) => void
  onToken: (token: string) => void
}

async function consumeEventStream(
  stream: ReadableStream<Uint8Array>,
  handlers: EventStreamHandlers,
) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      let separatorIndex = buffer.indexOf('\n\n')

      while (separatorIndex !== -1) {
        const block = buffer.slice(0, separatorIndex)
        buffer = buffer.slice(separatorIndex + 2)
        processEventBlock(block, handlers)
        separatorIndex = buffer.indexOf('\n\n')
      }
    }

    if (buffer.trim()) {
      processEventBlock(buffer, handlers)
    }
  } finally {
    reader.releaseLock()
  }
}

function processEventBlock(block: string, handlers: EventStreamHandlers) {
  const lines = block.split('\n')
  let eventName = 'message'
  let data = ''

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
      continue
    }

    if (line.startsWith('data:')) {
      data += line.slice(5).trim()
    }
  }

  const parsedData = data ? (JSON.parse(data) as string) : ''

  if (eventName === 'token') {
    handlers.onToken(parsedData)
    return
  }

  if (eventName === 'error') {
    handlers.onError(parsedData || 'Pilot analysis failed.')
    return
  }

  if (eventName === 'done') {
    handlers.onDone()
  }
}

export default App
