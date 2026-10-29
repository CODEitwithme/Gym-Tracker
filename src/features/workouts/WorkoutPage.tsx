import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Dumbbell, Play, RotateCcw } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { Badge, Button, Card, EmptyState } from '../../components/common'
import PageContainer from '../../components/layout/PageContainer'
import { formatLocalDate } from '../../lib/dateTime'
import { springSmooth } from '../../lib/motion'
import {
  loadActiveWorkoutThunk,
  startWorkoutThunk,
} from './workoutThunks'
import {
  listCompletedWorkoutSummaries,
  loadWorkoutDetails,
  type WorkoutSummary,
} from './workoutService'
import AiLogWorkoutModal from './components/AiLogWorkoutModal'
import WeeklyConsistencyStrip from './components/WeeklyConsistencyStrip'
import PostWorkoutHeroCard from './components/PostWorkoutHeroCard'
import type { ParsedWorkout } from '../ai-logger/types'
import type { ParsedWorkoutContext } from './workoutTimeParser'

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours ? `${hours} hr ${minutes} min` : `${minutes} min`
}

function formatSessionTimeRange(startedAt: string, completedAt: string | null): string {
  try {
    const start = new Date(startedAt)
    const timeFormatter = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
    const dateStr = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(start)

    if (!completedAt) {
      return `${dateStr} · started ${timeFormatter.format(start)}`
    }
    const end = new Date(completedAt)
    return `${dateStr} · ${timeFormatter.format(start)} – ${timeFormatter.format(end)}`
  } catch {
    return startedAt
  }
}

function WorkoutPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const { activeWorkoutId, status, error } = useAppSelector(
    (state) => state.workoutUi,
  )
  const [history, setHistory] = useState<WorkoutSummary[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)

  // Modal state
  const [modalState, setModalState] = useState<{
    open: boolean
    initialPrompt?: string
    initialParsedWorkout?: ParsedWorkout | null
    initialSessionName?: string
    initialDate?: string
    initialStartTime?: string
    initialEndTime?: string
  }>({ open: false })

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      setHistory(await listCompletedWorkoutSummaries())
    } catch (loadError) {
      setHistoryError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load workout history.',
      )
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(() => {
      void dispatch(loadActiveWorkoutThunk())
      void loadHistory()
    })
  }, [dispatch, loadHistory])

  const startLiveWorkout = async () => {
    try {
      const workoutId = await dispatch(startWorkoutThunk(undefined)).unwrap()
      navigate('/workouts/active', { state: { workoutId } })
    } catch {
      // The rejected thunk provides the visible error through Redux state.
    }
  }

  const handleHeroParsedReady = (data: {
    prompt: string
    parsed: ParsedWorkout
    context: ParsedWorkoutContext
  }) => {
    setModalState({
      open: true,
      initialPrompt: data.prompt,
      initialParsedWorkout: data.parsed,
      initialSessionName: data.context.sessionName,
      initialDate: data.context.date,
      initialStartTime: data.context.startTime,
      initialEndTime: data.context.endTime,
    })
  }

  const handleRepeatWorkout = async (summary: WorkoutSummary, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const details = await loadWorkoutDetails(summary.session.id)
      if (!details) return

      const lines = details.exercises.map((item) => {
        const name = item.workoutExercise.exerciseNameSnapshot
        const completedSets = item.sets.filter((s) => s.completed)
        if (completedSets.length === 0) return name
        const reps = completedSets[0].reps
        const wt = completedSets[0].weightKg
        return `${name} ${completedSets.length}x${reps} at ${wt}kg`
      })

      const repeatPrompt = `Trained today: ${details.session.name}: ${lines.join(', ')}`

      setModalState({
        open: true,
        initialPrompt: repeatPrompt,
        initialSessionName: details.session.name,
        initialDate: formatLocalDate(new Date()),
      })
    } catch {
      // ignore
    }
  }

  return (
    <PageContainer>
      {/* Top Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-sm font-medium text-accent">Training</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Workouts
          </h1>
          <p className="mt-1 text-sm text-muted">
            Track and review your post-workout sessions effortlessly.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeWorkoutId ? (
            <Button
              size="medium"
              icon={Play}
              onClick={() => navigate('/workouts/active')}
            >
              Resume Live Workout
            </Button>
          ) : (
            <Button
              size="medium"
              variant="outline"
              icon={Dumbbell}
              loading={status === 'saving'}
              disabled={status === 'loading'}
              onClick={() => void startLiveWorkout()}
            >
              Start Live Workout
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-5 rounded-xl bg-danger-soft p-4 text-sm text-danger">
          {error}
        </p>
      )}

      {activeWorkoutId && (
        <Card
          className="mb-6 border-accent/20 bg-accent-soft"
          title="Live Workout In Progress"
          description="Your active session is running and ready to continue."
          actions={
            <Button
              size="small"
              icon={ArrowRight}
              onClick={() => navigate('/workouts/active')}
            >
              Continue
            </Button>
          }
        >
          <p className="text-sm text-muted">
            Tap continue to return to your set-by-set tracker.
          </p>
        </Card>
      )}

      <div className="space-y-6">
        {/* 1. Weekly Consistency Calendar Strip */}
        <WeeklyConsistencyStrip history={history} />

        {/* 2. Hero Post-Workout Retrospective Input */}
        <PostWorkoutHeroCard onParsedReady={handleHeroParsedReady} />

        {/* 3. Recent Workouts Section */}
        <section aria-labelledby="history-title">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                Your training
              </p>
              <h2 id="history-title" className="text-xl font-semibold text-ink">
                Recent workouts
              </h2>
            </div>
            {!historyLoading && !historyError && (
              <Badge variant="default">{history.length} completed</Badge>
            )}
          </div>

          {historyLoading ? (
            <p className="py-10 text-center text-sm text-muted" role="status">
              Loading workout history…
            </p>
          ) : historyError ? (
            <div
              role="alert"
              className="rounded-xl border border-danger-soft bg-danger-soft p-4 text-sm text-danger"
            >
              <p>{historyError}</p>
              <Button
                className="mt-3"
                variant="outline"
                size="small"
                onClick={() => void loadHistory()}
              >
                Retry
              </Button>
            </div>
          ) : history.length === 0 ? (
            <Card>
              <EmptyState
                icon={Dumbbell}
                title="No completed workouts yet"
                description="Use the box above to log your first workout after the gym!"
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {history.map((summary) => (
                <WorkoutHistoryCard
                  key={summary.session.id}
                  summary={summary}
                  shouldReduceMotion={shouldReduceMotion}
                  onRepeat={handleRepeatWorkout}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Review & Edit Modal */}
      <AiLogWorkoutModal
        open={modalState.open}
        onClose={() => setModalState({ open: false })}
        onSaved={loadHistory}
        initialPrompt={modalState.initialPrompt}
        initialParsedWorkout={modalState.initialParsedWorkout}
        initialSessionName={modalState.initialSessionName}
        initialDate={modalState.initialDate}
        initialStartTime={modalState.initialStartTime}
        initialEndTime={modalState.initialEndTime}
      />
    </PageContainer>
  )
}

function WorkoutHistoryCard({
  summary,
  shouldReduceMotion,
  onRepeat,
}: {
  summary: WorkoutSummary
  shouldReduceMotion: boolean | null
  onRepeat: (summary: WorkoutSummary, e: React.MouseEvent) => void
}) {
  const { session } = summary
  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
      transition={springSmooth}
    >
      <Link
        to={`/workouts/${session.id}`}
        className="block rounded-2xl border border-line bg-panel p-4 shadow-sm shadow-ink/[0.02] transition-colors hover:border-accent/40 hover:bg-hover/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-5"
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-semibold text-ink text-base">{session.name}</h3>
            <p className="mt-1 text-xs text-muted sm:text-sm">
              {formatSessionTimeRange(session.startedAt, session.completedAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => onRepeat(summary, e)}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-muted transition hover:border-accent hover:text-accent"
              title="Repeat this workout today"
            >
              <RotateCcw className="size-3" />
              Repeat
            </button>
            <span className="text-sm font-medium text-accent">View details →</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 border-t border-line pt-3 text-xs sm:text-sm">
          <SummaryMetric label="Duration" value={formatDuration(summary.durationSeconds)} />
          <SummaryMetric label="Exercises" value={String(summary.exerciseCount)} />
          <SummaryMetric
            label="Sets"
            value={`${summary.completedSetCount}/${summary.setCount} done`}
          />
          <SummaryMetric
            label="Volume"
            value={
              summary.totalVolumeKg
                ? `${summary.totalVolumeKg.toLocaleString()} kg`
                : '—'
            }
          />
        </div>
      </Link>
    </motion.div>
  )
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted uppercase tracking-wider font-medium">{label}</p>
      <p className="mt-0.5 font-semibold text-ink truncate">{value}</p>
    </div>
  )
}

export default WorkoutPage
