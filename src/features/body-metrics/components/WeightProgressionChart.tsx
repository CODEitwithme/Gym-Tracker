import { useId, useState } from 'react'
import { Plus, Scale } from 'lucide-react'
import { Button, Card } from '../../../components/common'
import type { BodyMetricsPeriod, WeightProgressionData } from '../bodyMetricsService'

interface WeightProgressionChartProps {
  data: WeightProgressionData
  period: BodyMetricsPeriod
  onPeriodChange: (period: BodyMetricsPeriod) => void
  unit: 'kg' | 'lb'
  onUnitChange: (unit: 'kg' | 'lb') => void
  onOpenLogWeight: () => void
}

export function WeightProgressionChart({
  data,
  period,
  onPeriodChange,
  unit,
  onUnitChange,
  onOpenLogWeight,
}: WeightProgressionChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const gradientId = useId()

  const { points, startWeight, currentWeight, deltaWeight, weeklyRateKg } = data

  // Chart Dimensions
  const svgWidth = 800
  const svgHeight = 280
  const padding = { top: 25, right: 35, bottom: 45, left: 55 }
  const chartW = svgWidth - padding.left - padding.right
  const chartH = svgHeight - padding.top - padding.bottom

  const allWeights = points.map((p) => p.displayWeight)
  const rawMin = allWeights.length ? Math.min(...allWeights) : 70
  const rawMax = allWeights.length ? Math.max(...allWeights) : 80
  const rangePadding = Math.max(1, (rawMax - rawMin) * 0.15)
  const minVal = Math.floor(rawMin - rangePadding)
  const maxVal = Math.ceil(rawMax + rangePadding)
  const valRange = Math.max(1, maxVal - minVal)

  // Scale Functions
  const getX = (index: number) => {
    if (points.length <= 1) return padding.left + chartW / 2
    return padding.left + (index / (points.length - 1)) * chartW
  }

  const getY = (val: number) => {
    return padding.top + chartH - ((val - minVal) / valRange) * chartH
  }

  // Construct SVG paths
  const rawPointsStr = points.map((p, i) => `${getX(i)},${getY(p.displayWeight)}`).join(' ')
  const maPointsStr = points
    .map((p, i) => `${getX(i)},${getY(p.displayMovingAverage)}`)
    .join(' ')

  const areaPath =
    points.length > 1
      ? `M ${getX(0)},${padding.top + chartH} ` +
        points.map((p, i) => `L ${getX(i)},${getY(p.displayMovingAverage)}`).join(' ') +
        ` L ${getX(points.length - 1)},${padding.top + chartH} Z`
      : ''

  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null

  return (
    <Card className="space-y-6">
      {/* Header with Title and Controls */}
      <div className="flex flex-col justify-between gap-4 border-b border-line pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Scale size={18} />
            </span>
            <h2 className="text-lg font-bold text-ink">Body Weight Progression</h2>
          </div>
          <p className="mt-1 text-xs text-muted">
            Raw weigh-ins with a 7-day moving average to smooth out daily water fluctuations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Unit Toggle */}
          <div className="flex rounded-lg border border-line bg-surface p-1">
            <button
              type="button"
              onClick={() => onUnitChange('kg')}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                unit === 'kg' ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              kg
            </button>
            <button
              type="button"
              onClick={() => onUnitChange('lb')}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                unit === 'lb' ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              lb
            </button>
          </div>

          {/* Period Selector */}
          <div className="flex rounded-lg border border-line bg-surface p-1">
            {(['7d', '30d', '90d', 'all'] as BodyMetricsPeriod[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPeriodChange(p)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold uppercase transition-colors ${
                  period === p ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <Button
            size="small"
            variant="primary"
            icon={Plus}
            onClick={onOpenLogWeight}
          >
            Log Weight
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      {points.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface p-3.5">
            <p className="text-xs text-muted">Starting Weight</p>
            <p className="mt-1 text-xl font-bold text-ink sm:text-2xl">
              {startWeight} <span className="text-xs font-normal text-muted">{unit}</span>
            </p>
          </div>

          <div className="rounded-xl border border-line bg-surface p-3.5">
            <p className="text-xs text-muted">Latest Weigh-In</p>
            <p className="mt-1 text-xl font-bold text-ink sm:text-2xl">
              {currentWeight} <span className="text-xs font-normal text-muted">{unit}</span>
            </p>
          </div>

          <div className="rounded-xl border border-line bg-surface p-3.5">
            <p className="text-xs text-muted">Period Change</p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <p
                className={`text-xl font-bold sm:text-2xl ${
                  (deltaWeight ?? 0) < 0
                    ? 'text-warning'
                    : (deltaWeight ?? 0) > 0
                      ? 'text-success'
                      : 'text-ink'
                }`}
              >
                {(deltaWeight ?? 0) > 0 ? '+' : ''}
                {deltaWeight} {unit}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface p-3.5">
            <p className="text-xs text-muted">Weekly Rate</p>
            <p className="mt-1 text-xl font-bold text-ink sm:text-2xl">
              {weeklyRateKg !== null ? (
                <>
                  {weeklyRateKg > 0 ? '+' : ''}
                  {unit === 'kg'
                    ? weeklyRateKg
                    : Math.round(weeklyRateKg * 2.20462 * 10) / 10}{' '}
                  <span className="text-xs font-normal text-muted">{unit}/wk</span>
                </>
              ) : (
                '—'
              )}
            </p>
          </div>
        </div>
      )}

      {/* Main Chart Area */}
      {points.length === 0 ? (
        <div className="py-12 text-center">
          <Scale size={32} className="mx-auto text-muted/50" />
          <p className="mt-3 text-sm font-semibold text-ink">No weigh-in records found</p>
          <p className="mt-1 text-xs text-muted">
            Start logging your morning weigh-ins to see weight trends and 7-day smoothing curves.
          </p>
          <div className="mt-4">
            <Button size="small" variant="primary" icon={Plus} onClick={onOpenLogWeight}>
              Log First Weigh-In
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full min-w-[500px] select-none overflow-visible"
              aria-label="Body weight progression chart"
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = padding.top + chartH * (1 - ratio)
                const val = Math.round(minVal + valRange * ratio)
                return (
                  <g key={ratio}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={padding.left + chartW}
                      y2={y}
                      stroke="currentColor"
                      strokeOpacity="0.08"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={padding.left - 10}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-muted text-[11px] font-mono"
                    >
                      {val}
                    </text>
                  </g>
                )
              })}

              {/* Moving Average Area Fill */}
              {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

              {/* Raw Weigh-In Line (subtle) */}
              {points.length > 1 && (
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.25"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  points={rawPointsStr}
                />
              )}

              {/* 7-day Moving Average (Continuous Accent line) */}
              {points.length > 1 && (
                <polyline
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={maPointsStr}
                />
              )}

              {/* Interactive Data Points */}
              {points.map((p, i) => {
                const cx = getX(i)
                const cy = getY(p.displayWeight)
                const isHovered = hoveredIndex === i

                return (
                  <g
                    key={p.date}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 6 : 3.5}
                      className={
                        isHovered
                          ? 'fill-accent stroke-panel stroke-2'
                          : 'fill-ink/70 hover:fill-accent'
                      }
                    />
                  </g>
                )
              })}

              {/* Date Labels on X-axis */}
              {points.map((p, i) => {
                if (
                  points.length > 10 &&
                  i % Math.ceil(points.length / 6) !== 0 &&
                  i !== points.length - 1
                ) {
                  return null
                }
                const cx = getX(i)
                const [_, m, d] = p.date.split('-')
                return (
                  <text
                    key={`lbl-${p.date}`}
                    x={cx}
                    y={padding.top + chartH + 20}
                    textAnchor="middle"
                    className="fill-muted text-[10px] font-mono"
                  >
                    {m}/{d}
                  </text>
                )
              })}
            </svg>
          </div>

          {/* Hover Tooltip Box */}
          {hoveredPoint && (
            <div
              className="pointer-events-none absolute top-2 right-2 rounded-xl border border-line bg-panel p-3 shadow-lg text-xs"
              style={{ zIndex: 10 }}
            >
              <p className="font-semibold text-ink">{hoveredPoint.date}</p>
              <div className="mt-1 space-y-0.5">
                <p className="text-muted">
                  Weigh-In:{' '}
                  <span className="font-bold text-ink">
                    {hoveredPoint.displayWeight} {unit}
                  </span>
                </p>
                <p className="text-accent font-medium">
                  7-Day Avg: {hoveredPoint.displayMovingAverage} {unit}
                </p>
                {hoveredPoint.notes && (
                  <p className="mt-1 italic text-muted text-[11px]">
                    "{hoveredPoint.notes}"
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Chart Legend */}
          <div className="mt-3 flex items-center justify-center gap-6 text-xs text-muted">
            <div className="flex items-center gap-2">
              <span className="h-0.5 w-4 rounded bg-accent" />
              <span>7-Day Moving Average</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-0.5 w-4 rounded border-b border-dashed border-muted" />
              <span>Raw Weigh-Ins</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
