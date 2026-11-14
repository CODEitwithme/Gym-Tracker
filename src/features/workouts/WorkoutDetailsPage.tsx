import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Clock3,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useUserPreferences } from '../../app/useUserPreferences'
import { Badge, Button, Card, EmptyState, Input, Modal } from '../../components/common'
import PageContainer from '../../components/layout/PageContainer'
import { formatLocalDate } from '../../lib/dateTime'
import type { ExerciseSet } from './types'
import type { WorkoutDetails } from './workoutService'
import {
  createSet,
  deleteWorkoutSession,
  deleteWorkoutSet,
  loadWorkoutDetails,
  saveExerciseNotes,
  saveSet,
  updateWorkoutSessionMetadata,
} from './workoutService'

function extractDateAndTime(isoString: string): { date: string; time: string } {
  try {
    const d = new Date(isoString)
    const date = formatLocalDate(d)
    const hours = String(d.getHours()).padStart(2, '0')
    const mins = String(d.getMinutes()).padStart(2, '0')
    return { date, time: `${hours}:${mins}` }
  } catch {
    return { date: formatLocalDate(new Date()), time: '10:00' }
  }
}

function EditableSetRow({
  set,
  unit,
  onSave,
  onDelete,
}: {
  set: ExerciseSet
  unit: 'kg' | 'lb'
  onSave: (updates: { weightKg?: number; reps?: number; completed?: boolean }) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [weight, setWeight] = useState(() =>
    unit === 'lb'
      ? String(Number((set.weightKg * 2.20462262185).toFixed(1)))
      : String(set.weightKg),
  )
  const [reps, setReps] = useState(String(set.reps))
  const [completed, setCompleted] = useState(set.completed)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setWeight(
      unit === 'lb'
        ? String(Number((set.weightKg * 2.20462262185).toFixed(1)))
        : String(set.weightKg),
    )
    setReps(String(set.reps))
    setCompleted(set.completed)
  }, [set.weightKg, set.reps, set.completed, unit])

  const handleBlurOrSave = async () => {
    if (!dirty) return
    const parsedWeight = parseFloat(weight)
    const parsedReps = parseInt(reps, 10)
    if (isNaN(parsedWeight) || parsedWeight < 0 || isNaN(parsedReps) || parsedReps <= 0) {
      return
    }
    const finalKg = unit === 'lb' ? parsedWeight / 2.20462262185 : parsedWeight
    await onSave({
      weightKg: Number(finalKg.toFixed(2)),
      reps: parsedReps,
      completed,
    })
    setDirty(false)
  }

  const handleToggleCompleted = async () => {
    const next = !completed
    setCompleted(next)
    await onSave({ completed: next })
  }

  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-2.5 pr-3 text-ink font-medium">#{set.setNumber}</td>
      <td className="py-2.5 pr-3">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            step={unit === 'lb' ? '0.5' : '0.25'}
            min="0"
            value={weight}
            onChange={(e) => {
              setWeight(e.target.value)
              setDirty(true)
            }}
            onBlur={() => void handleBlurOrSave()}
            className="w-20 rounded border border-line bg-panel px-2 py-1 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
          />
          <span className="text-xs text-muted">{unit}</span>
        </div>
      </td>
      <td className="py-2.5 pr-3">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            step="1"
            min="1"
            value={reps}
            onChange={(e) => {
              setReps(e.target.value)
              setDirty(true)
            }}
            onBlur={() => void handleBlurOrSave()}
            className="w-16 rounded border border-line bg-panel px-2 py-1 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
          />
          <span className="text-xs text-muted">reps</span>
        </div>
      </td>
      <td className="py-2.5 pr-3">
        <button
          type="button"
          onClick={() => void handleToggleCompleted()}
          className="cursor-pointer"
        >
          <Badge variant={completed ? 'success' : 'default'}>
            {completed ? 'Completed' : 'Incomplete'}
          </Badge>
        </button>
      </td>
      <td className="py-2.5 text-right">
        <button
          type="button"
          onClick={() => void onDelete()}
          aria-label={`Delete set ${set.setNumber}`}
          className="rounded p-1 text-muted hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  )
}

function WorkoutDetailsPage() {
  const { workoutId } = useParams<{ workoutId: string }>()
  const navigate = useNavigate()
  const [preferences] = useUserPreferences()
  const unit = preferences.weightUnit

  const [details, setDetails] = useState<WorkoutDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Edit Workout Details modal state
  const [editSessionOpen, setEditSessionOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [savingDetails, setSavingDetails] = useState(false)

  // Edit Sets mode
  const [editingSets, setEditingSets] = useState(false)

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

  const openEditModal = () => {
    if (!details) return
    const { session } = details
    setEditName(session.name)
    setEditNotes(session.notes || '')
    const start = extractDateAndTime(session.startedAt)
    setEditDate(start.date)
    setEditStartTime(start.time)
    if (session.completedAt) {
      const end = extractDateAndTime(session.completedAt)
      setEditEndTime(end.time)
    } else {
      setEditEndTime('18:00')
    }
    setEditSessionOpen(true)
  }

  const handleSaveDetails = async () => {
    if (!details || savingDetails) return
    setSavingDetails(true)
    try {
      const [startH, startM] = editStartTime.split(':').map(Number)
      const [endH, endM] = editEndTime.split(':').map(Number)
      const [year, month, day] = editDate.split('-').map(Number)

      const startDate = new Date(year, month - 1, day, startH || 0, startM || 0, 0, 0)
      let endDate: Date | null = null
      if (editEndTime) {
        endDate = new Date(year, month - 1, day, endH || 0, endM || 0, 0, 0)
        if (endDate.getTime() <= startDate.getTime()) {
          endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
        }
      }

      await updateWorkoutSessionMetadata(details.session.id, {
        name: editName.trim() || 'Workout',
        notes: editNotes.trim(),
        startedAt: startDate.toISOString(),
        completedAt: endDate ? endDate.toISOString() : null,
      })
      await load()
      setEditSessionOpen(false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update workout details.',
      )
    } finally {
      setSavingDetails(false)
    }
  }

  const handleDelete = async () => {
    if (!details || deleting) return
    setDeleting(true)
    try {
      await deleteWorkoutSession(details.session.id)
      setDeleteOpen(false)
      navigate('/workouts')
    } catch (delError) {
      setError(
        delError instanceof Error
          ? delError.message
          : 'Could not delete workout. Please retry.',
      )
    } finally {
      setDeleting(false)
    }
  }

  const handleAddSet = async (workoutExerciseId: string, currentSets: ExerciseSet[]) => {
    const lastSet = currentSets[currentSets.length - 1]
    const nextSetNumber = currentSets.length + 1
    const defaultWeight = lastSet ? lastSet.weightKg : 0
    const defaultReps = lastSet ? lastSet.reps : 10
    await createSet({
      workoutExerciseId,
      setNumber: nextSetNumber,
      weightKg: defaultWeight,
      reps: defaultReps,
      completed: true,
    })
    await load()
  }

  const handleDeleteSet = async (setId: string) => {
    await deleteWorkoutSet(setId)
    await load()
  }

  const handleUpdateSet = async (
    setId: string,
    updates: { weightKg?: number; reps?: number; completed?: boolean },
  ) => {
    await saveSet(setId, updates)
    await load()
  }

  const handleSaveExerciseNotes = async (workoutExerciseId: string, notes: string) => {
    await saveExerciseNotes(workoutExerciseId, notes)
    await load()
  }

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
      <div className="w-full">
        <Link
          to="/workouts"
          className="mb-5 inline-flex items-center gap-2 rounded-md text-sm font-medium text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Workout history
        </Link>
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between lg:mb-8 lg:pb-6 lg:border-b lg:border-line">
          <div>
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
            <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl lg:text-5xl">
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="small"
              icon={Pencil}
              onClick={openEditModal}
            >
              Edit Details
            </Button>
            <Button
              variant={editingSets ? 'primary' : 'outline'}
              size="small"
              icon={editingSets ? CheckCheck : Pencil}
              onClick={() => setEditingSets(!editingSets)}
            >
              {editingSets ? 'Done Editing' : 'Edit Sets'}
            </Button>
            <Button
              variant="ghost"
              size="small"
              icon={Trash2}
              className="text-danger hover:bg-danger-soft hover:text-danger"
              disabled={deleting}
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
          </div>
        </div>

        <Card title="Workout notes" className="mb-6">
          <p className="whitespace-pre-wrap text-sm leading-6 text-muted">
            {session.notes || 'No workout notes.'}
          </p>
        </Card>

        <section aria-labelledby="workout-details-exercises">
          <div className="mb-4 flex items-center justify-between">
            <h2
              id="workout-details-exercises"
              className="text-xl font-semibold text-ink lg:text-2xl"
            >
              Exercises
            </h2>
            {editingSets && (
              <span className="text-xs text-accent font-medium">
                Edit mode active — changes save automatically
              </span>
            )}
          </div>
          {exercises.length === 0 ? (
            <Card>
              <EmptyState
                icon={Check}
                title="No exercises recorded"
                description="This workout was saved without any exercises."
              />
            </Card>
          ) : (
            <ol className="space-y-4 lg:space-y-5">
              {exercises.map(({ workoutExercise, sets }) => (
                <li key={workoutExercise.id}>
                  <Card title={workoutExercise.exerciseNameSnapshot}>
                    <div className="space-y-4">
                      {editingSets ? (
                        <div>
                          <label className="text-xs font-medium text-muted block mb-1">
                            Exercise Notes
                          </label>
                          <input
                            type="text"
                            defaultValue={workoutExercise.notes || ''}
                            onBlur={(e) =>
                              void handleSaveExerciseNotes(
                                workoutExercise.id,
                                e.target.value.trim(),
                              )
                            }
                            placeholder="Add notes for this exercise…"
                            className="w-full rounded border border-line bg-panel px-3 py-1.5 text-sm text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-accent"
                          />
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm text-muted">
                          {workoutExercise.notes || 'No exercise notes.'}
                        </p>
                      )}

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
                                  Weight ({unit})
                                </th>
                                <th scope="col" className="py-2 pr-3 font-medium">
                                  Reps
                                </th>
                                <th scope="col" className="py-2 font-medium">
                                  Status
                                </th>
                                {editingSets && (
                                  <th scope="col" className="py-2 text-right font-medium">
                                    Action
                                  </th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {sets.map((set) =>
                                editingSets ? (
                                  <EditableSetRow
                                    key={set.id}
                                    set={set}
                                    unit={unit}
                                    onSave={(updates) => handleUpdateSet(set.id, updates)}
                                    onDelete={() => handleDeleteSet(set.id)}
                                  />
                                ) : (
                                  <tr key={set.id} className="border-b border-line last:border-0">
                                    <td className="py-2.5 pr-3 text-ink font-medium">
                                      #{set.setNumber}
                                    </td>
                                    <td className="py-2.5 pr-3 text-ink">
                                      {unit === 'lb'
                                        ? `${Number((set.weightKg * 2.20462262185).toFixed(1))} lb`
                                        : `${set.weightKg} kg`}
                                    </td>
                                    <td className="py-2.5 pr-3 text-ink">
                                      {set.reps} reps
                                    </td>
                                    <td className="py-2.5">
                                      <Badge
                                        variant={set.completed ? 'success' : 'default'}
                                      >
                                        {set.completed ? 'Completed' : 'Incomplete'}
                                      </Badge>
                                    </td>
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {editingSets && (
                        <div className="pt-2">
                          <Button
                            variant="outline"
                            size="small"
                            icon={Plus}
                            onClick={() => void handleAddSet(workoutExercise.id, sets)}
                          >
                            Add Set
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* ── Edit Workout Details Modal ─────────────────── */}
        <Modal
          open={editSessionOpen}
          onClose={() => !savingDetails && setEditSessionOpen(false)}
          title="Edit Workout Details"
          footer={
            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button
                variant="ghost"
                disabled={savingDetails}
                onClick={() => setEditSessionOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={savingDetails}
                disabled={savingDetails || !editName.trim()}
                onClick={() => void handleSaveDetails()}
              >
                Save Details
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Input
              label="Session Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="e.g. Chest & Triceps"
              required
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                label="Date"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                required
              />
              <Input
                label="Start Time"
                type="time"
                value={editStartTime}
                onChange={(e) => setEditStartTime(e.target.value)}
                required
              />
              <Input
                label="End Time"
                type="time"
                value={editEndTime}
                onChange={(e) => setEditEndTime(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-workout-notes" className="text-sm font-medium text-ink">
                Workout Notes
              </label>
              <textarea
                id="edit-workout-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                placeholder="How did the session feel? Any PRs or injuries?"
                className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-accent"
              />
            </div>
          </div>
        </Modal>

        {/* ── Delete workout confirmation modal ─────────── */}
        <Modal
          open={deleteOpen}
          onClose={() => !deleting && setDeleteOpen(false)}
          title="Delete workout?"
          footer={
            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button
                variant="ghost"
                disabled={deleting}
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                icon={Trash2}
                loading={deleting}
                disabled={deleting}
                onClick={() => void handleDelete()}
              >
                Delete workout
              </Button>
            </div>
          }
        >
          <p className="text-sm leading-6 text-muted">
            Are you sure you want to delete &ldquo;{session.name}&rdquo; from your history?
            This action cannot be undone.
          </p>
        </Modal>
      </div>
    </PageContainer>
  )
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours ? `${hours} hr ${minutes} min` : `${minutes} min`
}

export default WorkoutDetailsPage
