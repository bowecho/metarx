import { useEffect, useRef, useState } from 'react'
import {
  consumeEventStream,
  shouldScrollAnalysisSectionIntoView,
} from '../lib/appSupport'
import type { PilotAnalysisRequest } from '../lib/pilotAnalysis'
import type { PersonaMode } from '../lib/persona'
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

function createEmptyAnalysisState(): Record<PersonaMode, AnalysisEntry> {
  return {
    metard: { ...EMPTY_ANALYSIS_ENTRY },
    metarx: { ...EMPTY_ANALYSIS_ENTRY },
  }
}

export function usePilotAnalysis(personaMode: PersonaMode, result: MetarLookupResponse | null) {
  const [analysisByPersona, setAnalysisByPersona] = useState<Record<PersonaMode, AnalysisEntry>>(
    () => createEmptyAnalysisState(),
  )
  const analysisAbortRef = useRef<AbortController | null>(null)
  const analysisSectionRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    return () => {
      analysisAbortRef.current?.abort()
    }
  }, [])

  const activeAnalysis = analysisByPersona[personaMode]

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

  const resetAnalysis = () => {
    analysisAbortRef.current?.abort()
    analysisAbortRef.current = null
    setAnalysisByPersona(createEmptyAnalysisState())
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

  return {
    activeAnalysis,
    analysisSectionRef,
    requestPilotAnalysis,
    resetAnalysis,
  }
}
