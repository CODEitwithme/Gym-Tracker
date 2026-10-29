import { Award, CheckCircle2, Flame, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ProgressOverviewMetrics, ProgressPeriod, WeightUnit } from '../types'
import { formatVolume } from '../progressCalculations'

interface MetricCardsGridProps {
  metrics: ProgressOverviewMetrics
  period: ProgressPeriod
  unit: WeightUnit
}

interface MetricCardItemProps {
  title: string
  value: string
  unitLabel?: string
  comparisonText: string
  comparisonType: 'positive' | 'negative' | 'neutral'
  icon: LucideIcon
  subtext: string
}

function MetricCardItem({
  title,
  value,
  unitLabel,
  comparisonText,
  comparisonType,
  icon: Icon,
  subtext,
}: MetricCardItemProps) {
  return (
    <div
      style={{ boxShadow: 'var(--shadow-card)' }}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-panel p-5 transition-all duration-200 hover:border-lime-500/40"
    >
      {/* Top row: Label and Icon */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          {title}
        </p>
        <div className="flex size-9 items-center justify-center rounded-xl border border-line/70 bg-surface text-ink transition-colors group-hover:border-lime-500/30 group-hover:text-lime-600 dark:group-hover:text-lime-400">
          <Icon size={17} aria-hidden="true" />
        </div>
      </div>

      {/* Main Metric Value */}
      <div className="my-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight tabular-nums text-ink sm:text-4xl">
          {value}
        </span>
        {unitLabel && (
          <span className="text-sm font-semibold text-muted">{unitLabel}</span>
        )}
      </div>

      {/* Bottom comparison and subtext */}
      <div className="space-y-1 pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
              comparisonType === 'positive'
                ? 'border border-lime-500/30 bg-lime-500/10 text-lime-700 dark:text-lime-400'
                : comparisonType === 'negative'
                  ? 'border border-danger/25 bg-danger-soft text-danger'
                  : 'border border-line bg-surface text-muted'
            }`}
          >
            {comparisonText}
          </span>
        </div>
        <p className="text-xs text-muted">{subtext}</p>
      </div>
    </div>
  )
}

export default function MetricCardsGrid({
  metrics,
  period,
  unit,
}: MetricCardsGridProps) {
  // 1. Workouts completed comparison
  const workoutDelta = metrics.workoutsCount - metrics.previousWorkoutsCount
  const workoutComparison =
    period === 'all'
      ? { text: 'All-time total', type: 'neutral' as const }
      : !metrics.hasPreviousData
        ? { text: 'No prior baseline', type: 'neutral' as const }
        : workoutDelta > 0
          ? { text: `+${workoutDelta} vs prior period`, type: 'positive' as const }
          : workoutDelta < 0
            ? { text: `${workoutDelta} vs prior period`, type: 'negative' as const }
            : { text: 'Equal to prior period', type: 'neutral' as const }

  // 2. Total Volume comparison
  const volumeDelta = metrics.totalVolumeKg - metrics.previousTotalVolumeKg
  let volumeComparisonText = 'No prior baseline'
  let volumeComparisonType: 'positive' | 'negative' | 'neutral' = 'neutral'

  if (period === 'all') {
    volumeComparisonText = 'All-time volume'
    volumeComparisonType = 'neutral'
  } else if (metrics.hasPreviousData && metrics.previousTotalVolumeKg > 0) {
    const pct = Math.round((volumeDelta / metrics.previousTotalVolumeKg) * 1000) / 10
    if (pct > 0) {
      volumeComparisonText = `+${pct}% vs prior period`
      volumeComparisonType = 'positive'
    } else if (pct < 0) {
      volumeComparisonText = `${pct}% vs prior period`
      volumeComparisonType = 'negative'
    } else {
      volumeComparisonText = 'Equal to prior period'
      volumeComparisonType = 'neutral'
    }
  }

  // 3. Personal Records comparison
  let prsComparisonText = 'No records in period'
  let prsComparisonType: 'positive' | 'negative' | 'neutral' = 'neutral'

  if (metrics.prsCount > 0) {
    prsComparisonText = `${metrics.prsCount} new PR${metrics.prsCount === 1 ? '' : 's'} achieved`
    prsComparisonType = 'positive'
  } else if (period === 'all') {
    prsComparisonText = 'All-time records'
    prsComparisonType = 'neutral'
  }

  // 4. Training Consistency comparison
  const consistencyDelta =
    metrics.workoutsPerWeek - metrics.previousWorkoutsPerWeek
  const consistencyComparison =
    period === 'all'
      ? { text: `${metrics.activeTrainingDays} training days`, type: 'neutral' as const }
      : !metrics.hasPreviousData
        ? { text: `${metrics.activeTrainingDays} training days`, type: 'neutral' as const }
        : consistencyDelta > 0.1
          ? {
              text: `+${consistencyDelta.toFixed(1)}/wk vs prior`,
              type: 'positive' as const,
            }
          : consistencyDelta < -0.1
            ? {
                text: `${consistencyDelta.toFixed(1)}/wk vs prior`,
                type: 'negative' as const,
              }
            : {
                text: `${metrics.activeTrainingDays} training days`,
                type: 'neutral' as const,
              }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Workouts Completed */}
      <MetricCardItem
        title="Workouts Completed"
        value={String(metrics.workoutsCount)}
        comparisonText={workoutComparison.text}
        comparisonType={workoutComparison.type}
        icon={CheckCircle2}
        subtext="Completed workout sessions"
      />

      {/* 2. Total Volume */}
      <MetricCardItem
        title="Total Volume"
        value={formatVolume(metrics.totalVolumeKg, unit)}
        comparisonText={volumeComparisonText}
        comparisonType={volumeComparisonType}
        icon={Flame}
        subtext="Sum of (weight × reps) completed"
      />

      {/* 3. Personal Records */}
      <MetricCardItem
        title="Personal Records"
        value={String(metrics.prsCount)}
        comparisonText={prsComparisonText}
        comparisonType={prsComparisonType}
        icon={Award}
        subtext="Verified strength milestones"
      />

      {/* 4. Training Consistency */}
      <MetricCardItem
        title="Training Consistency"
        value={metrics.workoutsPerWeek.toFixed(1)}
        unitLabel="/ week"
        comparisonText={consistencyComparison.text}
        comparisonType={consistencyComparison.type}
        icon={TrendingUp}
        subtext={`${metrics.activeTrainingDays} active training days`}
      />
    </div>
  )
}

