import { Dumbbell, Play, Scale } from 'lucide-react'
import type { ProgressPeriod, WeightUnit } from '../types'
import { Button } from '../../../components/common'

interface CapitalioHeaderProps {
  period: ProgressPeriod
  onPeriodChange: (period: ProgressPeriod) => void
  unit: WeightUnit
  onUnitChange: (unit: WeightUnit) => void
  activeWorkoutId: string | null
  workoutStatus: 'idle' | 'loading' | 'saving' | 'failed'
  onStartWorkout: () => Promise<void>
}

const PERIOD_OPTIONS: Array<{ key: ProgressPeriod; label: string }> = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'all', label: 'All' },
]

export default function CapitalioHeader({
  period,
  onPeriodChange,
  unit,
  onUnitChange,
  activeWorkoutId,
  workoutStatus,
  onStartWorkout,
}: CapitalioHeaderProps) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-5 border-b border-line pb-6 md:flex-row md:items-end">
      {/* Title & Subtitle */}
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-flex size-2 rounded-full bg-lime-500 animate-pulse" aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Gym Analytics & Progression
          </p>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl lg:text-4xl">
          Progress Overview
        </h1>
        <p className="mt-1 text-sm text-muted">
          Track your strength, consistency, and personal records.
        </p>
      </div>

      {/* Controls: Date range filter, unit selector, and log-workout action */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        {/* Date Range Filter */}
        <div
          role="radiogroup"
          aria-label="Date range filter"
          className="inline-flex rounded-xl border border-line bg-panel p-1 shadow-xs"
        >
          {PERIOD_OPTIONS.map((opt) => {
            const isSelected = period === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onPeriodChange(opt.key)}
                className={`min-h-8 rounded-lg px-3 text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-ink text-surface shadow-xs dark:bg-lime-500 dark:text-zinc-950'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* Unit Selector (KG / LB) */}
        <div
          role="radiogroup"
          aria-label="Weight unit selector"
          className="inline-flex items-center rounded-xl border border-line bg-panel p-1 shadow-xs"
        >
          <Scale size={14} className="ml-1.5 mr-1 text-muted" aria-hidden="true" />
          {(['kg', 'lb'] as const).map((u) => {
            const isSelected = unit === u
            return (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onUnitChange(u)}
                className={`min-h-8 rounded-lg px-2.5 text-xs font-bold uppercase transition-all ${
                  isSelected
                    ? 'bg-ink text-surface shadow-xs dark:bg-lime-500 dark:text-zinc-950'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {u}
              </button>
            )
          })}
        </div>

        {/* Log / Resume Workout Action */}
        <Button
          size="medium"
          icon={activeWorkoutId ? Play : Dumbbell}
          loading={workoutStatus === 'saving'}
          disabled={workoutStatus === 'loading'}
          onClick={() => void onStartWorkout()}
          className="shrink-0"
        >
          {activeWorkoutId ? 'Resume Workout' : 'Log Workout'}
        </Button>
      </div>
    </div>
  )
}

