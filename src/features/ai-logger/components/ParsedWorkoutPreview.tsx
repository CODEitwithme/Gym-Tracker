import { useState } from 'react'
import { Bot, CheckCircle, Sparkles, XCircle } from 'lucide-react'
import { Badge, Button, Card, Input } from '../../../components/common'
import type { ConfirmedWorkout, ParsedWorkout } from '../types'

export interface ParsedWorkoutPreviewProps {
  workout: ParsedWorkout
  onConfirm: (confirmed: ConfirmedWorkout) => void
  onCancel: () => void
  saving: boolean
}

export function ParsedWorkoutPreview({
  workout,
  onConfirm,
  onCancel,
  saving,
}: ParsedWorkoutPreviewProps) {
  const [exercise, setExercise] = useState(workout.exercise ?? '')
  const [weight, setWeight] = useState(
    workout.weight !== null && workout.weight !== undefined
      ? String(workout.weight)
      : '',
  )
  const [unit, setUnit] = useState<'kg' | 'lbs'>(
    workout.unit === 'lbs' ? 'lbs' : 'kg',
  )
  const [reps, setReps] = useState(
    workout.reps !== null && workout.reps !== undefined
      ? String(workout.reps)
      : '',
  )
  const [sets, setSets] = useState(
    workout.sets !== null && workout.sets !== undefined
      ? String(workout.sets)
      : '',
  )
  const [notes, setNotes] = useState(workout.notes ?? '')
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleConfirm = () => {
    const trimmedExercise = exercise.trim()
    if (!trimmedExercise) {
      setValidationError('Exercise name cannot be blank.')
      return
    }

    const repsNum = Number.parseInt(reps, 10)
    if (Number.isNaN(repsNum) || repsNum < 1) {
      setValidationError('Reps must be at least 1.')
      return
    }

    const setsNum = Number.parseInt(sets, 10)
    if (Number.isNaN(setsNum) || setsNum < 1) {
      setValidationError('Sets must be at least 1.')
      return
    }

    let parsedWeight: number | null = null
    if (weight.trim() !== '') {
      parsedWeight = Number.parseFloat(weight)
      if (Number.isNaN(parsedWeight) || parsedWeight < 0) {
        setValidationError('Weight cannot be negative.')
        return
      }
    }

    setValidationError(null)
    onConfirm({
      exercise: trimmedExercise,
      weight: parsedWeight,
      unit,
      reps: repsNum,
      sets: setsNum,
      durationSeconds: workout.durationSeconds,
      notes: notes.trim(),
    })
  }

  return (
    <Card
      title="Review Parsed Workout"
      description="Verify or adjust the details before logging."
      actions={
        <div className="flex items-center gap-2">
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
                Low confidence detection:{' '}
              </span>
              Please check the exercise name, reps, and sets carefully before
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

        <div className="space-y-3">
          <Input
            label="Exercise Name"
            value={exercise}
            onChange={(e) => setExercise(e.target.value)}
            placeholder="e.g. Bench Press"
            required
            disabled={saving}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                Unit
              </label>
              <div className="flex h-10 rounded-lg border border-line bg-surface p-1">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setUnit('kg')}
                  className={`flex-1 rounded-md text-xs font-semibold transition-colors ${
                    unit === 'kg'
                      ? 'bg-accent text-surface'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  kg
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setUnit('lbs')}
                  className={`flex-1 rounded-md text-xs font-semibold transition-colors ${
                    unit === 'lbs'
                      ? 'bg-accent text-surface'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  lbs
                </button>
              </div>
            </div>

            <Input
              label={`Weight (${unit})`}
              type="number"
              step="any"
              min="0"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 60"
              disabled={saving}
            />

            <Input
              label="Sets"
              type="number"
              min="1"
              value={sets}
              onChange={(e) => setSets(e.target.value)}
              placeholder="e.g. 3"
              required
              disabled={saving}
            />

            <Input
              label="Reps"
              type="number"
              min="1"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              placeholder="e.g. 10"
              required
              disabled={saving}
            />
          </div>

          {workout.durationSeconds !== null &&
            workout.durationSeconds !== undefined && (
              <p className="text-xs text-muted">
                Estimated duration: {Math.round(workout.durationSeconds / 60)}{' '}
                min ({workout.durationSeconds}s)
              </p>
            )}

          <Input
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional workout notes (e.g. RPE 8, tempo 3-1-1)"
            disabled={saving}
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
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
            Confirm & Save Workout
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default ParsedWorkoutPreview
