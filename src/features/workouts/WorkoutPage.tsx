import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Dumbbell, Play } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { Badge, Button, Card, EmptyState } from '../../components/common'
import PageContainer from '../../components/layout/PageContainer'
import {
  loadActiveWorkoutThunk,
  startWorkoutThunk,
} from './workoutThunks'
import {
  listCompletedWorkoutSummaries,
  type WorkoutSummary,
} from './workoutService'

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours ? `${hours} hr ${minutes} min` : `${minutes} min`
}

function WorkoutPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { activeWorkoutId, status, error } = useAppSelector(
    (state) => state.workoutUi,
  )
  const [history, setHistory] = useState<WorkoutSummary[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)

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

  const start = async () => {
    try {
      const workoutId = await dispatch(startWorkoutThunk(undefined)).unwrap()
      navigate('/workouts/active', { state: { workoutId } })
    } catch {
      // The rejected thunk provides the visible error through Redux state.
    }
  }

  return (
    <PageContainer>
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm font-medium text-accent">Training</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Workouts
          </h1>
          <p className="mt-2 text-sm text-muted">
            Start a session or review your completed training.
          </p>
        </div>
        {activeWorkoutId ? (
          <Button
            size="large"
            icon={Play}
            onClick={() => navigate('/workouts/active')}
          >
            Resume workout
          </Button>
        ) : (
          <Button
            size="large"
            icon={Dumbbell}
            loading={status === 'saving'}
            disabled={status === 'loading'}
            onClick={() => void start()}
          >
            Start Workout
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {activeWorkoutId && (
        <Card
          className="mb-8 border-accent/20 bg-accent-soft"
          title="Workout in progress"
          description="Your session is saved locally and ready to continue."
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
            In-progress workout recovered from your local database.
          </p>
        </Card>
      )}

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
          <Badge variant="default">{history.length} completed</Badge>
        </div>
        {historyLoading ? (
          <p className="py-10 text-center text-sm text-muted" role="status">
            Loading workout history…
          </p>
        ) : historyError ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
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
              description="Your workout history will appear here after you finish a session."
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {history.map((summary) => (
              <WorkoutHistoryCard key={summary.session.id} summary={summary} />
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  )
}

function WorkoutHistoryCard({ summary }: { summary: WorkoutSummary }) {
  const { session } = summary
  return (
    <Link
      to={`/workouts/${session.id}`}
      className="block rounded-2xl border border-line bg-panel p-4 shadow-sm shadow-ink/[0.02] transition-colors hover:border-accent/30 hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-5"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-semibold text-ink">{session.name}</h3>
          <p className="mt-1 text-sm text-muted">
            {new Intl.DateTimeFormat(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(session.startedAt))}
          </p>
        </div>
        <span className="text-sm font-medium text-accent">View details →</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs sm:max-w-md sm:text-sm">
        <SummaryMetric label="Duration" value={formatDuration(summary.durationSeconds)} />
        <SummaryMetric label="Exercises" value={String(summary.exerciseCount)} />
        <SummaryMetric
          label="Sets"
          value={`${summary.completedSetCount}/${summary.setCount} done`}
        />
      </div>
    </Link>
  )
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted">{label}</p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  )
}

export default WorkoutPage
