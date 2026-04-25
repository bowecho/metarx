import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { ChevronDown, Star } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import {
  getCeilingFeet,
  type MetarReport,
  summarizeFlightCategory,
} from '../lib/metar'
import type { AppCopy } from '../lib/copy'
import {
  formatTrendDelta,
  formatTrendValue,
} from '../lib/appSupport'
import { formatAirportDateTime, formatAirportTime } from '../lib/timezone'

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

type RemarksCardProps = {
  items: string[]
  kicker: string
  title: string
}

type HistoryCardProps = {
  emptyLabel: string
  items: string[]
  kicker?: string
  onSelect: (code: string) => void
  title: string
}

type AirportBriefingProps = {
  children?: ReactNode
  copy: AppCopy
  history: MetarReport[]
  isFavorite: boolean
  onToggleFavorite: () => void
  report: MetarReport
}

type CompareAirportBriefingsProps = {
  copy: AppCopy
  leftHistory: MetarReport[]
  leftIsFavorite: boolean
  leftReport: MetarReport
  onToggleLeftFavorite: () => void
  onToggleRightFavorite: () => void
  rightHistory: MetarReport[]
  rightIsFavorite: boolean
  rightReport: MetarReport
}

type AirportSummaryProps = {
  copy: AppCopy
  isFavorite: boolean
  onToggleFavorite: () => void
  report: MetarReport
}

type CompareReportSectionProps = {
  accent: string
  itemsLeft: ReportMetric[]
  itemsRight: ReportMetric[]
  kicker: string
  title: string
}

type TrendStripCardProps = {
  copy: AppCopy
  history: MetarReport[]
  report: MetarReport
}

type TrendPoint = {
  altimeterInHg: number | null
  ceilingFeet: number | null
  flightCategory: string | null
  observedAt: string
  visibilityMiles: number | null
  windDirection: number | 'VRB' | null
  windGustKt: number | null
  windKt: number | null
}

type TrendMiniChartProps = {
  label: string
  unitLabel: string
  values: Array<number | null>
}

type CollapsibleSectionProps = {
  actions?: ReactNode
  children: ReactNode
  className: string
  defaultOpen?: boolean
  headerClassName?: string
  kicker?: string
  showToggle?: boolean
  title?: string
}

export function HistoryCard({ title, kicker, items, emptyLabel, onSelect }: HistoryCardProps) {
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

export function CollapsibleSection({
  actions,
  children,
  className,
  defaultOpen = true,
  headerClassName,
  kicker,
  showToggle = true,
  title,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const contentId = useId()
  const label = title ?? kicker ?? 'section'
  const isExpanded = showToggle ? isOpen : true

  return (
    <section className={clsx(className, !isExpanded && 'is-collapsed')}>
      <header className={clsx('collapsible-header', headerClassName)}>
        <div>
          {kicker ? <span className="panel-kicker">{kicker}</span> : null}
          {title ? <h4>{title}</h4> : null}
        </div>
        <div className="collapsible-header-actions">
          {actions}
          {showToggle ? (
            <button
              aria-controls={contentId}
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${label}`}
              className="section-toggle"
              type="button"
              onClick={() => setIsOpen((current) => !current)}
            >
              <ChevronDown className={clsx('section-toggle-icon', !isExpanded && 'is-collapsed')} size={16} />
            </button>
          ) : null}
        </div>
      </header>
      <AnimatePresence initial={false}>
        {isExpanded ? (
          <motion.div
            key="content"
            id={contentId}
            className="collapsible-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="collapsible-content-inner">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}

export function AirportBriefing({
  children,
  copy,
  history,
  isFavorite,
  onToggleFavorite,
  report,
}: AirportBriefingProps) {
  return (
    <article className="airport-briefing">
      <AirportSummaryCard
        copy={copy}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
        report={report}
      />
      <AirportRawCard copy={copy} report={report} />
      <AirportReportGrid copy={copy} report={report} />
      <AirportRemarksSection copy={copy} report={report} />
      <AirportSupplementalGrid copy={copy} history={history} report={report} />
      {children}
      <footer className="result-footer">
        <span>Source NOAA</span>
      </footer>
    </article>
  )
}

export function CompareAirportBriefings({
  copy,
  leftHistory,
  leftIsFavorite,
  leftReport,
  onToggleLeftFavorite,
  onToggleRightFavorite,
  rightHistory,
  rightIsFavorite,
  rightReport,
}: CompareAirportBriefingsProps) {
  return (
    <div className="compare-layout">
      <div className="compare-row">
        <AirportSummaryCard
          copy={copy}
          isFavorite={leftIsFavorite}
          onToggleFavorite={onToggleLeftFavorite}
          report={leftReport}
        />
        <AirportSummaryCard
          copy={copy}
          isFavorite={rightIsFavorite}
          onToggleFavorite={onToggleRightFavorite}
          report={rightReport}
        />
      </div>
      <div className="compare-row">
        <AirportRawCard copy={copy} report={leftReport} />
        <AirportRawCard copy={copy} report={rightReport} />
      </div>
      <CompareReportSection
        accent="accent-cyan"
        itemsLeft={getAtmosphereMetrics(copy, leftReport)}
        itemsRight={getAtmosphereMetrics(copy, rightReport)}
        kicker={copy.reportSections.atmosphere.kicker}
        title={copy.reportSections.atmosphere.title}
      />
      <CompareReportSection
        accent="accent-mint"
        itemsLeft={getThermalMetrics(copy, leftReport)}
        itemsRight={getThermalMetrics(copy, rightReport)}
        kicker={copy.reportSections.thermal.kicker}
        title={copy.reportSections.thermal.title}
      />
      <div className="compare-row">
        <AirportRemarksSection copy={copy} report={leftReport} />
        <AirportRemarksSection copy={copy} report={rightReport} />
      </div>
      <div className="compare-row">
        <TrendStripCard copy={copy} history={leftHistory} report={leftReport} />
        <TrendStripCard copy={copy} history={rightHistory} report={rightReport} />
      </div>
      <div className="compare-row compare-row--footer">
        <footer className="result-footer">
          <span>Source NOAA</span>
        </footer>
        <footer className="result-footer">
          <span>Source NOAA</span>
        </footer>
      </div>
    </div>
  )
}

function ReportSection({ accent, items, kicker, title }: ReportSectionProps) {
  return (
    <CollapsibleSection
      className={clsx('report-section', accent)}
      headerClassName="report-section-header"
      kicker={kicker}
      title={title}
    >
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
    </CollapsibleSection>
  )
}

function RemarksCard({ items, kicker, title }: RemarksCardProps) {
  return (
    <CollapsibleSection
      className="remarks-card"
      headerClassName="report-section-header"
      kicker={kicker}
      title={title}
    >
      <div className="remarks-list">
        {items.map((item) => (
          <div className="remarks-item" key={item}>
            {item}
          </div>
        ))}
      </div>
    </CollapsibleSection>
  )
}

function AirportSummaryCard({ copy, isFavorite, onToggleFavorite, report }: AirportSummaryProps) {
  const displayedFlightRules = summarizeFlightCategory(report.flightCategory ?? null)

  return (
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
          {copy.observedPrefix} {formatAirportDateTime(report.observedAt, report.station)}
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
  )
}

function AirportRawCard({ copy, report }: Pick<AirportBriefingProps, 'copy' | 'report'>) {
  return (
    <motion.section
      className="raw-card-shell"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <CollapsibleSection className="raw-card" headerClassName="raw-card-header" title={copy.rawMetarLabel}>
        <code>{report.rawMetar}</code>
      </CollapsibleSection>
    </motion.section>
  )
}

function AirportReportGrid({ copy, report }: Pick<AirportBriefingProps, 'copy' | 'report'>) {
  return (
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
        items={getAtmosphereMetrics(copy, report)}
      />
      <ReportSection
        kicker={copy.reportSections.thermal.kicker}
        title={copy.reportSections.thermal.title}
        accent="accent-mint"
        items={getThermalMetrics(copy, report)}
      />
    </motion.div>
  )
}

function AirportSupplementalGrid({
  copy,
  history,
  report,
}: Pick<AirportBriefingProps, 'copy' | 'history' | 'report'>) {
  return (
    <motion.div
      className="supplemental-grid supplemental-grid--solo"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
    >
      <TrendStripCard copy={copy} history={history} report={report} />
    </motion.div>
  )
}

function AirportRemarksSection({ copy, report }: Pick<AirportBriefingProps, 'copy' | 'report'>) {
  return (
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
  )
}

function CompareReportSection({
  accent,
  itemsLeft,
  itemsRight,
  kicker,
  title,
}: CompareReportSectionProps) {
  return (
    <CollapsibleSection
      className={clsx('compare-report-section', accent)}
      headerClassName="report-section-header"
      kicker={kicker}
      title={title}
    >
      <div className="compare-metrics-grid">
        {itemsLeft.map((item, index) => (
          <article className="compare-metric-row" key={item.label}>
            <span className="compare-metric-label">{item.label}</span>
            <div className="compare-metric-value">{item.value}</div>
            <div className="compare-metric-value">{itemsRight[index]?.value ?? 'Not reported'}</div>
          </article>
        ))}
      </div>
    </CollapsibleSection>
  )
}

function TrendStripCard({ copy, history, report }: TrendStripCardProps) {
  const timeline = getTrendTimeline(history, report)
  const trendSummary = summarizeTrendTimeline(timeline)
  const airportCoordinates = report.station
  const chartSeries = [
    {
      label: 'Visibility',
      unitLabel: 'SM',
      values: timeline.map((entry) => entry.visibilityMiles),
    },
    {
      label: 'Ceiling',
      unitLabel: 'ft',
      values: timeline.map((entry) => entry.ceilingFeet),
    },
    {
      label: 'Altimeter',
      unitLabel: 'inHg',
      values: timeline.map((entry) => entry.altimeterInHg),
    },
  ]

  return (
    <CollapsibleSection
      className="trend-card"
      headerClassName="report-section-header"
      kicker={copy.historyKicker}
      title={copy.historyTitle}
    >
      <p className="trend-summary">{trendSummary}</p>
      <div className="trend-times" role="list" aria-label={copy.historyTitle}>
        {timeline.length > 0 ? (
          timeline.map((entry) => {
            const timeLabel = formatAirportTime(entry.observedAt, airportCoordinates)

            return (
              <div className="trend-time-point" key={entry.observedAt} role="listitem">
                <span>{timeLabel}</span>
                <span
                  className={clsx(
                    'trend-category',
                    entry.flightCategory?.toLowerCase() ?? 'unknown',
                  )}
                >
                  {summarizeFlightCategory(entry.flightCategory)}
                </span>
                <span className="trend-time-wind">{formatTrendWindSnapshot(entry)}</span>
              </div>
            )
          })
        ) : (
          <p className="empty-copy">{copy.historyEmpty}</p>
        )}
      </div>
      <div className="trend-chart-grid">
        {chartSeries.map((series) => (
          <TrendMiniChart
            key={series.label}
            label={series.label}
            unitLabel={series.unitLabel}
            values={series.values}
          />
        ))}
      </div>
    </CollapsibleSection>
  )
}

function TrendMiniChart({ label, unitLabel, values }: TrendMiniChartProps) {
  const chartPoints = buildSparklinePoints(values)
  const latestValue = values.at(-1)
  const previousValue = values.length > 1 ? values.at(-2) : null
  const deltaText = formatTrendDelta(latestValue ?? null, previousValue ?? null, unitLabel)

  return (
    <section className="trend-mini-chart">
      <div className="trend-mini-chart-header">
        <span>{label}</span>
        <strong>{formatTrendValue(latestValue ?? null, unitLabel)}</strong>
      </div>
      <svg aria-label={`${label} trend graph`} className="trend-sparkline" viewBox="0 0 100 36" preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id={`trend-gradient-${label.replace(/\s+/g, '-').toLowerCase()}`} x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent-violet)" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <path d={chartPoints.areaPath} fill={`url(#trend-gradient-${label.replace(/\s+/g, '-').toLowerCase()})`} />
        <path className="trend-sparkline-line" d={chartPoints.linePath} fill="none" />
        {chartPoints.points.map((point, index) => (
          <circle className="trend-sparkline-dot" cx={point.x} cy={point.y} key={`${label}-${index}`} r={index === chartPoints.points.length - 1 ? 2.5 : 2} />
        ))}
      </svg>
      <div className="trend-mini-chart-footer">
        <span>{deltaText}</span>
      </div>
    </section>
  )
}

function getAtmosphereMetrics(copy: AppCopy, report: MetarReport): ReportMetric[] {
  return [
    { label: copy.metricLabels.flightRules, value: summarizeFlightCategory(report.flightCategory ?? null) },
    { label: copy.metricLabels.wind, value: report.decoded.wind.text },
    { label: copy.metricLabels.visibility, value: report.decoded.visibility.text },
    { label: copy.metricLabels.runwayVisualRange, value: report.decoded.runwayVisualRange.text },
    { label: copy.metricLabels.verticalVisibility, value: report.decoded.verticalVisibility.text },
    { label: copy.metricLabels.altimeter, value: report.decoded.altimeter.text },
  ]
}

function getThermalMetrics(copy: AppCopy, report: MetarReport): ReportMetric[] {
  return [
    { label: copy.metricLabels.temperature, value: report.decoded.temperature.text },
    { label: copy.metricLabels.dewPoint, value: report.decoded.dewPoint.text },
    { label: copy.metricLabels.clouds, value: report.decoded.cloudsText },
    { label: copy.metricLabels.weather, value: report.decoded.weather.text },
  ]
}

function getTrendTimeline(history: MetarReport[], report: MetarReport): TrendPoint[] {
  return (history.length > 0 ? history : [report])
    .slice(0, 12)
    .sort((left, right) => new Date(left.observedAt).getTime() - new Date(right.observedAt).getTime())
    .slice(-4)
    .map((entry) => ({
      altimeterInHg: entry.decoded.altimeter.inHg ?? null,
      ceilingFeet: getCeilingFeet(entry),
      flightCategory: entry.flightCategory ?? null,
      observedAt: entry.observedAt,
      visibilityMiles: entry.decoded.visibility.miles ?? null,
      windDirection: entry.decoded.wind.directionDegrees ?? null,
      windGustKt: entry.decoded.wind.gustKt ?? null,
      windKt: entry.decoded.wind.speedKt ?? null,
    }))
}

function summarizeTrendTimeline(timeline: TrendPoint[]) {
  if (timeline.length <= 1) {
    return 'Trend summary: only one recent report is available right now.'
  }

  return `Trend summary: visibility ${describeTrendDirection(timeline.map((point) => point.visibilityMiles), 'improving', 'worsening')}, ceiling ${describeTrendDirection(timeline.map((point) => point.ceilingFeet), 'lifting', 'lowering')}, pressure ${describeTrendDirection(timeline.map((point) => point.altimeterInHg), 'rising', 'falling')}, wind ${summarizeWindTrend(timeline)}.`
}

function describeTrendDirection(
  values: Array<number | null>,
  positiveDirection: string,
  negativeDirection: string,
) {
  const numericValues = values.filter((value): value is number => value != null)
  if (numericValues.length <= 1) {
    return 'steady'
  }

  const firstValue = numericValues[0]
  const lastValue = numericValues[numericValues.length - 1]
  const span = Math.abs(lastValue - firstValue)
  const baseline = Math.max(Math.abs(firstValue), Math.abs(lastValue), 1)

  if (span / baseline < 0.08) {
    return 'steady'
  }

  return lastValue > firstValue ? positiveDirection : negativeDirection
}

function summarizeWindTrend(timeline: TrendPoint[]) {
  const speedDirection = describeTrendDirection(
    timeline.map((point) => point.windKt),
    'building',
    'easing',
  )
  const earliestDirection = timeline.find((point) => point.windDirection != null)?.windDirection ?? null
  const latestDirection = [...timeline].reverse().find((point) => point.windDirection != null)?.windDirection ?? null
  const latestGust = [...timeline].reverse().find((point) => point.windGustKt != null)?.windGustKt ?? null
  const earliestGust = timeline.find((point) => point.windGustKt != null)?.windGustKt ?? null

  let directionText = 'holding fairly steady'
  if (earliestDirection === 'VRB' || latestDirection === 'VRB') {
    directionText = 'staying variable'
  } else if (typeof earliestDirection === 'number' && typeof latestDirection === 'number') {
    const angularShift = getAngularShift(earliestDirection, latestDirection)

    if (angularShift >= 25) {
      directionText = `${isClockwiseShift(earliestDirection, latestDirection) ? 'veering' : 'backing'} from ${formatWindDirection(earliestDirection)} to ${formatWindDirection(latestDirection)}`
    }
  }

  let gustText = 'no gusts reported'
  if (latestGust != null && earliestGust != null && Math.abs(latestGust - earliestGust) >= 3) {
    gustText = latestGust > earliestGust ? `gusts building to ${latestGust} kt` : `gusts easing to ${latestGust} kt`
  } else if (latestGust != null) {
    gustText = `gusts to ${latestGust} kt`
  } else if (earliestGust != null) {
    gustText = 'gusts have dropped out'
  }

  return `${directionText}, speed ${speedDirection}, ${gustText}`
}

function getAngularShift(firstDirection: number, lastDirection: number) {
  const clockwiseShift = (lastDirection - firstDirection + 360) % 360
  return Math.min(clockwiseShift, 360 - clockwiseShift)
}

function isClockwiseShift(firstDirection: number, lastDirection: number) {
  const clockwiseShift = (lastDirection - firstDirection + 360) % 360
  return clockwiseShift !== 0 && clockwiseShift <= 180
}

function formatTrendWindSnapshot(point: TrendPoint) {
  const directionText = formatWindDirection(point.windDirection)
  const speedText = point.windKt != null ? `${Math.round(point.windKt)} kt` : 'NR'
  const gustText = point.windGustKt != null ? ` G${Math.round(point.windGustKt)}` : ''

  return `${directionText} ${speedText}${gustText}`.trim()
}

function formatWindDirection(direction: number | 'VRB' | null) {
  if (direction == null) {
    return 'NR'
  }

  if (direction === 'VRB') {
    return 'VRB'
  }

  return `${Math.round(direction).toString().padStart(3, '0')}°`
}

function buildSparklinePoints(values: Array<number | null>) {
  const safeValues = values.map((value, index) => value ?? values[index - 1] ?? 0)
  const minValue = Math.min(...safeValues)
  const maxValue = Math.max(...safeValues)
  const valueSpan = maxValue - minValue || 1
  const xStep = safeValues.length > 1 ? 100 / (safeValues.length - 1) : 100

  const points = safeValues.map((value, index) => ({
    x: Number((index * xStep).toFixed(2)),
    y: Number((30 - ((value - minValue) / valueSpan) * 24).toFixed(2)),
  }))

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const areaPath = `${linePath} L ${points.at(-1)?.x ?? 100} 34 L ${points[0]?.x ?? 0} 34 Z`

  return { areaPath, linePath, points }
}
