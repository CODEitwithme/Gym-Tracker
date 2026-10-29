import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button, Modal } from '../../../components/common'
import { parseWorkoutMessage } from '../../ai-logger/aiLoggerService'
import { ParsedWorkoutPreview } from '../../ai-logger/components/ParsedWorkoutPreview'
import type {
  ConfirmedExerciseItem,
  ConfirmedWorkout,
  ParsedWorkout,
} from '../../ai-logger/types'
import {
  addExerciseToWorkout,
  createCustomExercise,
  createSet,
  findExercises,
} from '../workoutService'

export interface AiActiveWorkoutModalProps {
  open: boolean
  workoutId: string
  onClose: () => void
  onSuccess: (message?: string) => Promise<void> | void
}

const ACTIVE_QUICK_PROMPTS = [
  'Barbell Bench Press: 3 sets of 10 reps at 80kg',
  'Incline Dumbbell Curl: 3 sets of 12 reps at 14kg',
  'Lat Pulldown: 3 sets of 10 reps at 65kg',
  'Lateral Raises: 4 sets of 15 reps at 10kg',
]

export function AiActiveWorkoutModal({
  open,
  workoutId,
  onClose,
  onSuccess,
}: AiActiveWorkoutModalProps) {
  const [prompt, setPrompt] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsedWorkout, setParsedWorkout] = useState<ParsedWorkout | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleReset = () => {
    setPrompt('')
    setParsedWorkout(null)
    setError(null)
    setParsing(false)
    setSaving(false)
  }

  const handleClose = () => {
    if (parsing || saving) return
    handleReset()
    onClose()
  }

  const handleParse = async () => {
    const trimmed = prompt.trim()
    if (!trimmed || parsing) return

    setParsing(true)
    setError(null)
    try {
      const result = await parseWorkoutMessage(trimmed)
      setParsedWorkout(result)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to parse exercise with AI. Please check your text.',
      )
    } finally {
      setParsing(false)
    }
  }

  const handleConfirm = async (confirmed: ConfirmedWorkout) => {
    if (saving) return

    const exerciseItems: ConfirmedExerciseItem[] =
      confirmed.exercises && confirmed.exercises.length > 0
        ? confirmed.exercises
        : confirmed.exercise
          ? [
              {
                exercise: confirmed.exercise,
                weight: confirmed.weight ?? null,
                unit: confirmed.unit ?? 'kg',
                reps: confirmed.reps ?? 10,
                sets: confirmed.sets ?? 3,
                durationSeconds: confirmed.durationSeconds ?? null,
                notes: confirmed.notes ?? '',
              },
            ]
          : []

    if (exerciseItems.length === 0) {
      setError('No exercise data to add.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      for (const item of exerciseItems) {
        const found = await findExercises(item.exercise)
        let exercise = found.find(
          (e) => e.name.toLowerCase() === item.exercise.toLowerCase().trim(),
        )
        if (!exercise) {
          exercise = await createCustomExercise({
            name: item.exercise.trim(),
            category: 'other',
            equipment: null,
          })
        }

        const workoutExercise = await addExerciseToWorkout(
          workoutId,
          exercise.id,
        )

        const rawWeight = item.weight ?? 0
        const weightKg =
          item.unit === 'lbs'
            ? Math.round(rawWeight * 0.453592 * 100) / 100
            : Math.round(rawWeight * 100) / 100

        const setsCount = item.sets && item.sets > 0 ? item.sets : 1
        const repsCount = item.reps && item.reps > 0 ? item.reps : 1

        for (let setNumber = 1; setNumber <= setsCount; setNumber++) {
          await createSet({
            workoutExerciseId: workoutExercise.id,
            setNumber,
            weightKg,
            reps: repsCount,
            completed: false,
          })
        }
      }

      await onSuccess(
        `${exerciseItems.length} exercise${exerciseItems.length > 1 ? 's' : ''} added to session.`,
      )
      handleClose()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to add exercises to workout.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      closeBlocked={parsing || saving}
      title="AI Quick Add"
      footer={
        parsedWorkout ? undefined : (
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button variant="ghost" disabled={parsing} onClick={handleClose}>
              Cancel
            </Button>
            <Button
              icon={Sparkles}
              loading={parsing}
              disabled={parsing || !prompt.trim()}
              onClick={() => void handleParse()}
            >
              Parse & Review
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
            {error}
          </p>
        )}

        {parsedWorkout ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink">
                Review exercises to insert
              </p>
              <button
                type="button"
                onClick={() => setParsedWorkout(null)}
                className="text-xs text-accent hover:underline"
              >
                Edit prompt
              </button>
            </div>
            <ParsedWorkoutPreview
              workout={parsedWorkout}
              saving={saving}
              onCancel={() => setParsedWorkout(null)}
              onConfirm={(confirmed) => void handleConfirm(confirmed)}
            />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label
                htmlFor="ai-quick-add-prompt"
                className="block text-sm font-medium text-ink"
              >
                What exercise & sets did you do?
              </label>
              <textarea
                id="ai-quick-add-prompt"
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Incline Dumbbell Press 3 sets of 10 at 28kg..."
                className="w-full rounded-xl border border-line bg-panel p-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    void handleParse()
                  }
                }}
              />
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Tip: Mention exercise name, sets, reps, and weight.</span>
                <span>Ctrl + Enter</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted">Quick examples:</p>
              <div className="flex flex-col gap-1.5">
                {ACTIVE_QUICK_PROMPTS.map((qp, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPrompt(qp)}
                    className="truncate rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left text-xs text-muted transition hover:border-accent/40 hover:text-ink"
                  >
                    {qp}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

export default AiActiveWorkoutModal

