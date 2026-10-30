import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Apple,
  ArrowRight,
  Check,
  ChevronRight,
  Dumbbell,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { Badge, Button, Card } from '../../components/common'
import { Sheet } from '../../components/common/Sheet'
import PageContainer from '../../components/layout/PageContainer'
import DashboardAiLogger from './components/DashboardAiLogger'
import { getSavedNutritionGoals } from '../nutrition/nutritionService'
import type { DailyNutritionGoals } from '../nutrition/types'
import { loadDashboardThunk } from './dashboardSlice'
import type { DashboardAnalytics, DashboardDay } from './analyticsService'
import { startWorkoutThunk, loadActiveWorkoutThunk } from '../workouts/workoutThunks'

function localDateFromString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(undefined, options ?? { dateStyle: 'medium' }).format(
    localDateFromString(value),
  )
}

function formatMetric(value: number, digits = 0): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
  }).format(value)
}

function formatTimestampAsLocalDate(value: string): string {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [quickLogOpen, setQuickLogOpen] = useState(false)

  const {
    activeWorkoutId,
    status: workoutStatus,
    error: workoutError,
  } = useAppSelector((state) => state.workoutUi)

  const {
    period,
    analytics,
    status,
    error,
  } = useAppSelector((state) => state.dashboard)

  const [nutritionGoals] = useState<DailyNutritionGoals | null>(
    getSavedNutritionGoals,
  )

  useEffect(() => {
    void dispatch(loadDashboardThunk(period))
  }, [dispatch, period])

  useEffect(() => {
    void dispatch(loadActiveWorkoutThunk())
  }, [dispatch])

  const handleStartWorkout = async () => {
    if (activeWorkoutId) {
      navigate('/workouts/active')
      return
    }
    try {
      await dispatch(startWorkoutThunk(undefined)).unwrap()
      navigate('/workouts/active')
    } catch {
      // workoutError in state will display
    }
  }

  const handleRefresh = () => {
    void dispatch(loadDashboardThunk(period))
  }

  return (
    <PageContainer>
      {/* Error state */}
      {status === 'failed' && (
        <div
          role="alert"
          className="mb-6 flex flex-col justify-between gap-3 rounded-2xl border border-danger/20 bg-danger-soft p-4 text-sm text-danger sm:flex-row sm:items-center"
        >
          <p>{error ?? 'Could not load dashboard data.'}</p>
          <Button
            size="small"
            variant="outline"
            icon={RefreshCw}
            onClick={handleRefresh}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Loading state */}
      {status === 'loading' && !analytics ? (
        <Card>
          <div role="status" className="py-16 text-center">
            <RefreshCw size={24} className="mx-auto animate-spin text-accent" />
            <p className="mt-3 text-sm font-medium text-ink">Loading your dashboard…</p>
            <p className="mt-1 text-xs text-muted">Fetching today's schedule and weekly momentum.</p>
          </div>
        </Card>
      ) : analytics ? (
        <DashboardView
          analytics={analytics}
          nutritionGoals={nutritionGoals}
          activeWorkoutId={activeWorkoutId}
          workoutStatus={workoutStatus}
          workoutError={workoutError}
          onStartWorkout={handleStartWorkout}
          onOpenQuickLog={() => setQuickLogOpen(true)}
        />
      ) : null}

      {/* Floating Action Button (FAB) for AI Quick-Log */}
      <button
        type="button"
        onClick={() => setQuickLogOpen(true)}
        aria-label="Quick log with AI"
        className="fab-pulse fixed bottom-20 right-4 sm:bottom-8 sm:right-8 z-30 flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition-all hover:opacity-95 active:scale-95 focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Sparkles size={18} aria-hidden="true" />
        <span className="font-medium">Quick Log</span>
      </button>

      {/* Quick-Log Sheet / Drawer */}
      <Sheet
        open={quickLogOpen}
        onClose={() => setQuickLogOpen(false)}
        title="Quick Log with AI"
        variant="adaptive"
      >
        <DashboardAiLogger
          isDrawer
          onActivityLogged={() => {
            setQuickLogOpen(false)
            handleRefresh()
          }}
        />
      </Sheet>
    </PageContainer>
  )
}

function DashboardView({
  analytics,
  nutritionGoals,
  activeWorkoutId,
  workoutStatus,
  workoutError,
  onStartWorkout,
  onOpenQuickLog,
}: {
  analytics: DashboardAnalytics
  nutritionGoals: DailyNutritionGoals | null
  activeWorkoutId: string | null
  workoutStatus: 'idle' | 'loading' | 'saving' | 'failed'
  workoutError: string | null
  onStartWorkout: () => Promise<void>
  onOpenQuickLog: () => void
}) {
  const greeting = getGreeting()
  const todayDateStr = analytics.period.endDate
  const formattedToday = formatDate(todayDateStr, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  // Today's data
  const todayDay: DashboardDay | undefined = analytics.days[analytics.days.length - 1]
  const todayCalories = todayDay?.nutrition.calories ?? 0
  const todayProtein = todayDay?.nutrition.proteinG ?? 0
  const todayCarbs = todayDay?.nutrition.carbsG ?? 0
  const todayFat = todayDay?.nutrition.fatG ?? 0

  // Check if a workout was completed today
  const todayCompletedWorkout = useMemo(() => {
    return analytics.workouts.recent.find((workout) => {
      const date = formatTimestampAsLocalDate(
        workout.session.completedAt ?? workout.session.startedAt,
      )
      return date === todayDateStr
    })
  }, [analytics.workouts.recent, todayDateStr])

  // Last 7 days momentum
  const weekDays = useMemo(() => analytics.days.slice(-7), [analytics.days])
  const weeklyWorkoutCount = weekDays.reduce((total, d) => total + d.workoutCount, 0)
  const weeklyTrainingDays = weekDays.filter((d) => d.workoutCount > 0).length
  const weeklyVolume = weekDays.reduce((total, d) => total + d.trainingVolumeKg, 0)

  // Recent 3 activities
  const recentActivities = analytics.activities.slice(0, 3)

  return (
    <div className="space-y-6">
      {/* 1. Hero Section */}
      <header className="flex flex-col justify-between gap-4 border-b border-line pb-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            {formattedToday}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {greeting} <span className="emoji" aria-hidden="true">👋</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            icon={Sparkles}
            onClick={onOpenQuickLog}
            className="flex-1 sm:flex-initial"
          >
            Quick Log
          </Button>

          <Button
            variant="primary"
            icon={activeWorkoutId ? Play : Dumbbell}
            loading={workoutStatus === 'saving'}
            disabled={workoutStatus === 'loading'}
            onClick={() => void onStartWorkout()}
            className="flex-1 sm:flex-initial"
          >
            {activeWorkoutId ? 'Resume Workout' : 'Start Workout'}
          </Button>
        </div>
      </header>

      {/* Workout error feedback */}
      {workoutError && (
        <div
          role="alert"
          className="rounded-xl border border-danger/20 bg-danger-soft p-3 text-xs text-danger"
        >
          {workoutError}
        </div>
      )}

      {/* Active Workout In-Progress Alert Banner */}
      {activeWorkoutId && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-ink">
          <div className="flex items-center gap-3">
            <span className="relative flex size-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex size-3 rounded-full bg-accent" />
            </span>
            <div>
              <p className="text-sm font-semibold">Active workout in progress</p>
              <p className="text-xs text-muted">Your training session is currently running.</p>
            </div>
          </div>
          <Link
            to="/workouts/active"
            className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg transition-opacity hover:opacity-90"
          >
            <span>Resume</span>
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* 2. Today's Glance: 2 High-Focus Cards */}
      <section aria-labelledby="today-glance-title">
        <h2 id="today-glance-title" className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          Today's Glance
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Card A: Today's Workout */}
          <Card className="flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-xl bg-surface text-accent">
                  <Dumbbell size={18} aria-hidden="true" />
                </span>
                {activeWorkoutId ? (
                  <Badge variant="warning">In Progress</Badge>
                ) : todayCompletedWorkout ? (
                  <Badge variant="success">Completed</Badge>
                ) : (
                  <Badge variant="default">Rest / Planned</Badge>
                )}
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium text-muted">Today's Workout</p>
                {activeWorkoutId ? (
                  <h3 className="mt-1 text-lg font-semibold text-ink">Session in progress</h3>
                ) : todayCompletedWorkout ? (
                  <h3 className="mt-1 text-lg font-semibold text-ink">
                    {todayCompletedWorkout.session.name}
                  </h3>
                ) : (
                  <h3 className="mt-1 text-lg font-semibold text-ink">No workout yet today</h3>
                )}

                <p className="mt-1 text-xs text-muted">
                  {activeWorkoutId
                    ? 'Pick up where you left off in your current workout.'
                    : todayCompletedWorkout
                      ? `${todayCompletedWorkout.exerciseCount} exercises · ${todayCompletedWorkout.completedSetCount} completed sets · ${formatMetric(todayCompletedWorkout.trainingVolumeKg)} kg volume`
                      : 'Hit the gym or log a past session to keep your momentum going.'}
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-line pt-3">
              {activeWorkoutId ? (
                <Link
                  to="/workouts/active"
                  className="flex items-center justify-between text-xs font-semibold text-accent hover:underline"
                >
                  <span>Resume active workout</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              ) : todayCompletedWorkout ? (
                <Link
                  to={`/workouts/${todayCompletedWorkout.session.id}`}
                  className="flex items-center justify-between text-xs font-semibold text-accent hover:underline"
                >
                  <span>View workout summary</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              ) : (
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => void onStartWorkout()}
                    className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                  >
                    <span>Start workout now</span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                  <Link
                    to="/workouts"
                    className="text-xs text-muted hover:text-ink"
                  >
                    Routines
                  </Link>
                </div>
              )}
            </div>
          </Card>

          {/* Card B: Today's Nutrition */}
          <Card className="flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-xl bg-surface text-accent">
                  <Apple size={18} aria-hidden="true" />
                </span>
                <Link
                  to="/nutrition"
                  className="text-xs font-medium text-accent hover:underline"
                >
                  Nutrition details
                </Link>
              </div>

              <div className="mt-4 space-y-3">
                {/* Calories Progress */}
                <div>
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-muted">Calories</span>
                    <span className="tabular-nums text-ink">
                      {formatMetric(todayCalories)}{' '}
                      {nutritionGoals ? `/ ${formatMetric(nutritionGoals.calories)} kcal` : 'kcal'}
                    </span>
                  </div>
                  {nutritionGoals ? (
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.round((todayCalories / Math.max(1, nutritionGoals.calories)) * 100))}%`,
                        }}
                      />
                    </div>
                  ) : null}
                </div>

                {/* Protein Progress */}
                <div>
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-muted">Protein</span>
                    <span className="tabular-nums text-ink">
                      {formatMetric(todayProtein)}{' '}
                      {nutritionGoals ? `/ ${formatMetric(nutritionGoals.proteinG)} g` : 'g'}
                    </span>
                  </div>
                  {nutritionGoals ? (
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.round((todayProtein / Math.max(1, nutritionGoals.proteinG)) * 100))}%`,
                        }}
                      />
                    </div>
                  ) : null}
                </div>

                {/* Secondary Macros */}
                <div className="flex items-center gap-3 pt-1 text-xs text-muted">
                  <span>
                    <strong className="font-semibold text-ink">{formatMetric(todayCarbs)}g</strong> carbs
                  </span>
                  <span>·</span>
                  <span>
                    <strong className="font-semibold text-ink">{formatMetric(todayFat)}g</strong> fat
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-line pt-3">
              <div className="flex items-center justify-between">
                <Link
                  to="/nutrition"
                  className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                >
                  <Plus size={13} aria-hidden="true" />
                  <span>Log a meal</span>
                </Link>
                {!nutritionGoals && (
                  <Link
                    to="/nutrition"
                    className="text-xs text-muted hover:text-ink"
                  >
                    Set daily targets
                  </Link>
                )}
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* 3. This Week's Momentum (7-Day Strip) */}
      <section aria-labelledby="momentum-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="momentum-title" className="text-sm font-semibold uppercase tracking-wider text-muted">
            This Week's Momentum
          </h2>
          <Link
            to="/progress"
            className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            <span>Full analytics</span>
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>

        <Card>
          {/* 7-Day Day Strip */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {weekDays.map((day) => {
              const dateObj = localDateFromString(day.date)
              const dayName = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(dateObj)
              const dayNum = dateObj.getDate()
              const isToday = day.date === todayDateStr
              const hasWorkout = day.workoutCount > 0

              return (
                <div
                  key={day.date}
                  className={`flex flex-col items-center rounded-xl p-2 transition-colors ${
                    isToday
                      ? 'border border-accent/40 bg-accent/5'
                      : 'bg-surface/50'
                  }`}
                >
                  <span className={`text-[11px] font-semibold ${isToday ? 'text-accent' : 'text-muted'}`}>
                    {dayName}
                  </span>
                  <span className={`mt-0.5 text-xs font-bold ${isToday ? 'text-ink' : 'text-ink/80'}`}>
                    {dayNum}
                  </span>
                  <div className="mt-2 flex size-6 items-center justify-center">
                    {hasWorkout ? (
                      <span
                        className="flex size-5 items-center justify-center rounded-full bg-accent text-accent-fg"
                        title={`${day.workoutCount} workout completed`}
                      >
                        <Check size={12} className="stroke-[3]" aria-hidden="true" />
                      </span>
                    ) : (
                      <span className="size-1.5 rounded-full bg-line" title="Rest day" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Weekly Summary Stats */}
          <div className="mt-4 grid grid-cols-3 divide-x divide-line border-t border-line pt-4 text-center">
            <div className="px-2">
              <p className="text-[11px] text-muted">Workouts</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-ink sm:text-lg">
                {weeklyWorkoutCount}
              </p>
            </div>
            <div className="px-2">
              <p className="text-[11px] text-muted">Training Days</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-ink sm:text-lg">
                {weeklyTrainingDays} <span className="text-xs font-normal text-muted">/ 7</span>
              </p>
            </div>
            <div className="px-2">
              <p className="text-[11px] text-muted">Volume</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-ink sm:text-lg">
                {formatMetric(weeklyVolume)} <span className="text-xs font-normal text-muted">kg</span>
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* 4. Recent Activity */}
      <section aria-labelledby="recent-activity-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent-activity-title" className="text-sm font-semibold uppercase tracking-wider text-muted">
            Recent Activity
          </h2>
          <Link
            to="/workouts"
            className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            <span>History</span>
            <ChevronRight size={13} aria-hidden="true" />
          </Link>
        </div>

        {recentActivities.length > 0 ? (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-panel">
            {recentActivities.map((activity) => (
              <li
                key={`${activity.type}:${activity.id}`}
                className="flex items-center justify-between gap-3 p-3.5 transition-colors hover:bg-hover sm:p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface text-accent"
                    aria-hidden="true"
                  >
                    {activity.type === 'workout' ? (
                      <Dumbbell size={16} />
                    ) : (
                      <Apple size={16} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {activity.title}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {activity.description}
                    </p>
                  </div>
                </div>

                {activity.type === 'workout' && activity.workoutId ? (
                  <Link
                    to={`/workouts/${activity.workoutId}`}
                    className="shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                  >
                    View
                  </Link>
                ) : (
                  <Link
                    to="/nutrition"
                    className="shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                  >
                    View
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <div className="py-8 text-center text-sm text-muted">
              <p>No recent activity recorded yet.</p>
              <div className="mt-3 flex justify-center gap-2">
                <Button size="small" variant="outline" icon={Dumbbell} onClick={() => void onStartWorkout()}>
                  Start workout
                </Button>
                <Link to="/nutrition">
                  <Button size="small" variant="outline" icon={Apple}>
                    Log meal
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        )}
      </section>
    </div>
  )
}
