import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Clock3 } from 'lucide-react'
import { Badge, Button, Card, EmptyState } from '../../components/common'
import PageContainer from '../../components/layout/PageContainer'
import type { WorkoutDetails } from './workoutService'
import { loadWorkoutDetails } from './workoutService'

function WorkoutDetailsPage() {
  const { workoutId } = useParams<{ workoutId: string }>()
  const [details, setDetails] = useState<WorkoutDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!workoutId) {
      setError('A workout ID is required.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await loadWorkoutDetails(workoutId)
      if (!result) {
        setError('This workout could not be found.')
        setDetails(null)
      } else {
        setDetails(result)
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load workout details.',
      )
    } finally {
      setLoading(false)
    }
  }, [workoutId])

  useEffect(() => {
    void Promise.resolve().then(() => load())
  }, [load])

  if (loading) {
    return (
      <PageContainer>
        <p role="status" className="py-16 text-center text-sm text-muted">
          Loading workout…
        </p>
      </PageContainer>
    )
  }

  if (!details) {
    return (
      <PageContainer>
        <Card>
          <EmptyState
            title="Workout unavailable"
            description={error ?? 'This workout could not be found.'}
            action={
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => void load()}>
                  Retry
                </Button>
                <Link
                  to="/workouts"
                  className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent"
                >
                  Workout history
                </Link>
              </div>
            }
          />
        </Card>
      </PageContainer>
    )
  }

  const { session, exercises } = details
  const allSets = exercises.flatMap((exercise) => exercise.sets)
  const completedSets = allSets.filter((set) => set.completed).length
  const durationSeconds =
    session.completedAt === null
      ? null
      : Math.max(
          0,
          Math.floor(
            (Date.parse(session.completedAt) - Date.parse(session.startedAt)) /
              1000,
          ),
        )

  return (
    <PageContainer>
      <Link
        to="/workouts"
        className="mb-5 inline-flex items-center gap-2 rounded-md text-sm font-medium text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <ArrowLeft aria-hidden="true" size={16} />
        Workout history
      </Link>
      <div className="mb-7">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Badge variant={session.status === 'completed' ? 'success' : 'warning'}>
            {session.status === 'completed' ? 'Completed' : 'In progress'}
          </Badge>
          <span className="text-sm text-muted">
            {new Intl.DateTimeFormat(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(session.startedAt))}
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {session.name}
        </h1>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          {durationSeconds !== null && (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 aria-hidden="true" size={16} />
              {formatDuration(durationSeconds)}
            </span>
          )}
          <span>{exercises.length} exercises</span>
          <span>
            {completedSets}/{allSets.length} sets completed
          </span>
        </div>
      </div>

      <Card title="Workout notes" className="mb-6">
        <p className="whitespace-pre-wrap text-sm leading-6 text-muted">
          {session.notes || 'No workout notes.'}
        </p>
      </Card>

      <section aria-labelledby="workout-details-exercises">
        <h2
          id="workout-details-exercises"
          className="mb-4 text-xl font-semibold text-ink"
        >
          Exercises
        </h2>
        {exercises.length === 0 ? (
          <Card>
            <EmptyState
              icon={Check}
              title="No exercises recorded"
              description="This workout was saved without any exercises."
            />
          </Card>
        ) : (
          <ol className="space-y-4">
            {exercises.map(({ workoutExercise, sets }) => (
              <li key={workoutExercise.id}>
                <Card title={workoutExercise.exerciseNameSnapshot}>
                  <div className="space-y-4">
                    <p className="whitespace-pre-wrap text-sm text-muted">
                      {workoutExercise.notes || 'No exercise notes.'}
                    </p>
                    {sets.length === 0 ? (
                      <p className="text-sm text-muted">No sets recorded.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[360px] border-collapse text-left text-sm">
                          <thead>
                            <tr className="border-b border-line text-xs text-muted">
                              <th scope="col" className="py-2 pr-3 font-medium">
                                Set
                              </th>
                              <th scope="col" className="py-2 pr-3 font-medium">
                                Weight
                              </th>
                              <th scope="col" className="py-2 pr-3 font-medium">
                                Reps
                              </th>
                              <th scope="col" className="py-2 font-medium">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sets.map((set) => (
                              <tr key={set.id} className="border-b border-line last:border-0">
                                <td className="py-2.5 pr-3 text-ink">
                                  {set.setNumber}
                                </td>
                                <td className="py-2.5 pr-3 text-ink">
                                  {set.weightKg} kg
                                </td>
                                <td className="py-2.5 pr-3 text-ink">
                                  {set.reps}
                                </td>
                                <td className="py-2.5">
                                  <Badge
                                    variant={set.completed ? 'success' : 'default'}
                                  >
                                    {set.completed ? 'Completed' : 'Incomplete'}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>
    </PageContainer>
  )
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours ? `${hours} hr ${minutes} min` : `${minutes} min`
}

export default WorkoutDetailsPage
