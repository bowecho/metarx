import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  FAVORITES_STORAGE_KEY,
  MAX_STORED_CODES,
  RECENT_SEARCHES_STORAGE_KEY,
  loadStoredCodes,
  toggleStoredCode,
} from '../lib/storage'
import {
  fetchMetarLookup,
  upsertLookupCodes,
} from '../lib/appSupport'
import {
  METAR_FETCH_ERROR,
  normalizeAirportCode,
  type MetarLookupResponse,
} from '../lib/metar'

export type RequestState = 'idle' | 'loading' | 'success' | 'error'
export type SearchField = 'primary' | 'compare'

type UseMetarLookupOptions = {
  onBeforeLookup: () => void
}

export function useMetarLookup({ onBeforeLookup }: UseMetarLookupOptions) {
  const [query, setQuery] = useState('')
  const [compareEnabled, setCompareEnabled] = useState(false)
  const [compareQuery, setCompareQuery] = useState('')
  const [activeSearchField, setActiveSearchField] = useState<SearchField>('primary')
  const [status, setStatus] = useState<RequestState>('idle')
  const [result, setResult] = useState<MetarLookupResponse | null>(null)
  const [compareResult, setCompareResult] = useState<MetarLookupResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const lookupAbortRef = useRef<AbortController | null>(null)
  const lookupRequestIdRef = useRef(0)

  useEffect(() => {
    setRecentSearches(loadStoredCodes(RECENT_SEARCHES_STORAGE_KEY))
    setFavorites(loadStoredCodes(FAVORITES_STORAGE_KEY))
  }, [])

  useEffect(() => {
    return () => {
      lookupAbortRef.current?.abort()
    }
  }, [])

  const performLookup = async (requestedCode?: string, requestedCompareCode?: string) => {
    const code = normalizeAirportCode(requestedCode ?? query)
    const secondCode = compareEnabled
      ? normalizeAirportCode(requestedCompareCode ?? compareQuery)
      : ''
    setQuery(code)
    if (compareEnabled) {
      setCompareQuery(secondCode)
    }
    onBeforeLookup()
    lookupAbortRef.current?.abort()
    lookupAbortRef.current = null
    lookupRequestIdRef.current += 1

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
    const abortController = new AbortController()
    lookupAbortRef.current = abortController
    const requestId = lookupRequestIdRef.current

    try {
      const [primaryPayload, secondaryPayload] = await Promise.all([
        fetchMetarLookup(code, abortController.signal),
        compareEnabled ? fetchMetarLookup(secondCode, abortController.signal) : Promise.resolve(null),
      ])

      if (lookupRequestIdRef.current !== requestId) {
        return
      }

      setResult(primaryPayload)
      setCompareResult(secondaryPayload)
      setStatus('success')
      const nextRecents = upsertLookupCodes([code, secondCode].filter(Boolean))
      setRecentSearches(nextRecents)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      if (lookupRequestIdRef.current !== requestId) {
        return
      }

      setCompareResult(null)
      setResult(null)
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : METAR_FETCH_ERROR)
    } finally {
      if (lookupAbortRef.current === abortController) {
        lookupAbortRef.current = null
      }
    }
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void performLookup()
  }

  const assignSearchField = (field: SearchField, code: string) => {
    const normalizedCode = normalizeAirportCode(code)
    const otherCode = field === 'primary' ? compareQuery : query

    if (
      compareEnabled &&
      normalizedCode.length === 4 &&
      normalizedCode === normalizeAirportCode(otherCode)
    ) {
      return false
    }

    if (field === 'primary') {
      setQuery(normalizedCode)
    } else {
      setCompareQuery(normalizedCode)
    }

    return true
  }

  const onSelectSavedAirport = (code: string) => {
    if (!compareEnabled) {
      void performLookup(code)
      return
    }

    assignSearchField(activeSearchField, code)
  }

  const onToggleFavorite = (airportCode: string) => {
    const nextFavorites = toggleStoredCode(FAVORITES_STORAGE_KEY, airportCode, MAX_STORED_CODES)
    setFavorites(nextFavorites)
  }

  const disableCompare = () => {
    setCompareEnabled(false)
    setCompareQuery('')
    setCompareResult(null)
  }

  return {
    activeSearchField,
    assignSearchField,
    compareEnabled,
    compareQuery,
    compareResult,
    errorMessage,
    favorites,
    onSelectSavedAirport,
    onSubmit,
    onToggleFavorite,
    performLookup,
    query,
    recentSearches,
    result,
    setActiveSearchField,
    setCompareEnabled,
    setCompareQuery,
    setQuery,
    status,
    disableCompare,
  }
}
