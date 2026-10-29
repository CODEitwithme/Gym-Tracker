import { useState } from 'react'
import {
  Bot,
  CheckCircle,
  Plus,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react'
import { Badge, Button, Card, Input } from '../../../components/common'
import type {
  ConfirmedExerciseItem,
  ConfirmedWorkout,
  ParsedWorkout,
} from '../types'

export interface ParsedWorkoutPreviewProps {
  workout: ParsedWorkout
  onConfirm: (confirmed: ConfirmedWorkout) => void
  onCancel: () => void
  saving: boolean
}

interface EditableExercise {
  id: string
  exercise: string
  weight: string
  unit: 'kg' | 'lbs'
  reps: string
  sets: string
  notes: string
}

function parseInitialExercises(workout: ParsedWorkout): EditableExercise[] {
  const source =
    workout.exercises && workout.exercises.length > 0
      ? workout.exercises
      : [
          {
            exercise: workout.exercise ?? '',
            weight: workout.weight ?? null,
            unit: workout.unit ?? 'kg',
            reps: workout.reps ?? null,
            sets: workout.sets ?? null,
            durationSeconds: workout.durationSeconds ?? null,
            notes: workout.notes ?? null,
          },
        ]

  return source.map((item, idx) => ({
    id: `ex-${idx}-${Date.now()}`,
    exercise: item.exercise ?? '',
    weight:
      item.weight !== null && item.weight !== undefined ? String(item.weight) : '',
    unit: item.unit === 'lbs' ? 'lbs' : 'kg',
    reps:
      item.reps !== null && item.reps !== undefined ? String(item.reps) : '10',
    sets: item.sets !== null && item.sets !== undefined ? String(item.sets) : '3',
    notes: item.notes ?? '',
  }))
}

export function ParsedWorkoutPreview({
  workout,
  onConfirm,
  onCancel,
  saving,
}: ParsedWorkoutPreviewProps) {
  const [exercises, setExercises] = useState<EditableExercise[]>(() =>
    parseInitialExercises(workout),
  )
  const [sessionNotes, setSessionNotes] = useState(workout.notes ?? '')
  const [validationError, setValidationError] = useState<string | null>(null)

  const updateItem = (
    index: number,
    field: keyof EditableExercise,
    value: string,
  ) => {
    setExercises((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    )
  }

  const removeItem = (index: number) => {
    if (exercises.length <= 1) return
    setExercises((prev) => prev.filter((_, i) => i !== index))
  }

  const addExercise = () => {
    setExercises((prev) => [
      ...prev,
      {
        id: `ex-${Date.now()}`,
        exercise: '',
        weight: '',
        unit: 'kg',
        reps: '10',
        sets: '3',
        notes: '',
      },
    ])
  }

  const handleConfirm = () => {
    if (exercises.length === 0) {
      setValidationError('At least one exercise is required.')
      return
    }

    const confirmedItems: ConfirmedExerciseItem[] = []

    for (let i = 0; i < exercises.length; i++) {
      const item = exercises[i]
      const trimmedExercise = item.exercise.trim()
      if (!trimmedExercise) {
        setValidationError(`Exercise #${i + 1} name cannot be blank.`)
        return
      }

      const setsNum = Number.parseInt(item.sets, 10)
      if (Number.isNaN(setsNum) || setsNum < 1) {
        setValidationError(
          `Exercise "${trimmedExercise}" must have at least 1 set.`,
        )
        return
      }

      const repsNum = Number.parseInt(item.reps, 10)
      if (Number.isNaN(repsNum) || repsNum < 1) {
        setValidationError(
          `Exercise "${trimmedExercise}" must have at least 1 rep.`,
        )
        return
      }

      let parsedWeight: number | null = null
      if (item.weight.trim() !== '') {
        parsedWeight = Number.parseFloat(item.weight)
        if (Number.isNaN(parsedWeight) || parsedWeight < 0) {
          setValidationError(
            `Exercise "${trimmedExercise}" weight cannot be negative.`,
          )
          return
        }
      }

      confirmedItems.push({
        exercise: trimmedExercise,
        weight: parsedWeight,
        unit: item.unit,
        reps: repsNum,
        sets: setsNum,
        durationSeconds: null,
        notes: item.notes.trim(),
      })
    }

    setValidationError(null)

    const primary = confirmedItems[0]

    onConfirm({
      exercises: confirmedItems,
      sessionName: 'AI Workout',
      notes: sessionNotes.trim(),
      // Legacy compatibility
      exercise: primary.exercise,
      weight: primary.weight,
      unit: primary.unit,
      reps: primary.reps,
      sets: primary.sets,
      durationSeconds: null,
    })
  }

  const totalSets = exercises.reduce(
    (sum, ex) => sum + (Number.parseInt(ex.sets, 10) || 0),
    0,
  )

  return (
    <Card
      title="Review Parsed Workout"
      description="Verify or adjust the detected exercises and sets before saving to your log."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">
            {exercises.length} {exercises.length === 1 ? 'Exercise' : 'Exercises'} ·{' '}
            {totalSets} Sets
          </Badge>
          {workout.confidence === 'low' ? (
            <Badge variant="warning">Low Confidence</Badge>
          ) : (
            <Badge variant="success">High Confidence</Badge>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {workout.confidence === 'low' && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-amber-600/30 bg-amber-500/10 p-3.5 text-xs leading-5 text-amber-200"
          >
            <Sparkles
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-amber-400"
            />
            <div>
              <span className="font-semibold text-amber-300">
                Multiple exercises detected with low confidence:{' '}
              </span>
              Please check the exercise names, weights, and sets below before
              confirming.
            </div>
          </div>
        )}

        {workout.followUpQuestion && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/15 p-3.5 text-xs leading-5 text-amber-100"
          >
            <Bot
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-amber-300"
            />
            <div>
              <span className="font-semibold text-amber-200">
                AI Follow-up Question:{' '}
              </span>
              {workout.followUpQuestion}
            </div>
          </div>
        )}

        {validationError && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs leading-5 text-red-300"
          >
            {validationError}
          </p>
        )}

        {/* List of Exercises */}
        <div className="space-y-4">
          {exercises.map((item, index) => (
            <div
              key={item.id}
              className="rounded-xl border border-line bg-surface/60 p-4 transition-all hover:border-line/80"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-accent/15 text-xs font-bold text-accent">
                    {index + 1}
                  </span>
                  <span className="text-sm font-semibold text-ink">
                    Exercise {index + 1}
                  </span>
                </div>
                {exercises.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    disabled={saving}
                    aria-label={`Remove exercise ${index + 1}`}
                    className="flex size-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-500/15 hover:text-red-400"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <Input
                  label="Exercise Name"
                  value={item.exercise}
                  onChange={(e) =>
                    updateItem(index, 'exercise', e.target.value)
                  }
                  placeholder="e.g. Incline DB Press, Bench Press"
                  required
                  disabled={saving}
                />

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink">
                      Unit
                    </label>
                    <div className="flex h-10 rounded-lg border border-line bg-surface p-1">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => updateItem(index, 'unit', 'kg')}
                        className={`flex-1 rounded-md text-xs font-semibold transition-colors ${
                          item.unit === 'kg'
                            ? 'bg-accent text-accent-fg'
                            : 'text-muted hover:text-ink'
                        }`}
                      >
                        kg
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => updateItem(index, 'unit', 'lbs')}
                        className={`flex-1 rounded-md text-xs font-semibold transition-colors ${
                          item.unit === 'lbs'
                            ? 'bg-accent text-accent-fg'
                            : 'text-muted hover:text-ink'
                        }`}
                      >
                        lbs
                      </button>
                    </div>
                  </div>

                  <Input
                    label={`Weight (${item.unit})`}
                    type="number"
                    step="any"
                    min="0"
                    value={item.weight}
                    onChange={(e) =>
                      updateItem(index, 'weight', e.target.value)
                    }
                    placeholder="e.g. 24"
                    disabled={saving}
                  />

                  <Input
                    label="Sets"
                    type="number"
                    min="1"
                    value={item.sets}
                    onChange={(e) =>
                      updateItem(index, 'sets', e.target.value)
                    }
                    placeholder="e.g. 3"
                    required
                    disabled={saving}
                  />

                  <Input
                    label="Reps"
                    type="number"
                    min="1"
                    value={item.reps}
                    onChange={(e) =>
                      updateItem(index, 'reps', e.target.value)
                    }
                    placeholder="e.g. 10"
                    required
                    disabled={saving}
                  />
                </div>

                <Input
                  label="Exercise Notes (Optional)"
                  value={item.notes}
                  onChange={(e) => updateItem(index, 'notes', e.target.value)}
                  placeholder="e.g. RPE 8, drop set on last set"
                  disabled={saving}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Add Exercise Button */}
        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            variant="outline"
            size="small"
            icon={Plus}
            onClick={addExercise}
            disabled={saving}
          >
            Add Another Exercise
          </Button>

          <span className="text-xs text-muted">
            All exercises will be saved under one completed workout session.
          </span>
        </div>

        {/* Workout-level Notes */}
        <Input
          label="Session Notes (Optional)"
          value={sessionNotes}
          onChange={(e) => setSessionNotes(e.target.value)}
          placeholder="Overall notes for this workout session..."
          disabled={saving}
        />

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-3">
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={saving}
            icon={XCircle}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            loading={saving}
            disabled={saving}
            icon={CheckCircle}
          >
            {saving
              ? 'Saving Workout…'
              : `Confirm & Save Workout (${exercises.length} ${
                  exercises.length === 1 ? 'Exercise' : 'Exercises'
                })`}
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default ParsedWorkoutPreview
