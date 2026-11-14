import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Sliders,
  X,
} from 'lucide-react'
import { Badge, Button, Card } from '../../../components/common'
import {
  loadMonthlyAdherenceSummary,
  type MonthlyAdherenceSummary,
} from '../monthlyTargetsService'
import {
  loadManualBodyFatChangePercent,
  saveManualBodyFatChangePercent,
} from '../manualBodyFatChangeService'
import { formatLocalDate } from '../../../lib/dateTime'

interface MonthlyCalorieTrackerProps {
  onOpenCalculator: () => void
  fallbackTargetCalories: number
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function MonthlyCalorieTracker({
  onOpenCalculator,
  fallbackTargetCalories,
}: MonthlyCalorieTrackerProps) {
  const [selectedMonthKey, setSelectedMonthKey] = useState(() =>
    formatLocalDate(new Date()).slice(0, 7),
  )
  const todayDate = useMemo(() => formatLocalDate(new Date()), [])
  const [summary, setSummary] = useState<MonthlyAdherenceSummary | null>(null)
  const [manualBodyFat, setManualBodyFat] = useState(() => {
    try {
      return { value: loadManualBodyFatChangePercent(), error: null as string | null }
    } catch {
      return { value: null, error: 'Could not load the saved body fat change.' }
    }
  })
  const [bodyFatDraft, setBodyFatDraft] = useState('')
  const [isEditingBodyFat, setIsEditingBodyFat] = useState(false)
  const manualBodyFatChangePercent = manualBodyFat.value
  const bodyFatError = manualBodyFat.error

  const loadData = useCallback(async (monthKey: string) => {
    try {
      const data = await loadMonthlyAdherenceSummary(monthKey, fallbackTargetCalories)
      setSummary(data)
    } catch {
      // Done
    }
  }, [fallbackTargetCalories])

  useEffect(() => {
    void loadData(selectedMonthKey)
  }, [selectedMonthKey, loadData])

  const handlePrevMonth = () => {
    const [y, m] = selectedMonthKey.split('-').map(Number)
    const prev = new Date(y, m - 2, 1)
    const nextKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonthKey(nextKey)
  }

  const handleNextMonth = () => {
    const [y, m] = selectedMonthKey.split('-').map(Number)
    const next = new Date(y, m, 1)
    const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonthKey(nextKey)
  }

  const handleSaveBodyFatChange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = bodyFatDraft.trim() === '' ? Number.NaN : Number(bodyFatDraft)
    if (!Number.isFinite(value)) {
      setManualBodyFat((current) => ({
        ...current,
        error: 'Enter a valid body fat change percentage.',
      }))
      return
    }

    try {
      saveManualBodyFatChangePercent(value)
      setManualBodyFat({ value, error: null })
      setIsEditingBodyFat(false)
    } catch {
      setManualBodyFat((current) => ({
        ...current,
        error: 'Could not save the body fat change. Please try again.',
      }))
    }
  }

  const [yearStr, monthStr] = selectedMonthKey.split('-')
  const monthDate = new Date(Number(yearStr), Number(monthStr) - 1, 1)
  const formattedMonth = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(monthDate)

  // Calendar padding before 1st day of month
  const firstDayOfWeek = summary?.days[0]?.dayOfWeek ?? 0
  const emptyPaddingDays = Array.from({ length: firstDayOfWeek }, (_, i) => i)

  return (
    <Card className="space-y-6">
      {/* Header with Month Navigation & Action */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Calendar size={18} />
            </span>
            <h2 className="text-lg font-bold text-ink">Monthly Target & Adherence</h2>
          </div>
          <p className="mt-1 text-xs text-muted">
            Track daily calorie compliance against your monthly phase targets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-line bg-surface p-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className="rounded-lg p-1.5 text-muted hover:bg-hover hover:text-ink transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 text-xs font-semibold text-ink">{formattedMonth}</span>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Next month"
              className="rounded-lg p-1.5 text-muted hover:bg-hover hover:text-ink transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <Button
            size="small"
            variant="outline"
            icon={Sliders}
            onClick={onOpenCalculator}
          >
            Adjust Target
          </Button>
        </div>
      </div>

      {/* Target & KPI Stats */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface p-3.5">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Target Target</span>
              {summary.target?.phase && (
                <Badge
                  variant={
                    summary.target.phase === 'cut'
                      ? 'warning'
                      : summary.target.phase === 'bulk'
                        ? 'success'
                        : 'default'
                  }
                >
                  {summary.target.phase}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xl font-bold text-ink sm:text-2xl">
              {summary.targetCalories.toLocaleString()}
              <span className="text-xs font-normal text-muted ml-1">kcal/d</span>
            </p>
          </div>

          <div className="rounded-xl border border-line bg-surface p-3.5">
            <p className="text-xs text-muted">Daily Avg Logged</p>
            <p className="mt-1 text-xl font-bold text-ink sm:text-2xl">
              {summary.averageDailyCalories > 0
                ? summary.averageDailyCalories.toLocaleString()
                : '—'}
              <span className="text-xs font-normal text-muted ml-1">kcal</span>
            </p>
          </div>

          <div className="rounded-xl border border-line bg-surface p-3.5">
            <p className="text-xs text-muted">On-Track Days</p>
            <p className="mt-1 text-xl font-bold text-ink sm:text-2xl">
              {summary.onTrackDaysCount}
              <span className="text-xs font-normal text-muted ml-1">
                / {summary.daysLoggedCount} logged
              </span>
            </p>
            <p className="mt-0.5 text-[11px] text-accent font-medium">
              {summary.adherencePercent}% adherence
            </p>
          </div>

          <div className="rounded-xl border border-line bg-surface p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted">Est. Body Fat Δ</p>
              {!isEditingBodyFat && (
                <Button
                  size="small"
                  variant="ghost"
                  icon={Pencil}
                  className="min-h-8 px-2"
                  onClick={() => {
                    setBodyFatDraft(
                      manualBodyFatChangePercent === null
                        ? ''
                        : String(manualBodyFatChangePercent),
                    )
                    setManualBodyFat((current) => ({ ...current, error: null }))
                    setIsEditingBodyFat(true)
                  }}
                >
                  {manualBodyFatChangePercent === null ? 'Enter' : 'Edit'}
                </Button>
              )}
            </div>
            {isEditingBodyFat ? (
              <form className="mt-2 space-y-2" onSubmit={handleSaveBodyFatChange}>
                <div className="flex items-center gap-2">
                  <input
                    aria-label="Manual body fat change percentage"
                    autoFocus
                    className="min-h-9 w-full min-w-0 rounded-lg border border-line bg-panel px-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
                    inputMode="decimal"
                    onChange={(event) => setBodyFatDraft(event.target.value)}
                    step="0.01"
                    type="number"
                    value={bodyFatDraft}
                  />
                  <span className="text-xs text-muted">%</span>
                </div>
                <div className="flex gap-1">
                  <Button size="small" type="submit" icon={Check}>
                    Save
                  </Button>
                  <Button
                    size="small"
                    variant="ghost"
                    icon={X}
                    onClick={() => {
                      setIsEditingBodyFat(false)
                      setManualBodyFat((current) => ({ ...current, error: null }))
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <p
                  className={`mt-1 text-xl font-bold sm:text-2xl ${
                    manualBodyFatChangePercent === null ||
                    manualBodyFatChangePercent === 0
                      ? 'text-ink'
                      : manualBodyFatChangePercent < 0
                        ? 'text-warning'
                        : 'text-success'
                  }`}
                >
                  {manualBodyFatChangePercent === null
                    ? '—'
                    : `${manualBodyFatChangePercent > 0 ? '+' : ''}${manualBodyFatChangePercent}%`}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">Manual entry</p>
              </>
            )}
            {bodyFatError && (
              <p className="mt-1 text-[11px] text-danger" role="alert">
                {bodyFatError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Calendar Heatmap Grid */}
      <div className="rounded-xl border border-line bg-panel p-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
          {WEEKDAYS.map((wd) => (
            <div key={wd}>{wd}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {emptyPaddingDays.map((i) => (
            <div key={`padding-${i}`} className="min-h-14 rounded-lg bg-transparent" />
          ))}

          {summary?.days.map((day) => {
            const isToday = day.date === todayDate

            return (
              <div
                key={day.date}
                className={`flex flex-col justify-between rounded-xl border p-2 min-h-16 transition-all ${
                  day.status === 'on_track'
                    ? 'border-success/40 bg-success-soft/30'
                    : day.status === 'surplus'
                      ? 'border-amber-500/30 bg-amber-500/10'
                      : day.status === 'deficit'
                        ? 'border-sky-500/30 bg-sky-500/10'
                        : 'border-line/60 bg-surface/60'
                } ${isToday ? 'ring-2 ring-accent' : ''}`}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className={isToday ? 'text-accent' : 'text-muted'}>
                    {day.dayNumber}
                  </span>
                  {day.status === 'on_track' && (
                    <span className="size-2 rounded-full bg-success" title="On Track" />
                  )}
                  {day.status === 'surplus' && (
                    <span className="size-2 rounded-full bg-amber-500" title="Surplus" />
                  )}
                  {day.status === 'deficit' && (
                    <span className="size-2 rounded-full bg-sky-500" title="Deficit" />
                  )}
                </div>

                <div className="mt-1">
                  {day.calories > 0 ? (
                    <p className="text-xs font-bold text-ink sm:text-sm font-mono">
                      {day.calories}
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted/60">—</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 border-t border-line pt-3 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-success" />
            <span>On Track (±100 kcal)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-sky-500" />
            <span>Deficit (&gt;100 kcal under)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-amber-500" />
            <span>Surplus (&gt;100 kcal over)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-muted/40" />
            <span>No Meals Logged</span>
          </div>
        </div>
      </div>
    </Card>
  )
}
