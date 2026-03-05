import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { CloudSun, LoaderCircle, Moon, Search, Star, Sun, Telescope, Wind } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
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

type RequestState = 'idle' | 'loading' | 'success' | 'error'

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

  const activeTheme = resolveTheme(themeMode, prefersDark)

  const performLookup = async (requestedCode?: string) => {
    const code = normalizeAirportCode(requestedCode ?? query)
    setQuery(code)

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

  return (
    <div className="app-shell">
      <div className="app-grid" />
      <motion.main
        className="app"
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
      >
        <motion.section
          className="hero-panel"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.45 }}
        >
          <div className="hero-copy">
            <span className="eyebrow">Aviation weather, decoded fast</span>
            <h1>MetarX</h1>
            <p>
              Look up live airport METARs, decode the report into pilot-friendly weather
              signals, and keep the stations you monitor most close at hand.
            </p>
          </div>

          <div className="hero-actions">
            <form className="search-form" onSubmit={onSubmit}>
              <label className="search-label" htmlFor="airport-code">
                ICAO airport code
              </label>
              <div className="search-row">
                <div className="input-wrap">
                  <Search size={18} />
                  <input
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
              </div>
              <button className="primary-button" type="submit" disabled={status === 'loading'}>
                  {status === 'loading' ? (
                    <>
                      <LoaderCircle className="spin" size={18} />
                      Loading
                    </>
                  ) : (
                    <>
                      <Telescope size={18} />
                      Analyze METAR
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="toolbar">
              <button
                aria-label={`Theme mode: ${themeLabel}`}
                className="theme-button"
                type="button"
                onClick={onThemeChange}
              >
                {activeTheme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                Theme: {themeLabel}
              </button>
              <div className="toolbar-note">
                <CloudSun size={16} />
                NOAA source via proxy
              </div>
            </div>
          </div>
        </motion.section>

        <div className="content-grid">
          <motion.section
            className="results-panel glass-card"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.45 }}
          >
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Decoded weather</span>
                <h2>Current conditions</h2>
              </div>
              {result ? (
                <button className="favorite-button" type="button" onClick={onToggleFavorite}>
                  <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
                  {isFavorite ? 'Saved' : 'Save'}
                </button>
              ) : null}
            </div>

            <AnimatePresence mode="wait">
              {status === 'loading' ? (
                <motion.div
                  key="loading"
                  className="loading-state"
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
                  className="message-state error"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <h3>Lookup failed</h3>
                  <p>{errorMessage}</p>
                </motion.div>
              ) : null}

              {status !== 'loading' && status !== 'error' && !result ? (
                <motion.div
                  key="idle"
                  className="message-state idle"
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
                  <header className="station-header">
                    <div>
                      <span className="station-code">{result.station.icao}</span>
                      <h3>{result.station.name}</h3>
                    </div>
                    <div
                      className={clsx(
                        'flight-chip',
                        result.flightCategory?.toLowerCase() ?? 'unknown',
                      )}
                    >
                      {summarizeFlightCategory(result.flightCategory)}
                    </div>
                  </header>

                  <section className="raw-card">
                    <span>Raw METAR</span>
                    <code>{result.rawMetar}</code>
                  </section>

                    <section className="metrics-grid">
                      <MetricCard
                        label="Flight Rules"
                        value={summarizeFlightCategory(result.flightCategory)}
                      />
                      <MetricCard label="Wind" value={result.decoded.wind.text} />
                      <MetricCard label="Visibility" value={result.decoded.visibility.text} />
                      <MetricCard label="Clouds" value={result.decoded.cloudsText} />
                      <MetricCard label="Temperature" value={result.decoded.temperature.text} />
                      <MetricCard label="Dew Point" value={result.decoded.dewPoint.text} />
                      <MetricCard label="Altimeter" value={result.decoded.altimeter.text} />
                      <MetricCard label="Weather" value={result.decoded.weather.text} />
                    </section>

                    <RemarksCard items={result.decoded.remarksItems} />

                  <footer className="result-footer">
                    <span>Observed {formatUtc(result.observedAt)}</span>
                    <span>
                      {result.station.lat.toFixed(2)}, {result.station.lon.toFixed(2)}
                    </span>
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

type MetricCardProps = {
  label: string
  value: string
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

type RemarksCardProps = {
  items: string[]
}

function RemarksCard({ items }: RemarksCardProps) {
  return (
    <section className="remarks-card">
      <span>Remarks</span>
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
  title: string
  items: string[]
  emptyLabel: string
  onSelect: (code: string) => void
}

function HistoryCard({ title, items, emptyLabel, onSelect }: HistoryCardProps) {
  return (
    <section className="glass-card history-card">
      <div className="panel-header compact">
        <div>
          <span className="panel-kicker">Quick access</span>
          <h2>{title}</h2>
        </div>
      </div>
      {items.length > 0 ? (
        <div className="chip-wrap">
          {items.map((item) => (
            <button className="history-chip" key={item} type="button" onClick={() => onSelect(item)}>
              {item}
            </button>
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

export default App
