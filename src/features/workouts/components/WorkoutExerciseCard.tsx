import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react'
import type { ExerciseSet } from '../types'
import type { PreviousPerformance, WorkoutExerciseDetails } from '../workoutService'
import { Button, Card, Input } from '../../../components/common'
import Sheet from '../../../components/common/Sheet'

type WorkoutExerciseCardProps = {
  details: WorkoutExerciseDetails
  position: number
  count: number
  previous?: PreviousPerformance
  saving: boolean
  onSaveNotes: (id: string, notes: string) => Promise<void>
  onMove: (id: string, direction: -1 | 1) => Promise<void>
  onAddSet: (workoutExerciseId: string) => Promise<void>
  onSaveSet: (
    id: string,
    changes: Pick<ExerciseSet, 'setNumber' | 'weightKg' | 'reps'>,
  ) => Promise<void>
  onToggleSet: (set: ExerciseSet) => Promise<void>
  onRemoveSet: (id: string) => Promise<void>
  onDirtyChange: (key: string, dirty: boolean) => void
}

function SetEditor({
  set,
  saving,
  onSave,
  onToggle,
  onRemove,
  onDirtyChange,
}: {
  set: ExerciseSet
  saving: boolean
  onSave: (
    id: string,
    changes: Pick<ExerciseSet, 'setNumber' | 'weightKg' | 'reps'>,
  ) => Promise<void>
  onToggle: (set: ExerciseSet) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onDirtyChange: (key: string, dirty: boolean) => void
}) {
  const [weight, setWeight] = useState(String(set.weightKg))
  const [reps, setReps] = useState(String(set.reps))
  const [setNumber, setSetNumber] = useState(String(set.setNumber))
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [completing, setCompleting] = useState(false)

  const save = async () => {
    const parsedWeight = Number(weight)
    const parsedReps = Number(reps)
    const parsedSetNumber = Number(setNumber)
    if (weight.trim() === '' || !Number.isFinite(parsedWeight) || parsedWeight < 0) {
      setError('Weight must be a non-negative number.')
      return
    }
    if (reps.trim() === '' || !Number.isInteger(parsedReps) || parsedReps <= 0) {
      setError('Reps must be a positive whole number.')
      return
    }
    if (
      setNumber.trim() === '' ||
      !Number.isInteger(parsedSetNumber) ||
      parsedSetNumber <= 0
    ) {
      setError('Set number must be a positive whole number.')
      return
    }
    try {
      await onSave(set.id, {
        setNumber: parsedSetNumber,
        weightKg: parsedWeight,
        reps: parsedReps,
      })
      setDirty(false)
      onDirtyChange(set.id, false)
      setError(null)
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Could not save set.',
      )
    }
  }

  const handleToggle = async () => {
    setCompleting(true)
    try {
      await onToggle(set)
    } finally {
      setCompleting(false)
    }
  }

  return (
    <div
      className={`px-3 py-3 last:pb-4 transition-colors duration-200 ${
        set.completed ? 'bg-success-soft/60' : ''
      }`}
    >
      <div className="grid grid-cols-[minmax(2.25rem,.38fr)_minmax(0,1fr)_minmax(0,1fr)_2.75rem] items-end gap-2">
        <Input
          label="Set"
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={setNumber}
          className="min-h-11 px-2 text-center tabular-nums"
          onChange={(event) => {
            setSetNumber(event.currentTarget.value)
            setDirty(true)
            onDirtyChange(set.id, true)
          }}
        />
        <Input
          label="Weight (kg)"
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={weight}
          className="min-h-11 px-2 tabular-nums"
          onChange={(event) => {
            setWeight(event.currentTarget.value)
            setDirty(true)
            onDirtyChange(set.id, true)
          }}
        />
        <Input
          label="Reps"
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={reps}
          className="min-h-11 px-2 tabular-nums"
          onChange={(event) => {
            setReps(event.currentTarget.value)
            setDirty(true)
            onDirtyChange(set.id, true)
          }}
        />
        {/* Complete toggle */}
        <button
          type="button"
          aria-label={
            set.completed
              ? `Mark set ${set.setNumber} incomplete`
              : `Complete set ${set.setNumber}`
          }
          aria-pressed={set.completed}
          disabled={saving || dirty || completing}
          onClick={() => void handleToggle()}
          className={[
            'mb-0.5 flex size-11 items-center justify-center rounded-xl border transition-all duration-200',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            'disabled:cursor-not-allowed disabled:opacity-50',
            completing ? 'animate-set-complete' : '',
            set.completed
              ? 'border-success bg-success text-surface shadow-sm'
              : 'border-line text-muted hover:border-success/50 hover:bg-success-soft hover:text-success',
          ].join(' ')}
        >
          <Check aria-hidden="true" size={17} />
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="mt-2 flex min-h-9 justify-end gap-2">
        {dirty && (
          <Button size="small" variant="secondary" disabled={saving} onClick={() => void save()}>
            Save set
          </Button>
        )}
        <Button
          size="small"
          variant="ghost"
          icon={Trash2}
          aria-label={`Remove set ${set.setNumber}`}
          disabled={saving || dirty}
          onClick={() => {
            setError(null)
            setConfirmRemove(true)
          }}
        >
          Remove
        </Button>
      </div>

      {/* Remove confirmation as a bottom sheet */}
      <Sheet
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        closeBlocked={saving}
        title={`Remove set ${set.setNumber}?`}
        footer={
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => setConfirmRemove(false)}
            >
              Keep set
            </Button>
            <Button
              variant="danger"
              loading={saving}
              disabled={saving}
              onClick={() => {
                void onRemove(set.id)
                  .then(() => {
                    setConfirmRemove(false)
                    setError(null)
                  })
                  .catch((removeError: unknown) => {
                    setError(
                      removeError instanceof Error
                        ? removeError.message
                        : 'Could not remove set. Please retry.',
                    )
                  })
              }}
            >
              Remove set
            </Button>
          </div>
        }
      >
        {error && (
          <p role="alert" className="mb-3 rounded-xl bg-danger-soft p-3 text-sm text-danger">
            {error}
          </p>
        )}
        <p className="text-sm leading-6 text-muted">
          This removes {set.weightKg} kg × {set.reps} reps from the active workout.
          The record will be soft deleted.
        </p>
      </Sheet>
    </div>
  )
}

function WorkoutExerciseCard({
  details,
  position,
  count,
  previous,
  saving,
  onSaveNotes,
  onMove,
  onAddSet,
  onSaveSet,
  onToggleSet,
  onRemoveSet,
  onDirtyChange,
}: WorkoutExerciseCardProps) {
  const { workoutExercise, sets } = details
  const [notes, setNotes] = useState(workoutExercise.notes)
  const [notesDirty, setNotesDirty] = useState(false)
  const [notesError, setNotesError] = useState<string | null>(null)

  const saveNotes = async () => {
    try {
      await onSaveNotes(workoutExercise.id, notes)
      setNotesDirty(false)
      onDirtyChange(workoutExercise.id, false)
      setNotesError(null)
    } catch (error) {
      setNotesError(error instanceof Error ? error.message : 'Could not save notes.')
    }
  }

  const completedCount = sets.filter((s) => s.completed).length

  return (
    <Card
      title={workoutExercise.exerciseNameSnapshot}
      actions={
        <div className="flex gap-1">
          <button
            type="button"
            aria-label={`Move ${workoutExercise.exerciseNameSnapshot} up`}
            disabled={position === 0 || saving}
            onClick={() => void onMove(workoutExercise.id, -1)}
            className="flex size-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40 active:scale-90"
          >
            <ArrowUp aria-hidden="true" size={16} />
          </button>
          <button
            type="button"
            aria-label={`Move ${workoutExercise.exerciseNameSnapshot} down`}
            disabled={position === count - 1 || saving}
            onClick={() => void onMove(workoutExercise.id, 1)}
            className="flex size-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40 active:scale-90"
          >
            <ArrowDown aria-hidden="true" size={16} />
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Previous performance */}
        {previous ? (
          <div className="rounded-xl bg-accent-soft px-3 py-2.5 text-xs text-ink">
            <p className="font-semibold">
              Previous ·{' '}
              {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
                new Date(previous.workout.completedAt ?? previous.workout.startedAt),
              )}
            </p>
            <p className="mt-1 leading-5 text-muted">
              {previous.sets
                .map(
                  (set) =>
                    `Set ${set.setNumber}: ${set.weightKg} kg × ${set.reps}`,
                )
                .join(' · ')}
            </p>
          </div>
        ) : (
          <p className="border-l-2 border-line py-2 pl-3 text-xs text-muted">
            No previous performance yet.
          </p>
        )}

        {/* Sets header */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-ink">Sets</h3>
            {sets.length > 0 && (
              <p className="text-xs text-muted">
                {completedCount}/{sets.length} completed
              </p>
            )}
          </div>
          <Button
            size="small"
            variant="outline"
            icon={Plus}
            disabled={saving}
            onClick={() => void onAddSet(workoutExercise.id)}
          >
            Add set
          </Button>
        </div>

        {/* Set rows */}
        {sets.length ? (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {sets.map((set) => (
              <SetEditor
                key={set.id}
                set={set}
                saving={saving}
                onSave={onSaveSet}
                onToggle={onToggleSet}
                onRemove={onRemoveSet}
                onDirtyChange={onDirtyChange}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No sets yet. Add your first set.</p>
        )}

        {/* Exercise notes */}
        <div className="space-y-2 border-t border-line pt-4">
          <label
            htmlFor={`exercise-notes-${workoutExercise.id}`}
            className="text-sm font-medium text-ink"
          >
            Exercise notes
          </label>
          <textarea
            id={`exercise-notes-${workoutExercise.id}`}
            value={notes}
            maxLength={2000}
            onChange={(event) => {
              setNotes(event.currentTarget.value)
              setNotesDirty(true)
              onDirtyChange(workoutExercise.id, true)
            }}
            rows={2}
            className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          />
          {notesError && (
            <p role="alert" className="text-xs text-danger">
              {notesError}
            </p>
          )}
          {notesDirty && (
            <div className="flex justify-end">
              <Button size="small" variant="secondary" disabled={saving} onClick={() => void saveNotes()}>
                Save notes
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

export default WorkoutExerciseCard
