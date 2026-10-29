import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, Calendar, Clock, History } from 'lucide-react'
import type {
  ExerciseSummary,
  WeeklyVolumePoint,
  WeightUnit,
  WorkoutHistoryItem,
} from '../types'
import { formatVolume, formatWeight } from '../progressCalculations'

interface VolumeConsistencySectionProps {
  weeklyVolume: WeeklyVolumePoint[]
  recentWorkouts: WorkoutHistoryItem[]
  exerciseSummaries: ExerciseSummary[]
  unit: WeightUnit
  onSelectExercise: (exerciseId: string) => void
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}

export default function VolumeConsistencySection({
  weeklyVolume,
  recentWorkouts,
  exerciseSummaries,
  unit,
  onSelectExercise,
}: VolumeConsistencySectionProps) {
  const [hoveredWeekIndex, setHoveredWeekIndex] = useState<number | null>(null)

  // Max volume for scaling bars
  const maxWeeklyVol = Math.max(1, ...weeklyVolume.map((w) => w.volumeKg))
  const totalPeriodVol = weeklyVolume.reduce((acc, w) => acc + w.volumeKg, 0)
  const averageWeeklyVol = weeklyVolume.length
    ? Math.round(totalPeriodVol / weeklyVolume.length)
    : 0

  return (
    <div className="space-y-6">
      {/* 2-Column Grid: Weekly Volume Bar Chart & Recent Training Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column: Weekly Training Volume Bar Chart */}
        <div
          style={{ boxShadow: 'var(--shadow-card)' }}
          className="flex flex-col justify-between rounded-2xl border border-line bg-panel p-5 sm:p-6"
        >
          <div>
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 size={18} className="text-lime-600 dark:text-lime-400" aria-hidden="true" />
                  <h3 className="text-base font-bold tracking-tight text-ink sm:text-lg">
                    Weekly Training Volume
                  </h3>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  Total load lifted (weight × reps) across 8 calendar weeks.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted block">Weekly Avg</span>
                <span className="text-sm font-bold text-ink tabular-nums">
                  {formatVolume(averageWeeklyVol, unit)}
                </span>
              </div>
            </div>

            {/* Interactive Weekly Bar Chart */}
            <div className="mt-6">
              <div className="grid grid-cols-8 items-end gap-2 h-44 pb-2 border-b border-line/60">
                {weeklyVolume.map((w, idx) => {
                  const pct = Math.max(4, (w.volumeKg / maxWeeklyVol) * 100)
                  const isHovered = hoveredWeekIndex === idx
                  const hasVolume = w.volumeKg > 0

                  return (
                    <div
                      key={w.weekKey}
                      className="group relative flex h-full flex-col justify-end items-center"
                      onMouseEnter={() => setHoveredWeekIndex(idx)}
                      onMouseLeave={() => setHoveredWeekIndex(null)}
                    >
                      {/* Bar */}
                      <div
                        style={{ height: `${pct}%` }}
                        className={`w-full max-w-8 rounded-t-lg transition-all duration-200 ${
                          hasVolume
                            ? isHovered
                              ? 'bg-lime-400 shadow-sm'
                              : 'bg-lime-500/80 dark:bg-lime-500/90'
                            : 'bg-line/40'
                        }`}
                      />

                      {/* Tooltip on Hover */}
                      {isHovered && (
                        <div className="pointer-events-none absolute -top-16 z-30 min-w-32 -translate-x-1/2 left-1/2 rounded-xl border border-line bg-panel/95 p-2 shadow-lg backdrop-blur-md text-center text-xs">
                          <p className="font-bold text-ink">{w.label}</p>
                          <p className="font-extrabold text-lime-600 dark:text-lime-400 tabular-nums">
                            {formatVolume(w.volumeKg, unit)}
                          </p>
                          <p className="text-[10px] text-muted">
                            {w.workoutCount} workout{w.workoutCount === 1 ? '' : 's'}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* X-axis week labels */}
              <div className="grid grid-cols-8 gap-2 pt-2 text-center text-[10px] font-medium text-muted">
                {weeklyVolume.map((w) => (
                  <span key={w.weekKey} className="truncate">
                    {w.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-line text-xs text-muted">
            <span className="font-medium text-ink">Calculation note: </span>
            Volume measures total tonnage moved (completed reps × external load). It is distinctly separated from maximum working weight.
          </div>
        </div>

        {/* Right Column: Recent Training Activity List */}
        <div
          style={{ boxShadow: 'var(--shadow-card)' }}
          className="flex flex-col justify-between rounded-2xl border border-line bg-panel p-5 sm:p-6"
        >
          <div>
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <History size={18} className="text-lime-600 dark:text-lime-400" aria-hidden="true" />
                  <h3 className="text-base font-bold tracking-tight text-ink sm:text-lg">
                    Recent Training Activity
                  </h3>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  Latest completed sessions with volume and exercises.
                </p>
              </div>
              <Link
                to="/workouts"
                className="text-xs font-semibold text-lime-700 hover:underline dark:text-lime-400 flex items-center gap-1"
              >
                All History <ArrowRight size={13} />
              </Link>
            </div>

            {/* Workouts list */}
            {recentWorkouts.length === 0 ? (
              <p className="py-12 text-center text-xs text-muted">
                No recent workouts completed.
              </p>
            ) : (
              <ul className="divide-y divide-line mt-2">
                {recentWorkouts.slice(0, 5).map((w) => (
                  <li key={w.id} className="py-3 group">
                    <Link
                      to={`/workouts/${w.id}`}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink truncate group-hover:text-lime-600 dark:group-hover:text-lime-400">
                            {w.name}
                          </span>
                          <span className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted border border-line">
                            {formatVolume(w.totalVolumeKg, unit)}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                          <span className="flex items-center gap-1">
                            <Calendar size={11} />
                            {w.completedAt.slice(0, 10)}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {formatDuration(w.durationSeconds)}
                          </span>
                          <span>•</span>
                          <span>
                            {w.exerciseCount} exercises, {w.completedSetCount} sets
                          </span>
                        </div>
                      </div>
                      <ArrowRight
                        size={15}
                        className="text-muted transition-transform group-hover:translate-x-1 group-hover:text-lime-600 dark:group-hover:text-lime-400 shrink-0"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Exercise-by-Exercise Progress Summaries */}
      <div
        style={{ boxShadow: 'var(--shadow-card)' }}
        className="rounded-2xl border border-line bg-panel p-5 sm:p-6"
      >
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <h3 className="text-base font-bold tracking-tight text-ink sm:text-lg">
              Exercise Performance Summaries
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              Aggregate volume, completed sets, and top weight per exercise.
            </p>
          </div>
          <span className="text-xs text-muted">
            {exerciseSummaries.length} tracked exercises
          </span>
        </div>

        {exerciseSummaries.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted">
            No completed exercises recorded yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="pb-3 font-semibold uppercase tracking-wider">Exercise</th>
                  <th className="pb-3 font-semibold uppercase tracking-wider">Category</th>
                  <th className="pb-3 font-semibold uppercase tracking-wider">Total Volume</th>
                  <th className="pb-3 font-semibold uppercase tracking-wider">Completed Sets</th>
                  <th className="pb-3 font-semibold uppercase tracking-wider">Best Weight</th>
                  <th className="pb-3 font-semibold uppercase tracking-wider">Est. 1RM</th>
                  <th className="pb-3 text-right font-semibold uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {exerciseSummaries.slice(0, 8).map((ex) => (
                  <tr key={ex.exerciseId} className="group hover:bg-hover/50">
                    <td className="py-3 font-semibold text-ink">
                      {ex.exerciseName}
                    </td>
                    <td className="py-3 text-muted capitalize">
                      {ex.category}
                    </td>
                    <td className="py-3 tabular-nums font-bold text-ink">
                      {formatVolume(ex.totalVolumeKg, unit)}
                    </td>
                    <td className="py-3 tabular-nums text-ink">
                      {ex.totalSets} sets ({ex.workoutCount} workouts)
                    </td>
                    <td className="py-3 tabular-nums font-bold text-lime-600 dark:text-lime-400">
                      {formatWeight(ex.bestWeightKg, unit)}{' '}
                      <span className="text-muted font-normal text-[11px]">
                        × {ex.bestReps}
                      </span>
                    </td>
                    <td className="py-3 tabular-nums font-semibold text-ink">
                      {formatWeight(ex.estimated1RmKg, unit)}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectExercise(ex.exerciseId)}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-lime-700 transition hover:bg-lime-500/10 dark:text-lime-400"
                      >
                        Progression Chart
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
