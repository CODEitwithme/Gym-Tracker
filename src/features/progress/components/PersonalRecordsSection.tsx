import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  Award,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Trophy,
} from 'lucide-react'
import type { PersonalRecord, PrType, WeightUnit } from '../types'
import { formatWeight } from '../progressCalculations'

interface PersonalRecordsSectionProps {
  personalRecords: PersonalRecord[]
  unit: WeightUnit
  onSelectExercise: (exerciseId: string) => void
}

type PrFilter = 'all' | PrType | 'new_period'

export default function PersonalRecordsSection({
  personalRecords,
  unit,
  onSelectExercise,
}: PersonalRecordsSectionProps) {
  const [filter, setFilter] = useState<PrFilter>('all')

  const filteredRecords = personalRecords.filter((pr) => {
    if (filter === 'all') return true
    if (filter === 'new_period') return pr.isNewInPeriod
    return pr.type === filter
  })

  const newInPeriodCount = personalRecords.filter((p) => p.isNewInPeriod).length

  return (
    <div
      style={{ boxShadow: 'var(--shadow-card)' }}
      className="rounded-2xl border border-line bg-panel p-5 sm:p-6"
    >
      {/* Header and Filter Buttons */}
      <div className="flex flex-col justify-between gap-4 border-b border-line pb-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-ink sm:text-xl">
              Personal Records
            </h2>
            {newInPeriodCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-lime-500/30 bg-lime-500/10 px-2.5 py-0.5 text-xs font-bold text-lime-700 dark:text-lime-400">
                <Sparkles size={11} className="animate-spin text-lime-500" />
                {newInPeriodCount} New in Period
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            Verified milestones across completed workouts, distinguished by record type.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: 'all', label: 'All Records' },
            { key: 'new_period', label: `New (${newInPeriodCount})` },
            { key: 'heaviest', label: 'Heaviest' },
            { key: 'one_rep_max', label: 'Est. 1RM' },
            { key: 'rep_record', label: 'Rep PRs' },
          ].map((item) => {
            const isSelected = filter === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key as PrFilter)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  isSelected
                    ? 'border border-lime-500/30 bg-lime-500/10 text-lime-700 shadow-xs dark:text-lime-400'
                    : 'text-muted hover:bg-hover hover:text-ink'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* PR Table with Top 5 Viewport and Scroller */}
      {filteredRecords.length === 0 ? (
        <div className="my-6 rounded-xl border border-dashed border-line bg-surface/40 p-6 text-center">
          <Trophy size={22} className="mx-auto text-muted" aria-hidden="true" />
          <p className="mt-2 text-xs font-semibold text-ink">
            No personal records matching this filter
          </p>
          <p className="text-xs text-muted">
            Complete workouts with progressive weights or reps to unlock new records.
          </p>
        </div>
      ) : (
        <div className="mt-4">
          {/* Scrollable Container Sized for Top 5 Rows with Dedicated Scrollbar */}
          <div
            tabIndex={0}
            role="region"
            aria-label="Personal Records table, scrollable"
            className="max-h-[320px] overflow-y-auto overflow-x-auto rounded-xl border border-line bg-surface/20 focus:outline-none focus:ring-1 focus:ring-lime-500/50"
            style={{ scrollbarWidth: 'thin' }}
          >
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-line bg-panel shadow-xs">
                <tr className="text-muted">
                  <th className="py-3 px-3 font-semibold uppercase tracking-wider">Exercise</th>
                  <th className="py-3 px-3 font-semibold uppercase tracking-wider">Record Type</th>
                  <th className="py-3 px-3 font-semibold uppercase tracking-wider">Best Weight</th>
                  <th className="py-3 px-3 font-semibold uppercase tracking-wider">Est. 1RM</th>
                  <th className="py-3 px-3 font-semibold uppercase tracking-wider">Improvement</th>
                  <th className="py-3 px-3 font-semibold uppercase tracking-wider">Date</th>
                  <th className="py-3 px-3 text-right font-semibold uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredRecords.map((pr, idx) => {
                  const badgeColor =
                    pr.type === 'heaviest'
                      ? 'border-lime-500/30 bg-lime-500/10 text-lime-700 dark:text-lime-400'
                      : pr.type === 'one_rep_max'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400'

                  const typeLabel =
                    pr.type === 'heaviest'
                      ? 'Heaviest Load'
                      : pr.type === 'one_rep_max'
                        ? 'Est. 1RM'
                        : 'Rep Best'

                  return (
                    <tr
                      key={pr.id}
                      className="group transition-colors hover:bg-hover/50"
                    >
                      {/* Exercise Name & Rank */}
                      <td className="py-3 px-3 font-semibold text-ink">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-[10px] font-bold text-muted">
                            {idx + 1}
                          </span>
                          <span>{pr.exerciseName}</span>
                          {pr.isNewInPeriod && (
                            <span className="rounded-full border border-lime-500/40 bg-lime-500/20 px-1.5 py-0.2 text-[10px] font-bold text-lime-700 dark:text-lime-300">
                              NEW
                            </span>
                          )}
                        </div>
                        <span className="block max-w-44 truncate pl-7 text-[11px] font-normal text-muted">
                          in {pr.workoutName}
                        </span>
                      </td>

                      {/* PR Type Badge */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badgeColor}`}
                        >
                          <Award size={11} aria-hidden="true" />
                          {typeLabel}
                        </span>
                      </td>

                      {/* Weight & Reps */}
                      <td className="py-3 px-3 font-bold tabular-nums text-ink">
                        {formatWeight(pr.weightKg, unit)}{' '}
                        <span className="font-normal text-muted">× {pr.reps} reps</span>
                      </td>

                      {/* Estimated 1RM */}
                      <td className="py-3 px-3 font-semibold tabular-nums text-ink">
                        {formatWeight(pr.estimated1RmKg, unit)}
                      </td>

                      {/* Improvement */}
                      <td className="py-3 px-3">
                        {pr.improvementKg !== null && pr.improvementKg > 0 ? (
                          <div className="flex items-center gap-1 font-semibold text-lime-600 dark:text-lime-400">
                            <ArrowUpRight size={13} aria-hidden="true" />
                            <span>+{formatWeight(pr.improvementKg, unit)}</span>
                            {pr.improvementPercent !== null && (
                              <span className="font-normal text-[11px] text-muted">
                                (+{pr.improvementPercent}%)
                              </span>
                            )}
                          </div>
                        ) : pr.type === 'rep_record' && pr.previousReps !== null ? (
                          <div className="flex items-center gap-1 font-semibold text-sky-600 dark:text-sky-400">
                            <ArrowUpRight size={13} aria-hidden="true" />
                            <span>+{pr.reps - pr.previousReps} reps</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted">First milestone</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="whitespace-nowrap py-3 px-3 text-muted">
                        {pr.localDate}
                      </td>

                      {/* Action */}
                      <td className="whitespace-nowrap py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectExercise(pr.exerciseId)}
                            className="rounded-lg px-2 py-1 text-xs font-semibold text-lime-700 transition hover:bg-lime-500/10 dark:text-lime-400"
                          >
                            View Chart
                          </button>
                          <Link
                            to={`/workouts/${pr.workoutId}`}
                            className="rounded-lg p-1 text-muted transition hover:text-ink"
                            title="View workout"
                          >
                            <ChevronRight size={15} aria-hidden="true" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Contextual scroll hint when more than 5 records exist */}
          {filteredRecords.length > 5 && (
            <div className="mt-2.5 flex items-center justify-between px-1 text-[11px] text-muted">
              <span>
                Showing top 5 of {filteredRecords.length} records
              </span>
              <span className="flex items-center gap-1 font-medium text-muted">
                <ChevronDown size={12} className="animate-bounce" aria-hidden="true" />
                Scroll to view next {filteredRecords.length - 5} {filteredRecords.length - 5 === 1 ? 'record' : 'records'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
