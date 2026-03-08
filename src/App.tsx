import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import ReactMarkdown from 'react-markdown'
import {
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
import { useEffect, useRef, useState, type FormEvent } from 'react'
import './App.css'
import {
  METAR_FETCH_ERROR,
  type MetarReport,
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

type RequestState = 'idle' | 'loading' | 'success' | 'error'
type AnalysisState = 'idle' | 'streaming' | 'success' | 'error'

const MAX_HISTORY_ITEMS = 6

function App() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<RequestState>('idle')
  const [result, setResult] = useState<MetarReport | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [themeMode, setThemeMode] = useState<ThemeMode>('system')
  const [prefersDark, setPrefersDark] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisState>('idle')
  const [analysisMarkdown, setAnalysisMarkdown] = useState('')
  const [analysisError, setAnalysisError] = useState('')
  const analysisAbortRef = useRef<AbortController | null>(null)
  const analysisSectionRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setRecentSearches(loadStoredCodes(RECENT_SEARCHES_STORAGE_KEY))
    setFavorites(loadStoredCodes(FAVORITES_STORAGE_KEY))
    setThemeMode(loadStoredThemeMode())
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
    return () => {
      analysisAbortRef.current?.abort()
    }
  }, [])

  const activeTheme = resolveTheme(themeMode, prefersDark)

  const performLookup = async (requestedCode?: string) => {
    const code = normalizeAirportCode(requestedCode ?? query)
    setQuery(code)
    resetAnalysis()

    if (code.length !== 4) {
      setResult(null)
      setStatus('error')
      setErrorMessage('Enter a 4-letter ICAO airport code.')
      return
    }

    setResult(null)
    setStatus('loading')
    setErrorMessage('')

    try {
      const response = await fetch(`/api/metar?code=${code}`)
      const payload = (await response.json()) as MetarReport | { error?: string }

      if (!response.ok || !('rawMetar' in payload)) {
        throw new Error('error' in payload ? payload.error : METAR_FETCH_ERROR)
      }

      setResult(payload)
      setStatus('success')
      const nextRecents = upsertStoredCode(RECENT_SEARCHES_STORAGE_KEY, code, MAX_HISTORY_ITEMS)
      setRecentSearches(nextRecents)
    } catch (error) {
      setResult(null)
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : METAR_FETCH_ERROR)
    }
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void performLookup()
  }

  const onToggleFavorite = () => {
    if (!result) {
      return
    }

    const nextFavorites = toggleStoredCode(FAVORITES_STORAGE_KEY, result.station.icao, MAX_HISTORY_ITEMS)
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

  const isFavorite = result ? favorites.includes(result.station.icao) : false
  const themeLabel = themeMode === 'system' ? `${activeTheme} (auto)` : activeTheme
  const displayedFlightRules = result ? summarizeFlightCategory(result.flightCategory ?? null) : ''

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
    setAnalysisStatus('streaming')
    setAnalysisMarkdown('')
    setAnalysisError('')

    try {
      const payload: PilotAnalysisRequest = { report: result }
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
          setAnalysisStatus('success')
        },
        onError: (message) => {
          hasStreamError = true
          setAnalysisStatus('error')
          setAnalysisError(message)
        },
        onToken: (token) => {
          setAnalysisMarkdown((current) => current + token)
        },
      })

      if (!hasStreamError) {
        setAnalysisStatus('success')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      setAnalysisStatus('error')
      setAnalysisError(error instanceof Error ? error.message : 'Pilot analysis failed.')
    } finally {
      if (analysisAbortRef.current === abortController) {
        analysisAbortRef.current = null
      }
    }
  }

  const resetAnalysis = () => {
    analysisAbortRef.current?.abort()
    analysisAbortRef.current = null
    setAnalysisStatus('idle')
    setAnalysisMarkdown('')
    setAnalysisError('')
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
            <span className="top-bar-logo">MetarX</span>
            <div className="top-bar-divider" />
            <span className="top-bar-subtitle">Pilot Weather Briefing</span>
            <div className="top-bar-spacer" />
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
                      Loading
                    </>
                  ) : (
                    <>
                      <Telescope size={18} />
                      Decode METAR
                    </>
                  )}
                </motion.button>
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
                <span className="panel-kicker">Operational weather report</span>
                <h2>Current conditions</h2>
              </div>
              {result ? (
                <div className="panel-actions" role="group" aria-label="Result actions">
                  <motion.button
                    className="favorite-button"
                    type="button"
                    onClick={onToggleFavorite}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
                    {isFavorite ? 'Saved' : 'Save'}
                  </motion.button>
                </div>
              ) : null}
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
                  <p>Collecting the latest METAR and decoding station conditions.</p>
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
                  <h3>Lookup failed</h3>
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
                  <h3>Start with any ICAO code</h3>
                  <p>Try KJFK, EGLL, KLAX, or the airport you track most often.</p>
                </motion.div>
              ) : null}

              {status === 'success' && result ? (
                <motion.div
                  key={result.station.icao}
                  className="result-content"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <motion.header
                    className="station-header"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0 }}
                  >
                    <div>
                      <span className="station-code">{result.station.icao}</span>
                      <h3>{result.station.name}</h3>
                      <p className="station-subtitle">Observed {formatUtc(result.observedAt)} UTC</p>
                    </div>
                    <div
                      className={clsx(
                        'flight-chip',
                        result.flightCategory?.toLowerCase() ?? 'unknown',
                      )}
                    >
                      {summarizeFlightCategory(result.flightCategory)}
                    </div>
                  </motion.header>

                  <motion.section
                    className="raw-card"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <div className="raw-card-header">Raw METAR</div>
                    <code>{result.rawMetar}</code>
                  </motion.section>

                  <motion.div
                    className="report-grid"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    <ReportSection
                      kicker="Core"
                      title="Flight and atmosphere"
                      accent="accent-cyan"
                      items={[
                        { label: 'Flight Rules', value: displayedFlightRules },
                        { label: 'Wind', value: result.decoded.wind.text },
                        { label: 'Visibility', value: result.decoded.visibility.text },
                        {
                          label: 'Runway Visual Range',
                          value: result.decoded.runwayVisualRange.text,
                        },
                        {
                          label: 'Vertical Visibility',
                          value: result.decoded.verticalVisibility.text,
                        },
                        { label: 'Altimeter', value: result.decoded.altimeter.text },
                      ]}
                    />
                    <ReportSection
                      kicker="Thermal"
                      title="Temperature and moisture"
                      accent="accent-mint"
                      items={[
                        { label: 'Temperature', value: result.decoded.temperature.text },
                        { label: 'Dew Point', value: result.decoded.dewPoint.text },
                        { label: 'Clouds', value: result.decoded.cloudsText },
                        { label: 'Weather', value: result.decoded.weather.text },
                      ]}
                    />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <RemarksCard items={result.decoded.remarksItems} />
                  </motion.div>

                  <motion.section
                    ref={analysisSectionRef}
                    className={clsx(
                      'analysis-card',
                      analysisStatus === 'idle' && 'analysis-card--idle',
                    )}
                    role="region"
                    aria-label="Pilot perspective"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.24, duration: 0.3 }}
                  >
                    <div className="analysis-header">
                      <div>
                        <span className="panel-kicker">Pilot perspective</span>
                      </div>
                      {analysisStatus === 'streaming' ? (
                        <div className="analysis-status">
                          <LoaderCircle className="spin" size={16} />
                          Streaming
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
                          Refresh Perspective
                        </motion.button>
                      ) : null}
                    </div>

                    {analysisStatus === 'idle' ? (
                      <div className="analysis-empty-state">
                        <p>
                          Want the operational take? Generate an instructor-style read on this
                          METAR.
                        </p>
                        <motion.button
                          className="analysis-button analysis-button--primary"
                          type="button"
                          onClick={() => void requestPilotAnalysis()}
                          whileHover={{ scale: 1.03, y: -2 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <Sparkles size={16} />
                          Pilot Perspective
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
                          Retry Perspective
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
                            Senior-pilot perspective is streaming in.
                          </div>
                        ) : null}
                      </>
                    )}
                  </motion.section>

                  <footer className="result-footer">
                    <span>Source NOAA</span>
                  </footer>
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
              title="Recent searches"
              items={recentSearches}
              emptyLabel="No airport lookups yet."
              onSelect={(code) => void performLookup(code)}
            />
            <HistoryCard
              title="Favorites"
              items={favorites}
              emptyLabel="Save stations for quick access."
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
}

function RemarksCard({ items }: RemarksCardProps) {
  return (
    <section className="remarks-card">
      <div className="report-section-header">
        <span className="panel-kicker">Decoded remarks</span>
        <h4>Operational notes</h4>
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

function formatUtc(value: string) {
  const date = new Date(value)

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date)
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
