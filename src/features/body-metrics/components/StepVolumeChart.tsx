import { useState } from 'react'
import { CheckCircle2, Footprints, Plus } from 'lucide-react'
import { Button, Card } from '../../../components/common'
import type { BodyMetricsPeriod, StepProgressData } from '../bodyMetricsService'

interface StepVolumeChartProps {
  data: StepProgressData
  period: BodyMetricsPeriod
  onPeriodChange: (period: BodyMetricsPeriod) => void
  onOpenLogSteps: () => void
}

export function StepVolumeChart({
  data,
  period,
  onPeriodChange,
  onOpenLogSteps,
}: StepVolumeChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const { points, totalSteps, averageDailySteps, daysGoalMet, totalDays, targetSteps } = data

  // Dimensions
  const svgWidth = 800
  const svgHeight = 240
  const padding = { top: 25, right: 35, bottom: 40, left: 55 }
  const chartW = svgWidth - padding.left - padding.right
  const chartH = svgHeight - padding.top - padding.bottom

  const maxStepsRecorded = Math.max(
    targetSteps,
    ...points.map((p) => p.stepCount),
  )
  const maxAxisVal = Math.ceil((maxStepsRecorded * 1.15) / 1000) * 1000

  const getY = (val: number) => {
    return padding.top + chartH - (val / maxAxisVal) * chartH
  }

  const targetY = getY(targetSteps)

  const barWidth = Math.max(4, Math.min(24, (chartW / points.length) * 0.7))
  const slotWidth = chartW / points.length

  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null

  return (
    <Card className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-line pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Footprints size={18} />
            </span>
            <h2 className="text-lg font-bold text-ink">Daily Step Volume</h2>
          </div>
          <p className="mt-1 text-xs text-muted">
            Track daily movement consistency and goal adherence over time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period Selector */}
          <div className="flex rounded-lg border border-line bg-surface p-1">
            {(['7d', '30d', '90d'] as BodyMetricsPeriod[]).map((p) => (
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
            onClick={onOpenLogSteps}
          >
            Log Steps
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-line bg-surface p-3.5">
          <p className="text-xs text-muted">Daily Average</p>
          <p className="mt-1 text-xl font-bold text-ink sm:text-2xl">
            {averageDailySteps.toLocaleString()}{' '}
            <span className="text-xs font-normal text-muted">steps</span>
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3.5">
          <p className="text-xs text-muted">Total Movement</p>
          <p className="mt-1 text-xl font-bold text-ink sm:text-2xl">
            {totalSteps.toLocaleString()}{' '}
            <span className="text-xs font-normal text-muted">steps</span>
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3.5">
          <p className="text-xs text-muted">Goal Met Days</p>
          <p className="mt-1 text-xl font-bold text-ink sm:text-2xl">
            {daysGoalMet}{' '}
            <span className="text-xs font-normal text-muted">/ {totalDays}d</span>
          </p>
          <p className="mt-0.5 text-[11px] text-accent font-medium">
            {totalDays > 0 ? Math.round((daysGoalMet / totalDays) * 100) : 0}% success rate
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3.5">
          <p className="text-xs text-muted">Current Target</p>
          <p className="mt-1 text-xl font-bold text-ink sm:text-2xl">
            {targetSteps.toLocaleString()}{' '}
            <span className="text-xs font-normal text-muted">steps/d</span>
          </p>
        </div>
      </div>

      {/* Main Bar Chart */}
      <div className="relative">
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full min-w-[500px] select-none overflow-visible"
            aria-label="Daily step volume chart"
          >
            {/* Horizontal Grid lines */}
            {[0, 0.33, 0.66, 1].map((ratio) => {
              const y = padding.top + chartH * (1 - ratio)
              const val = Math.round(maxAxisVal * ratio)
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
                    className="fill-muted text-[10px] font-mono"
                  >
                    {val.toLocaleString()}
                  </text>
                </g>
              )
            })}

            {/* Target Line */}
            <g>
              <line
                x1={padding.left}
                y1={targetY}
                x2={padding.left + chartW}
                y2={targetY}
                stroke="var(--color-accent)"
                strokeDasharray="5 3"
                strokeWidth="1.5"
                strokeOpacity="0.8"
              />
              <text
                x={padding.left + chartW}
                y={targetY - 5}
                textAnchor="end"
                className="fill-accent text-[10px] font-semibold"
              >
                Target: {targetSteps.toLocaleString()}
              </text>
            </g>

            {/* Step Bars */}
            {points.map((p, i) => {
              const x = padding.left + i * slotWidth + (slotWidth - barWidth) / 2
              const barH = p.stepCount > 0 ? (p.stepCount / maxAxisVal) * chartH : 2
              const y = padding.top + chartH - barH
              const isHovered = hoveredIndex === i

              return (
                <g
                  key={p.date}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barH}
                    rx={2}
                    className={
                      p.stepCount === 0
                        ? 'fill-muted/20'
                        : p.isGoalReached
                          ? isHovered
                            ? 'fill-accent'
                            : 'fill-accent/80'
                          : isHovered
                            ? 'fill-ink'
                            : 'fill-ink/40'
                    }
                  />
                </g>
              )
            })}

            {/* X-axis date labels */}
            {points.map((p, i) => {
              if (
                points.length > 10 &&
                i % Math.ceil(points.length / 7) !== 0 &&
                i !== points.length - 1
              ) {
                return null
              }
              const x = padding.left + i * slotWidth + slotWidth / 2
              return (
                <text
                  key={`date-${p.date}`}
                  x={x}
                  y={padding.top + chartH + 20}
                  textAnchor="middle"
                  className="fill-muted text-[10px] font-mono"
                >
                  {p.label}
                </text>
              )
            })}
          </svg>
        </div>

        {/* Hover Tooltip */}
        {hoveredPoint && (
          <div
            className="pointer-events-none absolute top-2 right-2 rounded-xl border border-line bg-panel p-3 shadow-lg text-xs"
            style={{ zIndex: 10 }}
          >
            <p className="font-semibold text-ink">{hoveredPoint.date}</p>
            <div className="mt-1 space-y-0.5">
              <p className="text-muted">
                Steps:{' '}
                <span className="font-bold text-ink">
                  {hoveredPoint.stepCount.toLocaleString()}
                </span>
              </p>
              {hoveredPoint.isGoalReached ? (
                <p className="flex items-center gap-1 font-medium text-success">
                  <CheckCircle2 size={12} />
                  <span>Goal Achieved!</span>
                </p>
              ) : (
                <p className="text-muted text-[11px]">
                  {Math.max(0, hoveredPoint.targetSteps - hoveredPoint.stepCount).toLocaleString()}{' '}
                  steps to target
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
