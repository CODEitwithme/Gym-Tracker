import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react'
import type { ExerciseSet } from '../types'
import type { PreviousPerformance, WorkoutExerciseDetails } from '../workoutService'
import { Button, Card, Input, Modal } from '../../../components/common'

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

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <Input
            label="Set number"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={setNumber}
            wrapperClassName="w-28"
            onChange={(event) => {
              setSetNumber(event.currentTarget.value)
              setDirty(true)
              onDirtyChange(set.id, true)
            }}
          />
          <button
            type="button"
            aria-label={set.completed ? `Mark set ${set.setNumber} incomplete` : `Complete set ${set.setNumber}`}
            aria-pressed={set.completed}
            disabled={saving || dirty}
            onClick={() => void onToggle(set)}
            className={`mb-0.5 flex size-11 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${
              set.completed
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-line text-muted hover:bg-hover'
            }`}
          >
            <Check aria-hidden="true" size={18} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <Input
            label="Weight (kg)"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={weight}
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
            onChange={(event) => {
              setReps(event.currentTarget.value)
              setDirty(true)
              onDirtyChange(set.id, true)
            }}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="mt-2 flex justify-end gap-2">
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
      <Modal
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
          <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <p className="text-sm leading-6 text-muted">
          This removes {set.weightKg} kg × {set.reps} reps from the active workout.
          The record will be soft deleted.
        </p>
      </Modal>
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
            className="flex size-11 items-center justify-center rounded-lg text-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40"
          >
            <ArrowUp aria-hidden="true" size={17} />
          </button>
          <button
            type="button"
            aria-label={`Move ${workoutExercise.exerciseNameSnapshot} down`}
            disabled={position === count - 1 || saving}
            onClick={() => void onMove(workoutExercise.id, 1)}
            className="flex size-11 items-center justify-center rounded-lg text-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40"
          >
            <ArrowDown aria-hidden="true" size={17} />
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {previous ? (
          <div className="rounded-lg bg-accent-soft px-3 py-2.5 text-xs text-ink">
            <p className="font-semibold">
              Previous performance ·{' '}
              {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
                new Date(previous.workout.completedAt ?? previous.workout.startedAt),
              )}
            </p>
            <p className="mt-1 text-muted">
              {previous.sets
                .map(
                  (set) =>
                    `Set ${set.setNumber}: ${set.weightKg} kg × ${set.reps} (completed)`,
                )
                .join(' · ')}
            </p>
          </div>
        ) : (
          <p className="rounded-lg bg-surface px-3 py-2.5 text-xs text-muted">
            No previous performance yet.
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Sets</h3>
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
        {sets.length ? (
          <div className="space-y-2">
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
            className="w-full resize-y rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          />
          {notesError && (
            <p role="alert" className="text-xs text-red-700">
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
