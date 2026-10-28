import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Apple, Bot, Dumbbell, RefreshCw } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { Button, Card, EmptyState } from '../../components/common'
import PageContainer from '../../components/layout/PageContainer'
import DashboardAiLogger from './components/DashboardAiLogger'
import {
  getSavedNutritionGoals,
} from '../nutrition/nutritionService'
import type { DailyNutritionGoals } from '../nutrition/types'
import {
  loadDashboardThunk,
  loadExerciseProgressThunk,
  setDashboardExercise,
  setDashboardPeriod,
} from './dashboardSlice'
import type {
  AnalyticsPeriod,
  DashboardDay,
  DashboardAnalytics,
  ExerciseProgress,
} from './analyticsService'
import type { DailyNutritionTotals } from '../nutrition/types'

const rangeOptions: Array<{ days: AnalyticsPeriod; label: string }> = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
]

function localDateFromString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(undefined, options ?? { dateStyle: 'medium' }).format(
    localDateFromString(value),
  )
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'No valid durations'
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return hours ? `${hours} hr ${remainder} min` : `${minutes} min`
}

function formatMetric(value: number, digits = 0): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
  }).format(value)
}

function formatDelta(value: number, suffix = ''): string {
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return `No change${suffix}`
  const sign = rounded > 0 ? '+' : '−'
  return `${sign}${formatMetric(Math.abs(rounded), 1)}${suffix}`
}

function DashboardPage() {
  const dispatch = useAppDispatch()
  const {
    period,
    analytics,
    status,
    error,
    exerciseId,
    exerciseProgress,
    exerciseStatus,
    exerciseError,
  } = useAppSelector((state) => state.dashboard)
  const [nutritionGoals] = useState<DailyNutritionGoals | null>(
    getSavedNutritionGoals,
  )

  useEffect(() => {
    void dispatch(loadDashboardThunk(period))
  }, [dispatch, period])

  useEffect(() => {
    if (exerciseId) void dispatch(loadExerciseProgressThunk(exerciseId))
  }, [dispatch, exerciseId])

  const changePeriod = (nextPeriod: AnalyticsPeriod) => {
    dispatch(setDashboardPeriod(nextPeriod))
  }

  const chooseExercise = (nextExerciseId: string) => {
    dispatch(setDashboardExercise(nextExerciseId))
  }

  return (
    <PageContainer>
      <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="mb-2 text-sm font-medium text-accent">Your training and nutrition</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Progress dashboard
          </h1>
          <p className="mt-2 text-sm text-muted">
            {analytics
              ? formatDate(analytics.period.endDate, { dateStyle: 'full' })
              : 'Loading current date'}
          </p>
        </div>
        <label className="flex min-h-11 flex-col gap-1 text-sm font-medium text-ink sm:min-w-44">
          Analytics period
          <select
            aria-label="Analytics period"
            value={period}
            onChange={(event) => changePeriod(Number(event.currentTarget.value) as AnalyticsPeriod)}
            className="min-h-11 rounded-lg border border-line bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          >
            {rangeOptions.map((option) => (
              <option key={option.days} value={option.days}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      {status === 'failed' && (
        <div
          role="alert"
          className="mb-6 flex flex-col justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center"
        >
          <p>{error ?? 'Could not load dashboard analytics.'}</p>
          <Button
            size="small"
            variant="outline"
            icon={RefreshCw}
            onClick={() => void dispatch(loadDashboardThunk(period))}
          >
            Retry
          </Button>
        </div>
      )}

      {status === 'loading' || !analytics ? (
        <Card>
          <p role="status" className="py-12 text-center text-sm text-muted">
            Loading your progress…
          </p>
        </Card>
      ) : (
        <DashboardContent
          analytics={analytics}
          nutritionGoals={nutritionGoals}
          exerciseId={exerciseId}
          exerciseProgress={exerciseProgress}
          exerciseStatus={exerciseStatus}
          exerciseError={exerciseError}
          onChooseExercise={chooseExercise}
          onRetryExercise={() => {
            if (exerciseId) void dispatch(loadExerciseProgressThunk(exerciseId))
          }}
          onActivityLogged={() => void dispatch(loadDashboardThunk(period))}
        />
      )}
    </PageContainer>
  )
}

function DashboardContent({
  analytics,
  nutritionGoals,
  exerciseId,
  exerciseProgress,
  exerciseStatus,
  exerciseError,
  onChooseExercise,
  onRetryExercise,
  onActivityLogged,
}: {
  analytics: DashboardAnalytics
  nutritionGoals: DailyNutritionGoals | null
  exerciseId: string
  exerciseProgress: ExerciseProgress | null
  exerciseStatus: 'idle' | 'loading' | 'failed'
  exerciseError: string | null
  onChooseExercise: (id: string) => void
  onRetryExercise: () => void
  onActivityLogged: () => void
}) {
  const [nutritionMetric, setNutritionMetric] =
    useState<keyof DailyNutritionTotals>('calories')
  const hasAnyHistory =
    analytics.workouts.count > 0 || analytics.nutrition.mealLogCount > 0
  const calorieAverageAvailable = analytics.nutrition.mealLogCount > 0

  return (
    <div className="space-y-8">
      <DashboardAiLogger onActivityLogged={onActivityLogged} />

      {!hasAnyHistory && (
        <Card>
          <EmptyState
            icon={Activity}
            title="No activity recorded in this period"
            description="Start a workout or log a meal to see your real progress here. Unlogged days are not evidence of zero intake."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/ai-logger">
                  <Button icon={Bot}>Log with AI</Button>
                </Link>
                <Link to="/workouts">
                  <Button variant="outline" icon={Dumbbell}>Go to workouts</Button>
                </Link>
                <Link to="/nutrition">
                  <Button variant="outline" icon={Apple}>Log a meal</Button>
                </Link>
              </div>
            }
          />
        </Card>
      )}

      <section aria-labelledby="overview-stats-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="overview-stats-title" className="text-xl font-semibold text-ink">
              Period overview
            </h2>
            <p className="mt-1 text-sm text-muted">
              {formatDate(analytics.period.startDate)} – {formatDate(analytics.period.endDate)} · today included
            </p>
          </div>
          <Link
            to="/workouts"
            className="min-h-10 rounded-md px-2 py-2 text-sm font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Workout history
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Completed workouts"
            value={formatMetric(analytics.workouts.count)}
            note={comparisonNote(analytics, analytics.comparison.workouts, 'workouts')}
          />
          <StatCard
            label="Training days"
            value={formatMetric(analytics.workouts.trainingDays)}
            note={comparisonNote(analytics, analytics.comparison.trainingDays, 'days')}
          />
          <StatCard
            label="Completed time"
            value={formatDuration(analytics.workouts.totalDurationSeconds)}
            note="Valid completed-session timestamps only"
          />
          <StatCard
            label="Training volume"
            value={`${formatMetric(analytics.workouts.totalVolumeKg)} kg`}
            note="External load · completed sets only"
          />
          <StatCard
            label="Avg. recorded calories"
            value={calorieAverageAvailable
              ? `${formatMetric(analytics.nutrition.averagePerCalendarDay.calories)} kcal`
              : 'No entries'}
            note="Per calendar day; unlogged days count as no recorded intake"
          />
          <StatCard
            label="Avg. recorded protein"
            value={calorieAverageAvailable
              ? `${formatMetric(analytics.nutrition.averagePerCalendarDay.proteinG)} g`
              : 'No entries'}
            note="Per calendar day; based on meal-log snapshots"
          />
        </div>
        {calorieAverageAvailable && (
          <p className="mt-2 text-xs leading-5 text-muted">
            Nutrition averages describe recorded entries, not verified total consumption.
            {analytics.nutrition.daysWithEntries} of {analytics.period.days} days have meal entries.
          </p>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <ComparisonCard
            label="Completed workouts"
            value={`${analytics.workouts.count} vs ${analytics.comparison.previousWorkouts}`}
          />
          <ComparisonCard
            label="Training days"
            value={`${analytics.workouts.trainingDays} vs ${analytics.comparison.previousTrainingDays}`}
          />
          <ComparisonCard
            label="Recorded average calories"
            value={calorieAverageAvailable || analytics.comparison.hasPreviousNutrition
              ? `${formatMetric(analytics.nutrition.averagePerCalendarDay.calories)} vs ${formatMetric(analytics.comparison.previousAverageCalories)} kcal/day`
              : 'No meal entries in either period'}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          Compared with the immediately preceding {analytics.period.days} calendar days; no percentage is shown for a zero baseline.
        </p>
      </section>

      <section aria-labelledby="consistency-title">
        <div className="mb-3">
          <h2 id="consistency-title" className="text-xl font-semibold text-ink">
            Workout consistency
          </h2>
          <p className="mt-1 text-sm text-muted">
            {formatMetric(analytics.workouts.perSevenDays, 1)} completed workouts per 7 calendar days
            {' · '}one training day per distinct local completion date
          </p>
        </div>
        <Card title="Completed workouts by local day" description="A workout is counted on its local completion date.">
          <DailyBarChart
            days={analytics.days}
            value={(day) => day.workoutCount > 0 ? day.workoutCount : null}
            label={(day) => `${day.workoutCount} completed workout${day.workoutCount === 1 ? '' : 's'}`}
            color="bg-accent"
            emptyMessage="No completed workouts in this period."
          />
        </Card>
      </section>

      <section aria-labelledby="nutrition-trend-title">
        <div className="mb-3">
          <h2 id="nutrition-trend-title" className="text-xl font-semibold text-ink">
            Recorded nutrition
          </h2>
          <p className="mt-1 text-sm text-muted">
            Daily calories and macros are summed from meal-log snapshots, including the recorded portion size.
          </p>
        </div>
        <Card
          title="Daily nutrition trend"
          description="Days with no meal entries are marked separately and are not evidence of zero consumption."
          actions={
            <Link
              to="/nutrition"
              className="min-h-10 rounded-md px-2 py-2 text-sm font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
            >
              Open nutrition
            </Link>
          }
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <label className="flex min-h-11 flex-col gap-1 text-sm font-medium text-ink">
              Chart metric
              <select
                aria-label="Daily nutrition chart metric"
                value={nutritionMetric}
                onChange={(event) => {
                  const candidate = event.currentTarget.value
                  if (
                    candidate === 'calories' ||
                    candidate === 'proteinG' ||
                    candidate === 'carbsG' ||
                    candidate === 'fatG'
                  ) {
                    setNutritionMetric(candidate)
                  }
                }}
                className="min-h-11 rounded-lg border border-line bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              >
                <option value="calories">Calories (kcal)</option>
                <option value="proteinG">Protein (g)</option>
                <option value="carbsG">Carbohydrates (g)</option>
                <option value="fatG">Fat (g)</option>
              </select>
            </label>
          </div>
          <DailyBarChart
            days={analytics.days}
            value={(day) => day.hasMealEntries ? day.nutrition[nutritionMetric] : null}
            label={(day) => day.hasMealEntries
              ? nutritionMetric === 'calories'
                ? `${formatMetric(day.nutrition.calories)} kcal recorded`
                : `${formatMetric(day.nutrition[nutritionMetric])} g recorded`
              : 'No entries'}
            color={nutritionMetric === 'calories' ? 'bg-emerald-600' : 'bg-accent'}
            emptyMessage="No meal entries in this period."
          />
          {analytics.nutrition.mealLogCount > 0 && (
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
              <NutritionValue label="Calories" value={analytics.nutrition.averagePerCalendarDay.calories} unit="kcal/day" />
              <NutritionValue label="Protein" value={analytics.nutrition.averagePerCalendarDay.proteinG} unit="g/day" />
              <NutritionValue label="Carbohydrates" value={analytics.nutrition.averagePerCalendarDay.carbsG} unit="g/day" />
              <NutritionValue label="Fat" value={analytics.nutrition.averagePerCalendarDay.fatG} unit="g/day" />
            </div>
          )}
          {nutritionGoals && (
            <div className="mt-5 border-t border-line pt-4">
              <h3 className="text-sm font-semibold text-ink">
                Saved daily targets vs recorded period averages
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted">
                Targets are the values you saved in Nutrition. Averages use all calendar days and do not represent verified total intake.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <GoalReference
                  label="Calories"
                  average={analytics.nutrition.averagePerCalendarDay.calories}
                  target={nutritionGoals.calories}
                  unit="kcal"
                  hasEntries={analytics.nutrition.mealLogCount > 0}
                />
                <GoalReference
                  label="Protein"
                  average={analytics.nutrition.averagePerCalendarDay.proteinG}
                  target={nutritionGoals.proteinG}
                  unit="g"
                  hasEntries={analytics.nutrition.mealLogCount > 0}
                />
                <GoalReference
                  label="Carbohydrates"
                  average={analytics.nutrition.averagePerCalendarDay.carbsG}
                  target={nutritionGoals.carbsG}
                  unit="g"
                  hasEntries={analytics.nutrition.mealLogCount > 0}
                />
                <GoalReference
                  label="Fat"
                  average={analytics.nutrition.averagePerCalendarDay.fatG}
                  target={nutritionGoals.fatG}
                  unit="g"
                  hasEntries={analytics.nutrition.mealLogCount > 0}
                />
              </div>
            </div>
          )}
        </Card>
      </section>

      <section aria-labelledby="exercise-progress-title">
        <div className="mb-3">
          <h2 id="exercise-progress-title" className="text-xl font-semibold text-ink">
            Exercise progress
          </h2>
          <p className="mt-1 text-sm text-muted">
            Exact exercise identity; comparisons use completed sets only.
          </p>
        </div>
        <Card
          title="Recorded performance history"
          description="Best recorded weight is the highest external load logged for the selected exercise; it is not an estimated strength measure."
          actions={
            <label className="flex min-h-11 flex-col gap-1 text-sm font-medium text-ink sm:min-w-52">
              Exercise
              <select
                aria-label="Exercise progress"
                value={exerciseId}
                onChange={(event) => onChooseExercise(event.currentTarget.value)}
                className="min-h-11 max-w-full rounded-lg border border-line bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              >
                <option value="">Choose an exercise</option>
                {analytics.exercises.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </option>
                ))}
              </select>
            </label>
          }
        >
          {!analytics.exercises.length ? (
            <EmptyState
              icon={Dumbbell}
              title="No exercises available"
              description="Add an exercise to a workout to explore its recorded performance."
              action={
                <Link to="/workouts">
                  <Button variant="outline">Go to workouts</Button>
                </Link>
              }
            />
          ) : !exerciseId ? (
            <p className="text-sm text-muted">Choose an exercise to load its full completed history.</p>
          ) : exerciseStatus === 'loading' ? (
            <p role="status" className="py-4 text-sm text-muted">Loading exercise history…</p>
          ) : exerciseStatus === 'failed' ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 text-sm text-red-700">
              <p>{exerciseError ?? 'Could not load exercise history.'}</p>
              <Button size="small" variant="outline" onClick={onRetryExercise}>Retry</Button>
            </div>
          ) : exerciseProgress ? (
            <ExerciseHistory progress={exerciseProgress} />
          ) : (
            <p className="text-sm text-muted">Select an exercise to see performance.</p>
          )}
        </Card>
      </section>

      <section aria-labelledby="recent-activity-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="recent-activity-title" className="text-xl font-semibold text-ink">
              Recent activity
            </h2>
            <p className="mt-1 text-sm text-muted">Real workout and meal records from the selected period.</p>
          </div>
          <Link
            to="/workouts"
            className="min-h-10 rounded-md px-2 py-2 text-sm font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
          >
            History
          </Link>
        </div>
        {analytics.activities.length ? (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-panel">
            {analytics.activities.map((activity) => (
              <li key={`${activity.type}:${activity.id}`} className="flex min-w-0 items-center gap-3 p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface text-accent" aria-hidden="true">
                  {activity.type === 'workout' ? <Dumbbell size={18} /> : <Apple size={18} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{activity.title}</p>
                  <p className="text-xs text-muted">
                    {formatDate(formatTimestampAsLocalDate(activity.timestamp), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })} · {activity.description}
                  </p>
                </div>
                {activity.type === 'workout' && activity.workoutId ? (
                  <Link
                    to={`/workouts/${activity.workoutId}`}
                    className="shrink-0 rounded-md px-2 py-2 text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    View
                  </Link>
                ) : (
                  <Link
                    to="/nutrition"
                    className="shrink-0 rounded-md px-2 py-2 text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    Nutrition
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <p className="text-sm text-muted">No recorded activity in this period.</p>
          </Card>
        )}
      </section>
    </div>
  )
}

function formatTimestampAsLocalDate(value: string): string {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function comparisonNote(
  analytics: DashboardAnalytics,
  delta: number,
  noun: string,
): string {
  return analytics.comparison.hasPreviousData
    ? `${formatDelta(delta)} vs previous ${analytics.period.days} days`
    : `No previous-period ${noun} data`
}

function StatCard({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note: string
}) {
  return (
    <Card className="min-w-0">
      <p className="text-xs font-medium leading-5 text-muted">{label}</p>
      <p className="mt-2 break-words text-xl font-semibold tabular-nums text-ink sm:text-2xl">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted">{note}</p>
    </Card>
  )
}

function ComparisonCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <p className="text-xs text-muted">{label} · current vs previous equal-length period</p>
      <p className="mt-1 text-sm font-semibold text-ink">
        {value}
      </p>
    </div>
  )
}

function NutritionValue({
  label,
  value,
  unit,
}: {
  label: string
  value: number
  unit: string
}) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">
        {formatMetric(value)} <span className="font-normal text-muted">{unit}</span>
      </p>
    </div>
  )
}

function GoalReference({
  label,
  average,
  target,
  unit,
  hasEntries,
}: {
  label: string
  average: number
  target: number
  unit: string
  hasEntries: boolean
}) {
  return (
    <div className="rounded-lg bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">
        {hasEntries ? formatMetric(average) : 'No entries'}{' '}
        <span className="font-normal text-muted">{unit} / {formatMetric(target)} {unit} target</span>
      </p>
    </div>
  )
}

function DailyBarChart({
  days,
  value,
  label,
  color,
  emptyMessage,
}: {
  days: DashboardDay[]
  value: (day: DashboardDay) => number | null
  label: (day: DashboardDay) => string
  color: string
  emptyMessage: string
}) {
  const values = days.map(value)
  const max = Math.max(1, ...values.filter((item): item is number => item !== null))
  const anyData = values.some((item) => item !== null && item > 0)
  const hasEntries = values.some((item) => item !== null)

  return (
    <>
      <div
        role="img"
        aria-label={`Daily recorded values shown from ${days[0]?.date ?? ''} to ${days.at(-1)?.date ?? ''}.`}
        className="grid h-36 grid-flow-col auto-cols-fr items-end gap-1 sm:h-44 sm:gap-1.5"
      >
        {days.map((day, index) => {
          const amount = values[index]
          const height = amount === null || amount <= 0 ? 0 : Math.max(4, (amount / max) * 100)
          const title = `${formatDate(day.date, { dateStyle: 'medium' })}: ${label(day)}`
          return (
            <div
              key={day.date}
              title={title}
              className="flex h-full min-w-0 items-end justify-center"
              aria-hidden="true"
            >
              {amount === null ? (
                <span className="h-0.5 w-full rounded-full bg-line" />
              ) : (
                <span
                  className={`w-full rounded-t-sm ${amount > 0 ? color : 'bg-line'}`}
                  style={{ height: `${height}%` }}
                />
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted" aria-hidden="true">
        <span>{days[0] ? formatDate(days[0].date, { month: 'short', day: 'numeric' }) : ''}</span>
        <span>{days.at(-1) ? formatDate(days.at(-1)!.date, { month: 'short', day: 'numeric' }) : ''}</span>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">
        {anyData
          ? `${values.filter((amount) => amount !== null && amount > 0).length} day${values.filter((amount) => amount !== null && amount > 0).length === 1 ? '' : 's'} with a positive recorded value. Daily values are also listed in accessible text.`
          : hasEntries
            ? 'Meal entries exist, but the selected metric totals zero.'
            : emptyMessage}
      </p>
      <ul className="sr-only">
        {days.map((day, index) => (
          <li key={day.date}>
            {formatDate(day.date)}: {values[index] === null ? 'No entries' : label(day)}
          </li>
        ))}
      </ul>
    </>
  )
}

function ExerciseHistory({ progress }: { progress: ExerciseProgress }) {
  const recentEntries = progress.entries.slice(-10)
  const recentList = progress.entries.slice(-5).reverse()
  const max = Math.max(1, ...recentEntries.map((entry) => entry.bestWeightKg))

  if (!progress.entries.length || progress.bestRecordedWeightKg === null) {
    return (
      <p className="text-sm text-muted">
        No completed performance yet. Record completed sets in completed workouts to build an exercise history.
      </p>
    )
  }

  return (
    <div>
      <p className="mb-3 text-sm text-ink">
        Best recorded weight: <strong>{formatMetric(progress.bestRecordedWeightKg)} kg</strong>
        <span className="text-muted"> · highest external load in completed sets</span>
      </p>
      <div
        role="img"
        aria-label={`Recent best recorded weight by completed workout. ${recentEntries.map((entry) => `${formatDate(formatTimestampAsLocalDate(entry.completedAt))}: ${formatMetric(entry.bestWeightKg)} kilograms`).join('; ')}`}
        className="grid h-28 grid-flow-col auto-cols-fr items-end gap-2 rounded-xl bg-surface p-3"
      >
        {recentEntries.map((entry) => (
          <div key={entry.workoutId} className="flex h-full min-w-0 items-end" aria-hidden="true" title={`${formatDate(formatTimestampAsLocalDate(entry.completedAt))}: ${formatMetric(entry.bestWeightKg)} kg`}>
            <span
              className="w-full rounded-t-sm bg-accent"
              style={{ height: `${Math.max(4, (entry.bestWeightKg / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        Recent completed workouts; each bar is the highest recorded weight in that workout. This is not a one-rep-max estimate.
      </p>
      <ul className="mt-4 divide-y divide-line">
        {recentList.map((entry) => (
          <li key={entry.workoutId} className="flex flex-wrap items-start justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{entry.exerciseNameSnapshot}</p>
              <p className="text-xs text-muted">
                {formatDate(formatTimestampAsLocalDate(entry.completedAt))} ·{' '}
                {entry.sets.map((set) => `${formatMetric(set.weightKg)} kg × ${set.reps}`).join(' · ')}
              </p>
            </div>
            <Link
              to={`/workouts/${entry.workoutId}`}
              className="min-h-10 shrink-0 rounded-md px-2 py-2 text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-accent"
            >
              Workout details
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default DashboardPage
