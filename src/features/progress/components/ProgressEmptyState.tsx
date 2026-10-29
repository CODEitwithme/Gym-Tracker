import { Link } from 'react-router-dom'
import { Dumbbell, Plus, Sparkles, TrendingUp } from 'lucide-react'
import { Button } from '../../../components/common'

interface ProgressEmptyStateProps {
  onStartWorkout: () => Promise<void>
  activeWorkoutId: string | null
  workoutStatus: 'idle' | 'loading' | 'saving' | 'failed'
}

export default function ProgressEmptyState({
  onStartWorkout,
  activeWorkoutId,
  workoutStatus,
}: ProgressEmptyStateProps) {
  return (
    <div
      style={{ boxShadow: 'var(--shadow-card)' }}
      className="relative overflow-hidden rounded-2xl border border-line bg-panel p-8 sm:p-12 text-center"
    >
      {/* Decorative gradient glow */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 size-96 -translate-x-1/2 rounded-full bg-lime-500/10 blur-3xl dark:bg-lime-500/5"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-md">
        {/* Icon */}
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-line bg-surface text-lime-600 dark:text-lime-400 shadow-xs">
          <TrendingUp size={28} aria-hidden="true" />
        </div>

        {/* Heading & Subheading */}
        <h2 className="mt-4 text-xl font-bold tracking-tight text-ink sm:text-2xl">
          No Workout History Recorded Yet
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Your strength progression, personal records, and volume analytics are derived entirely from your real completed workouts. Start logging sets to build your progress dashboard!
        </p>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="large"
            icon={activeWorkoutId ? Dumbbell : Plus}
            loading={workoutStatus === 'saving'}
            disabled={workoutStatus === 'loading'}
            onClick={() => void onStartWorkout()}
          >
            {activeWorkoutId ? 'Resume Active Workout' : 'Start First Workout'}
          </Button>

          <Link to="/workouts">
            <Button variant="outline" size="large" icon={Dumbbell}>
              Browse Workouts
            </Button>
          </Link>
        </div>

        {/* Note on Demo Data */}
        <div className="mt-8 rounded-xl border border-line/70 bg-surface/60 p-3.5 text-xs text-muted flex items-center justify-center gap-2">
          <Sparkles size={14} className="text-lime-600 dark:text-lime-400 shrink-0" aria-hidden="true" />
          <span>
            Want to test with sample analytics? You can load sample gym records in{' '}
            <Link to="/settings/data" className="font-semibold text-lime-700 underline dark:text-lime-400">
              Settings → Data Management
            </Link>
            .
          </span>
        </div>
      </div>
    </div>
  )
}

