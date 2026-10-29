import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'
import { Check, Clock3, Flag, Plus, RotateCcw } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { Badge, Button, Card, EmptyState, Input, Modal } from '../../components/common'
import Sheet from '../../components/common/Sheet'
import PageContainer from '../../components/layout/PageContainer'
import type { Exercise, ExerciseSet } from './types'
import ExercisePickerModal from './components/ExercisePickerModal'
import WorkoutExerciseCard from './components/WorkoutExerciseCard'
import {
  addExerciseToWorkout,
  createAndAddCustomExercise,
  createSet,
  deleteWorkoutSet,
  getPreviousPerformance,
  loadWorkoutDetails,
  moveWorkoutExercise,
  saveExerciseNotes,
  saveSet,
  saveWorkoutName,
  saveWorkoutNotes,
  type PreviousPerformance,
  type WorkoutDetails,
} from './workoutService'
import {
  finishWorkoutThunk,
  loadActiveWorkoutThunk,
} from './workoutThunks'

function formatElapsed(startedAt: string, now: number): string {
  const totalSeconds = Math.max(
    0,
    Math.floor((now - Date.parse(startedAt)) / 1000),
  )
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds]
    .map((unit) => String(unit).padStart(2, '0'))
    .join(':')
}

function ActiveWorkoutPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const reduxError = useAppSelector((state) => state.workoutUi.error)
  const [details, setDetails] = useState<WorkoutDetails | null>(null)
  const [previousPerformance, setPreviousPerformance] = useState<
    Record<string, PreviousPerformance | undefined>
  >({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [pendingEdits, setPendingEdits] = useState<string[]>([])
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [nameDirty, setNameDirty] = useState(false)
  const [notesDirty, setNotesDirty] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [now, setNow] = useState(0)
  const hasUnsavedChanges =
    nameDirty || notesDirty || pendingEdits.length > 0
  const blocker = useBlocker(hasUnsavedChanges)
  const keepEditing = () => {
    if (blocker.state === 'blocked') blocker.reset()
  }
  const discardAndLeave = () => {
    if (blocker.state === 'blocked') blocker.proceed()
  }

  const refresh = useCallback(async (workoutId: string) => {
    const nextDetails = await loadWorkoutDetails(workoutId)
    if (!nextDetails || nextDetails.session.status !== 'in_progress') {
      return false
    }
    setDetails(nextDetails)
    setName((current) => (nameDirty ? current : nextDetails.session.name))
    setNotes((current) => (notesDirty ? current : nextDetails.session.notes))
    return true
  }, [nameDirty, notesDirty])

  useEffect(() => {
    let cancelled = false
    void Promise.resolve()
      .then(() => {
        if (cancelled) return undefined
        setLoading(true)
        return dispatch(loadActiveWorkoutThunk()).unwrap()
      })
      .then(async (workoutId) => {
        if (cancelled || !workoutId) {
          if (!cancelled) navigate('/workouts', { replace: true })
          return
        }
        const found = await loadWorkoutDetails(workoutId)
        if (cancelled) return
        if (!found || found.session.status !== 'in_progress') {
          navigate('/workouts', { replace: true })
          return
        }
        setDetails(found)
        setName(found.session.name)
        setNotes(found.session.notes)
        setError(null)
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not restore the active workout.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [dispatch, navigate])

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!hasUnsavedChanges) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [hasUnsavedChanges])

  useEffect(() => {
    if (!details) return
    let cancelled = false
    void Promise.all(
      details.exercises.map(async ({ workoutExercise }) => [
        workoutExercise.id,
        await getPreviousPerformance(
          workoutExercise.exerciseId,
          details.session.id,
        ),
      ] as const),
    )
      .then((results) => {
        if (!cancelled) setPreviousPerformance(Object.fromEntries(results))
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load previous performance.',
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [details])

  const runSave = async (
    operation: () => Promise<unknown>,
    message = 'Changes saved.',
    reload = true,
  ): Promise<boolean> => {
    if (!details || saving) return false
    setSaving(true)
    setError(null)
    setSavedMessage(null)
    try {
      await operation()
      if (reload) {
        const loaded = await refresh(details.session.id)
        if (!loaded) throw new Error('The active workout is no longer available.')
      }
      setSavedMessage(message)
      return true
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save your changes. Please retry.',
      )
      return false
    } finally {
      setSaving(false)
    }
  }

  const runSaveOrThrow = async (
    operation: () => Promise<unknown>,
    message: string,
  ) => {
    if (!(await runSave(operation, message))) {
      throw new Error('Save failed. Your edits are still available to retry.')
    }
  }

  const markPendingEdit = (key: string, dirty: boolean) => {
    setPendingEdits((current) =>
      dirty
        ? current.includes(key)
          ? current
          : [...current, key]
        : current.filter((item) => item !== key),
    )
  }

  const addExercise = async (exercise: Exercise) => {
    if (!details) return
    const succeeded = await runSave(
      () => addExerciseToWorkout(details.session.id, exercise.id),
      `${exercise.name} added.`,
    )
    if (!succeeded) throw new Error('Could not add this exercise. Please retry.')
  }

  const createAndAddExercise = async (input: {
    name: string
    category: Exercise['category']
    equipment: string | null
  }) => {
    if (!details) throw new Error('The active workout is unavailable.')
    const succeeded = await runSave(
      () =>
        createAndAddCustomExercise(
          details.session.id,
          input,
        ),
      'Custom exercise created and added.',
    )
    if (!succeeded) {
      throw new Error('Could not create and add the exercise. Please retry.')
    }
  }

  const addSet = async (workoutExerciseId: string) => {
    const existingSets =
      details?.exercises.find(
        (item) => item.workoutExercise.id === workoutExerciseId,
      )?.sets ?? []
    const setNumber =
      Math.max(0, ...existingSets.map((set) => set.setNumber)) + 1
    await runSave(
      () =>
        createSet({
          workoutExerciseId,
          setNumber,
          weightKg: 0,
          reps: 1,
          completed: false,
        }),
      'Set added.',
    )
  }

  const toggleSet = async (set: ExerciseSet) => {
    await runSave(
      () => saveSet(set.id, { completed: !set.completed }),
      set.completed ? 'Set marked incomplete.' : 'Set completed.',
    )
  }

  const removeSet = async (setId: string) => {
    const succeeded = await runSave(() => deleteWorkoutSet(setId), 'Set removed.')
    if (!succeeded) throw new Error('Could not remove set. Please retry.')
  }

  const saveName = async () => {
    if (!details) return
    const succeeded = await runSave(
      () => saveWorkoutName(details.session.id, name),
      'Workout name saved.',
    )
    if (succeeded) setNameDirty(false)
  }

  const saveNotes = async () => {
    if (!details) return
    const succeeded = await runSave(
      () => saveWorkoutNotes(details.session.id, notes),
      'Workout notes saved.',
    )
    if (succeeded) setNotesDirty(false)
  }

  const finish = async () => {
    if (!details || saving) return
    setSaving(true)
    try {
      const id = await dispatch(finishWorkoutThunk(details.session.id)).unwrap()
      setFinishOpen(false)
      navigate(`/workouts/${id}`)
    } catch (finishError) {
      setError(
        finishError instanceof Error
          ? finishError.message
          : 'Could not finish workout. Please retry.',
      )
    } finally {
      setSaving(false)
    }
  }

  const totals = useMemo(() => {
    const sets = details?.exercises.flatMap((item) => item.sets) ?? []
    return {
      totalSets: sets.length,
      completedSets: sets.filter((set) => set.completed).length,
    }
  }, [details])

  if (loading) {
    return (
      <PageContainer>
        <p role="status" className="py-16 text-center text-sm text-muted">
          Restoring your workout…
        </p>
      </PageContainer>
    )
  }

  if (!details) {
    return (
      <PageContainer>
        <div role="alert" className="rounded-2xl border border-danger-soft bg-danger-soft p-5 text-sm text-danger">
          <p>{error ?? reduxError ?? 'Could not load the active workout.'}</p>
          <Button className="mt-3" variant="outline" onClick={() => navigate('/workouts')}>
            Back to workouts
          </Button>
        </div>
      </PageContainer>
    )
  }

  const hasPendingChanges = nameDirty || notesDirty || pendingEdits.length > 0

  return (
    <PageContainer>
      {/* ── Workout header ──────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          {/* Status + timer row */}
          <div className="mb-3 flex items-center gap-2.5">
            <Badge variant="success">In progress</Badge>
            <span className="inline-flex items-center gap-1.5 text-sm tabular-nums text-muted">
              <Clock3 aria-hidden="true" size={15} />
              <time>{formatElapsed(details.session.startedAt, now)}</time>
            </span>
            {saving && (
              <span className="text-xs text-muted animate-pulse">Saving…</span>
            )}
          </div>

          {/* Workout name */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Input
              label="Workout name"
              value={name}
              maxLength={100}
              onChange={(event) => {
                setName(event.currentTarget.value)
                setNameDirty(true)
              }}
              wrapperClassName="max-w-sm"
            />
            {nameDirty && (
              <Button variant="secondary" size="small" disabled={saving} onClick={() => void saveName()}>
                Save name
              </Button>
            )}
          </div>
        </div>

        {/* Finish button */}
        <Button
          size="large"
          variant="outline"
          icon={Flag}
          disabled={saving}
          onClick={() => setFinishOpen(true)}
        >
          Finish Workout
        </Button>
      </div>

      {/* ── Inline alerts ───────────────────────────────── */}
      {error && (
        <div
          role="alert"
          className="mb-5 flex flex-col justify-between gap-3 rounded-2xl border border-danger-soft bg-danger-soft p-4 text-sm text-danger sm:flex-row sm:items-center"
        >
          <p>{error}</p>
          <Button
            size="small"
            variant="outline"
            icon={RotateCcw}
            onClick={() => {
              setError(null)
              void refresh(details.session.id).catch((retryError: unknown) =>
                setError(
                  retryError instanceof Error
                    ? retryError.message
                    : 'Retry failed.',
                ),
              )
            }}
          >
            Retry
          </Button>
        </div>
      )}

      {savedMessage && (
        <p role="status" className="mb-4 animate-toast-in text-sm text-success">
          {savedMessage}
        </p>
      )}

      {/* ── Workout notes ───────────────────────────────── */}
      <Card
        className="mb-6"
        title="Workout notes"
        description="Notes are saved when you choose Save notes."
      >
        <textarea
          aria-label="Workout notes"
          value={notes}
          maxLength={4000}
          rows={3}
          onChange={(event) => {
            setNotes(event.currentTarget.value)
            setNotesDirty(true)
          }}
          className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        />
        {notesDirty && (
          <div className="mt-3 flex justify-end">
            <Button variant="secondary" disabled={saving} onClick={() => void saveNotes()}>
              Save notes
            </Button>
          </div>
        )}
      </Card>

      {/* ── Exercise list ───────────────────────────────── */}
      <section aria-labelledby="exercise-list-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="exercise-list-title" className="text-xl font-semibold text-ink">
              Exercises
            </h2>
            <p className="mt-1 text-sm text-muted">
              {details.exercises.length} exercise
              {details.exercises.length === 1 ? '' : 's'} · {totals.completedSets}/
              {totals.totalSets} sets completed
            </p>
          </div>
          <Button
            size="large"
            icon={Plus}
            disabled={saving}
            onClick={() => setPickerOpen(true)}
          >
            Add Exercise
          </Button>
        </div>

        {details.exercises.length === 0 ? (
          <Card>
            <EmptyState
              icon={Plus}
              title="Add your first exercise"
              description="Search the exercise library or create a custom exercise for this session."
              action={
                <Button onClick={() => setPickerOpen(true)}>
                  Add Exercise
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {details.exercises.map((item, index) => (
              <WorkoutExerciseCard
                key={item.workoutExercise.id}
                details={item}
                position={index}
                count={details.exercises.length}
                previous={previousPerformance[item.workoutExercise.id]}
                saving={saving}
                onSaveNotes={async (id, value) => {
                  await runSaveOrThrow(
                    () => saveExerciseNotes(id, value),
                    'Exercise notes saved.',
                  )
                }}
                onMove={async (id, direction) => {
                  await runSave(
                    () => moveWorkoutExercise(details.session.id, id, direction),
                    'Exercise order saved.',
                  )
                }}
                onAddSet={addSet}
                onSaveSet={async (id, changes) => {
                  await runSaveOrThrow(() => saveSet(id, changes), 'Set saved.')
                }}
                onToggleSet={toggleSet}
                onRemoveSet={removeSet}
                onDirtyChange={markPendingEdit}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Exercise picker sheet ───────────────────────── */}
      <ExercisePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        existingExerciseIds={details.exercises.map(
          (item) => item.workoutExercise.exerciseId,
        )}
        onAdd={addExercise}
        onCreateAndAdd={createAndAddExercise}
      />

      {/* ── Finish workout sheet ─────────────────────────── */}
      <Sheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        closeBlocked={saving}
        title="Finish this workout?"
        footer={
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => setFinishOpen(false)}
            >
              Keep working out
            </Button>
            <Button
              icon={Check}
              loading={saving}
              disabled={hasPendingChanges}
              onClick={() => void finish()}
            >
              Finish workout
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">
            The workout will be saved to your history. Incomplete sets are allowed.
          </p>
          {hasPendingChanges && (
            <p role="alert" className="rounded-xl bg-warning-soft p-3 text-sm text-warning">
              Save your pending name, notes, or set edits before finishing.
            </p>
          )}
          <dl className="divide-y divide-line rounded-2xl border border-line">
            <SummaryRow label="Workout" value={name || details.session.name} />
            <SummaryRow
              label="Exercises"
              value={String(details.exercises.length)}
            />
            <SummaryRow label="Completed sets" value={String(totals.completedSets)} />
            <SummaryRow label="Total sets" value={String(totals.totalSets)} />
          </dl>
        </div>
      </Sheet>

      {/* ── Unsaved changes blocker — keep as Modal (it's a navigation blocker) */}
      <Modal
        open={blocker.state === 'blocked'}
        onClose={keepEditing}
        title="Unsaved workout changes"
        footer={
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button variant="ghost" onClick={keepEditing}>
              Keep editing
            </Button>
            <Button variant="danger" onClick={discardAndLeave}>
              Leave without saving
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-6 text-muted">
          You have edits that have not been saved. Save them before leaving, or
          confirm that you want to discard them.
        </p>
      </Modal>
    </PageContainer>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 px-4 py-2.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  )
}

export default ActiveWorkoutPage
