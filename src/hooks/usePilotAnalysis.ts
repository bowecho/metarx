import { useEffect, useRef, useState } from 'react'
import {
  consumeEventStream,
  shouldScrollAnalysisSectionIntoView,
} from '../lib/appSupport'
import type { PilotAnalysisRequest } from '../lib/pilotAnalysis'
import type { MetarLookupResponse } from '../lib/metar'

export type AnalysisState = 'idle' | 'streaming' | 'success' | 'error'

export type AnalysisEntry = {
  error: string
  markdown: string
  status: AnalysisState
}

const EMPTY_ANALYSIS_ENTRY: AnalysisEntry = {
  error: '',
  markdown: '',
  status: 'idle',
}

export function usePilotAnalysis(result: MetarLookupResponse | null) {
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisEntry>(EMPTY_ANALYSIS_ENTRY)
  const analysisAbortRef = useRef<AbortController | null>(null)
  const analysisSectionRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    return () => {
      analysisAbortRef.current?.abort()
    }
  }, [])

  const setAnalysisState = (nextEntry: Partial<AnalysisEntry>) => {
    setActiveAnalysis((current) => ({
      ...current,
      ...nextEntry,
    }))
  }

  const appendAnalysisMarkdown = (token: string) => {
    setActiveAnalysis((current) => ({
      ...current,
      markdown: current.markdown + token,
    }))
  }

  const resetAnalysis = () => {
    analysisAbortRef.current?.abort()
    analysisAbortRef.current = null
    setActiveAnalysis({ ...EMPTY_ANALYSIS_ENTRY })
  }

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
    setAnalysisState({
      error: '',
      markdown: '',
      status: 'streaming',
    })

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
          setAnalysisState({
            status: 'success',
          })
        },
        onError: (message) => {
          hasStreamError = true
          setAnalysisState({
            error: message,
            status: 'error',
          })
        },
        onToken: (token) => {
          appendAnalysisMarkdown(token)
        },
      })

      if (!hasStreamError) {
        setAnalysisState({
          status: 'success',
        })
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      setAnalysisState({
        error: error instanceof Error ? error.message : 'Pilot analysis failed.',
        status: 'error',
      })
    } finally {
      if (analysisAbortRef.current === abortController) {
        analysisAbortRef.current = null
      }
    }
  }

  return {
    activeAnalysis,
    analysisSectionRef,
    requestPilotAnalysis,
    resetAnalysis,
  }
}
