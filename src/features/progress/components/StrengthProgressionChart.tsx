import { useState, useId } from 'react'
import { Dumbbell, Info } from 'lucide-react'
import type { StrengthChartPoint, WeightUnit } from '../types'
import { convertWeight, formatWeight } from '../progressCalculations'

interface StrengthProgressionChartProps {
  points: StrengthChartPoint[]
  selectedExerciseId: string
  onSelectExercise: (id: string) => void
  exercises: Array<{ id: string; name: string; category?: string; hasData?: boolean }>
  unit: WeightUnit
  onSwitchToAllTime?: () => void
}

export default function StrengthProgressionChart({
  points,
  selectedExerciseId,
  onSelectExercise,
  exercises,
  unit,
  onSwitchToAllTime,
}: StrengthProgressionChartProps) {
  const [showEstimated1Rm, setShowEstimated1Rm] = useState(true)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const gradientId = useId()

  const selectedExercise = exercises.find((e) => e.id === selectedExerciseId)
  const exerciseName = selectedExercise?.name ?? 'Exercise'

  // Sort chronological
  const sortedPoints = [...points].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  )

  // Calculate stats for current exercise
  const latestPoint = sortedPoints.length ? sortedPoints[sortedPoints.length - 1] : null
  const allTimeBestWeightKg = sortedPoints.length
    ? Math.max(...sortedPoints.map((p) => p.bestWeightKg))
    : 0
  const allTimeBest1RmKg = sortedPoints.length
    ? Math.max(...sortedPoints.map((p) => p.estimated1RmKg))
    : 0

  // Chart Dimensions
  const svgWidth = 800
  const svgHeight = 280
  const padding = { top: 25, right: 35, bottom: 45, left: 55 }
  const chartW = svgWidth - padding.left - padding.right
  const chartH = svgHeight - padding.top - padding.bottom

  // Min / Max values converted to active unit
  const valuesWeight = sortedPoints.map((p) => convertWeight(p.bestWeightKg, unit))
  const values1Rm = sortedPoints.map((p) => convertWeight(p.estimated1RmKg, unit))

  const allValues = showEstimated1Rm
    ? [...valuesWeight, ...values1Rm]
    : valuesWeight

  const rawMin = allValues.length ? Math.min(...allValues) : 0
  const rawMax = allValues.length ? Math.max(...allValues) : 100

  // Give nice headroom on Y axis
  const yMin = Math.max(0, Math.floor(rawMin * 0.85))
  const yMax = Math.ceil(rawMax * 1.1) || 100
  const yRange = yMax - yMin || 1

  // Point mapping to SVG coordinates
  const coords = sortedPoints.map((p, index) => {
    const x =
      sortedPoints.length === 1
        ? padding.left + chartW / 2
        : padding.left + (index / (sortedPoints.length - 1)) * chartW

    const weightVal = convertWeight(p.bestWeightKg, unit)
    const yWeight = padding.top + chartH - ((weightVal - yMin) / yRange) * chartH

    const estVal = convertWeight(p.estimated1RmKg, unit)
    const y1Rm = padding.top + chartH - ((estVal - yMin) / yRange) * chartH

    return { x, yWeight, y1Rm, point: p }
  })

  // Build SVG Paths
  const linePathWeight = coords.length
    ? coords.reduce((acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)},${c.yWeight.toFixed(1)}`, '')
    : ''

  const areaPathWeight = coords.length
    ? `${linePathWeight} L ${coords[coords.length - 1].x.toFixed(1)},${(padding.top + chartH).toFixed(1)} L ${coords[0].x.toFixed(1)},${(padding.top + chartH).toFixed(1)} Z`
    : ''

  const linePath1Rm = coords.length
    ? coords.reduce((acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)},${c.y1Rm.toFixed(1)}`, '')
    : ''

  // Y-axis grid ticks (4 ticks)
  const yTicks = [
    yMin,
    Math.round(yMin + yRange * 0.33),
    Math.round(yMin + yRange * 0.66),
    yMax,
  ]

  const activeCoord = hoveredIndex !== null && coords[hoveredIndex] ? coords[hoveredIndex] : null

  return (
    <div
      style={{ boxShadow: 'var(--shadow-card)' }}
      className="rounded-2xl border border-line bg-panel p-5 sm:p-6"
    >
      {/* Header with Exercise selector & Controls */}
      <div className="flex flex-col justify-between gap-4 border-b border-line pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-ink sm:text-xl">
              Strength Progression
            </h2>
            <span className="hidden sm:inline-flex items-center rounded-md border border-lime-500/30 bg-lime-500/10 px-2 py-0.5 text-xs font-semibold text-lime-700 dark:text-lime-400">
              Interactive
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            Track best working-set loads and estimated 1RM over time.
          </p>
        </div>

        {/* Exercise picker and 1RM toggle */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Exercise Dropdown */}
          <div className="relative min-w-48 max-w-full">
            <label htmlFor="exercise-selector" className="sr-only">
              Select exercise
            </label>
            <select
              id="exercise-selector"
              value={selectedExerciseId}
              onChange={(e) => onSelectExercise(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface py-2 pl-3 pr-8 text-xs font-semibold text-ink shadow-xs focus-visible:outline-2 focus-visible:outline-lime-500"
            >
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} {ex.hasData ? '' : '(No data)'}
                </option>
              ))}
            </select>
          </div>

          {/* Show 1RM Toggle */}
          <button
            type="button"
            onClick={() => setShowEstimated1Rm((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all shadow-xs ${
              showEstimated1Rm
                ? 'border-lime-500/40 bg-lime-500/10 text-lime-700 dark:text-lime-400'
                : 'border-line bg-surface text-muted hover:text-ink'
            }`}
          >
            <span
              className={`size-2 rounded-full ${
                showEstimated1Rm ? 'bg-lime-500' : 'bg-muted'
              }`}
            />
            Est. 1RM
          </button>
        </div>
      </div>

      {/* Stats summary strip */}
      {sortedPoints.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-4 border-b border-line pb-4 text-xs">
          <div>
            <span className="text-muted">Latest Best Set: </span>
            <span className="font-bold text-ink">
              {latestPoint ? formatWeight(latestPoint.bestWeightKg, unit) : '—'}
            </span>
            {latestPoint && (
              <span className="text-muted font-normal"> × {latestPoint.bestWeightReps} reps</span>
            )}
          </div>
          <span className="text-line" aria-hidden="true">|</span>
          <div>
            <span className="text-muted">Est. 1RM: </span>
            <span className="font-bold text-ink">
              {latestPoint ? formatWeight(latestPoint.estimated1RmKg, unit) : '—'}
            </span>
          </div>
          <span className="text-line" aria-hidden="true">|</span>
          <div>
            <span className="text-muted">Period Peak: </span>
            <span className="font-bold text-lime-600 dark:text-lime-400">
              {formatWeight(allTimeBestWeightKg, unit)}
            </span>
          </div>
          {showEstimated1Rm && (
            <>
              <span className="text-line" aria-hidden="true">|</span>
              <div>
                <span className="text-muted">Peak Est. 1RM: </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatWeight(allTimeBest1RmKg, unit)}
                </span>
              </div>
            </>
          )}
          <span className="text-line" aria-hidden="true">|</span>
          <div>
            <span className="text-muted">Sessions in period: </span>
            <span className="font-bold text-ink">{sortedPoints.length}</span>
          </div>
        </div>
      )}

      {/* Main Chart Area or Empty State */}
      {sortedPoints.length === 0 ? (
        <div className="my-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface/50 p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-line bg-panel text-muted">
            <Dumbbell size={24} aria-hidden="true" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-ink">
            No completed sets for {exerciseName} in this period
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted">
            Log a workout with {exerciseName} or adjust your date range to view strength progress.
          </p>
          {onSwitchToAllTime && (
            <button
              type="button"
              onClick={onSwitchToAllTime}
              className="mt-4 rounded-xl border border-lime-500/40 bg-lime-500/10 px-4 py-1.5 text-xs font-semibold text-lime-700 transition hover:bg-lime-500/20 dark:text-lime-400"
            >
              View All-Time History
            </button>
          )}
        </div>
      ) : (
        <div className="relative mt-4">
          {/* SVG Line Chart */}
          <div className="w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto select-none"
              role="img"
              aria-label={`Strength progression chart for ${exerciseName}`}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#84cc16" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#84cc16" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines and Y labels */}
              {yTicks.map((tick) => {
                const y = padding.top + chartH - ((tick - yMin) / yRange) * chartH
                return (
                  <g key={tick}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={svgWidth - padding.right}
                      y2={y}
                      stroke="currentColor"
                      strokeDasharray="4 4"
                      className="text-line/60"
                      strokeWidth={1}
                    />
                    <text
                      x={padding.left - 10}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-muted text-[10px] font-medium"
                    >
                      {tick}
                    </text>
                  </g>
                )
              })}

              {/* Area fill for Best Working Weight */}
              {coords.length > 1 && (
                <path d={areaPathWeight} fill={`url(#${gradientId})`} />
              )}

              {/* Line: Estimated 1RM (Secondary Series) */}
              {showEstimated1Rm && coords.length > 1 && (
                <path
                  d={linePath1Rm}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                  className="opacity-75"
                />
              )}

              {/* Line: Best Working-Set Weight (Primary Series) */}
              {coords.length > 1 && (
                <path
                  d={linePathWeight}
                  fill="none"
                  stroke="#84cc16"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Crosshair on Hover */}
              {activeCoord && (
                <line
                  x1={activeCoord.x}
                  y1={padding.top}
                  x2={activeCoord.x}
                  y2={padding.top + chartH}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  className="text-ink/40"
                />
              )}

              {/* Data points for Best Weight */}
              {coords.map((c, i) => {
                const isHovered = hoveredIndex === i
                return (
                  <g
                    key={c.point.workoutId}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(i)}
                  >
                    {/* Transparent touch/click hit area */}
                    <circle cx={c.x} cy={c.yWeight} r={16} fill="transparent" />

                    {/* Secondary 1RM point */}
                    {showEstimated1Rm && (
                      <circle
                        cx={c.x}
                        cy={c.y1Rm}
                        r={isHovered ? 4.5 : 3}
                        fill="#10b981"
                        className="transition-all"
                      />
                    )}

                    {/* Primary Best Weight point */}
                    <circle
                      cx={c.x}
                      cy={c.yWeight}
                      r={isHovered ? 6 : 4}
                      fill="#84cc16"
                      stroke="var(--theme-surface)"
                      strokeWidth={2}
                      className="transition-all"
                    />

                    {/* Subtle pulse ring on hovered point */}
                    {isHovered && (
                      <circle
                        cx={c.x}
                        cy={c.yWeight}
                        r={11}
                        fill="none"
                        stroke="#84cc16"
                        strokeWidth={1.5}
                        className="animate-ping opacity-60"
                      />
                    )}

                    {/* Date label on X axis */}
                    {(i === 0 ||
                      i === coords.length - 1 ||
                      (coords.length <= 6 && i % 2 === 1)) && (
                      <text
                        x={c.x}
                        y={svgHeight - 15}
                        textAnchor="middle"
                        className="fill-muted text-[10px] font-medium"
                      >
                        {c.point.localDate.slice(5)}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Floating Tooltip Card */}
          {activeCoord && (
            <div
              style={{
                left: `${(activeCoord.x / svgWidth) * 100}%`,
                top: `${(activeCoord.yWeight / svgHeight) * 100}%`,
                transform: `translate(${activeCoord.x > svgWidth / 2 ? '-105%' : '5%'}, -110%)`,
              }}
              className="pointer-events-none absolute z-20 min-w-44 rounded-xl border border-line bg-panel/95 p-3 shadow-lg backdrop-blur-md transition-all text-xs"
            >
              <div className="flex items-center justify-between gap-2 border-b border-line pb-1.5 mb-1.5">
                <span className="font-bold text-ink truncate max-w-32">
                  {activeCoord.point.workoutName}
                </span>
                <span className="text-[10px] text-muted whitespace-nowrap">
                  {activeCoord.point.localDate}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-muted">
                    <span className="size-2 rounded-full bg-lime-500" />
                    Best Set:
                  </span>
                  <span className="font-bold text-ink tabular-nums">
                    {formatWeight(activeCoord.point.bestWeightKg, unit)} × {activeCoord.point.bestWeightReps}
                  </span>
                </div>
                {showEstimated1Rm && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-muted">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      Est. 1RM:
                    </span>
                    <span className="font-bold text-ink tabular-nums">
                      {formatWeight(activeCoord.point.estimated1RmKg, unit)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-lime-500" />
                <span className="font-medium text-ink">Best Working-Set Weight</span>
              </div>
              {showEstimated1Rm && (
                <div className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3.5 rounded-full bg-emerald-500" />
                  <span className="font-medium text-ink">Estimated 1RM (Epley)</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <Info size={12} className="text-muted" />
              <span>Hover or tap data points for workout details</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
