import { lazy, Suspense, type RefObject } from 'react'
import { motion } from 'framer-motion'
import { LoaderCircle, RefreshCw, Sparkles } from 'lucide-react'
import type { PersonaCopy } from '../lib/persona'
import type { AnalysisEntry } from '../hooks/usePilotAnalysis'
import { CollapsibleSection } from './briefings'

const AnalysisMarkdown = lazy(() => import('./AnalysisMarkdown'))

function renderMarkdownFallback(markdown: string) {
  return markdown
    .replace(/^##\s*/gm, '')
    .replace(/^- /gm, '')
}

type AnalysisPanelProps = {
  activeAnalysis: AnalysisEntry
  analysisSectionRef: RefObject<HTMLElement | null>
  copy: PersonaCopy
  onRequest: () => void
}

export function AnalysisPanel({
  activeAnalysis,
  analysisSectionRef,
  copy,
  onRequest,
}: AnalysisPanelProps) {
  const analysisStatus = activeAnalysis.status
  const analysisMarkdown = activeAnalysis.markdown
  const analysisError = activeAnalysis.error

  return (
    <motion.section
      ref={analysisSectionRef}
      className={analysisStatus === 'idle' ? 'analysis-card analysis-card--idle' : 'analysis-card'}
      role="region"
      aria-label={copy.analysisRegionLabel}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.24, duration: 0.3 }}
    >
      <CollapsibleSection
        className="analysis-section"
        headerClassName="analysis-header"
        kicker={copy.analysisKicker}
        showToggle={analysisStatus !== 'idle'}
        actions={
          analysisStatus === 'streaming' ? (
            <div className="analysis-status">
              <LoaderCircle className="spin" size={16} />
              {copy.analysisStreamingLabel}
            </div>
          ) : analysisStatus === 'success' ? (
            <motion.button
              className="analysis-button"
              type="button"
              onClick={onRequest}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              <RefreshCw size={16} />
              {copy.analysisRefreshButton}
            </motion.button>
          ) : null
        }
      >
        {analysisStatus === 'idle' ? (
          <div className="analysis-empty-state">
            <p>{copy.analysisEmpty}</p>
            <motion.button
              className="analysis-button analysis-button--primary"
              type="button"
              onClick={onRequest}
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
              onClick={onRequest}
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
              <Suspense fallback={<div>{renderMarkdownFallback(analysisMarkdown)}</div>}>
                <AnalysisMarkdown markdown={analysisMarkdown} />
              </Suspense>
            </div>
            {analysisStatus === 'streaming' ? (
              <div className="analysis-streaming-indicator">
                <span />
                {copy.analysisStreamingNote}
              </div>
            ) : null}
          </>
        )}
      </CollapsibleSection>
    </motion.section>
  )
}
