import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import {
  ArrowLeftRight,
  LoaderCircle,
  Moon,
  Search,
  ShieldAlert,
  Sun,
  Telescope,
  Wind,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import './App.css'
import { AnalysisPanel } from './components/AnalysisPanel'
import {
  AirportBriefing,
  CompareAirportBriefings,
  HistoryCard,
} from './components/briefings'
import { useMetarLookup } from './hooks/useMetarLookup'
import { usePilotAnalysis } from './hooks/usePilotAnalysis'
import { normalizeAirportCode } from './lib/metar'
import { APP_COPY } from './lib/copy'
import {
  type ThemeMode,
  loadStoredThemeMode,
  resolveTheme,
  saveThemeMode,
} from './lib/theme'

function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => loadStoredThemeMode())
  const [prefersDark, setPrefersDark] = useState(false)

  const {
    compareEnabled,
    compareQuery,
    compareResult,
    disableCompare,
    errorMessage,
    favorites,
    onSelectSavedAirport,
    onSubmit,
    onToggleFavorite,
    query,
    recentSearches,
    result,
    setActiveSearchField,
    setCompareEnabled,
    setCompareQuery,
    setQuery,
    status,
  } = useMetarLookup({
    onBeforeLookup: () => {
      resetAnalysis()
    },
  })

  const {
    activeAnalysis,
    analysisSectionRef,
    requestPilotAnalysis,
    resetAnalysis,
  } = usePilotAnalysis(result)

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
  const themeLabel = themeMode === 'system' ? `${activeTheme} (auto)` : activeTheme
  const copy = APP_COPY

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

  const onCompareToggle = () => {
    if (compareEnabled) {
      disableCompare()
      return
    }

    setCompareEnabled(true)
  }

  const onAnalysisRequest = () => {
    void requestPilotAnalysis()
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
                  onFocus={() => setActiveSearchField('primary')}
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
                  onClick={onCompareToggle}
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
                      onFocus={() => setActiveSearchField('compare')}
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
                  {compareResult ? (
                    <CompareAirportBriefings
                      copy={copy}
                      leftHistory={result.history}
                      leftIsFavorite={favorites.includes(result.station.icao)}
                      leftReport={result}
                      rightHistory={compareResult.history}
                      rightIsFavorite={favorites.includes(compareResult.station.icao)}
                      rightReport={compareResult}
                      onToggleLeftFavorite={() => onToggleFavorite(result.station.icao)}
                      onToggleRightFavorite={() => onToggleFavorite(compareResult.station.icao)}
                    />
                  ) : (
                    <AirportBriefing
                      copy={copy}
                      history={result.history}
                      isFavorite={favorites.includes(result.station.icao)}
                      onToggleFavorite={() => onToggleFavorite(result.station.icao)}
                      report={result}
                    >
                      <AnalysisPanel
                        activeAnalysis={activeAnalysis}
                        analysisSectionRef={analysisSectionRef}
                        copy={copy}
                        onRequest={onAnalysisRequest}
                      />
                    </AirportBriefing>
                  )}
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
              onSelect={onSelectSavedAirport}
            />
            <HistoryCard
              title={copy.favoritesTitle}
              items={favorites}
              emptyLabel={copy.favoritesEmpty}
              onSelect={onSelectSavedAirport}
            />
          </motion.aside>
        </div>
      </motion.main>
    </div>
  )
}

export default App
