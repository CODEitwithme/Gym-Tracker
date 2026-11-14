import { useEffect, useState } from 'react'
import {
  Bot,
  CheckCircle,
  Plus,
  Sliders,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react'
import { Badge, Button, Card, Input } from '../../../components/common'
import { listActiveExercises } from '../../../db/repositories/exercises'
import type {
  ConfirmedExerciseItem,
  ConfirmedWorkout,
  ExerciseSetDetail,
  ParsedWorkout,
} from '../types'

export interface ParsedWorkoutPreviewProps {
  workout: ParsedWorkout
  onConfirm: (confirmed: ConfirmedWorkout) => void
  onCancel: () => void
  saving: boolean
}

export interface EditableSetRow {
  setNumber: number
  weight: string
  reps: string
}

interface EditableExercise {
  id: string
  exercise: string
  weight: string
  unit: 'kg' | 'lbs'
  reps: string
  sets: string
  notes: string
  hasCustomSets: boolean
  setRows: EditableSetRow[]
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
            setDetails: null,
          },
        ]

  return source.map((item, idx) => {
    const rawSets =
      item.sets !== null && item.sets !== undefined ? Math.max(1, item.sets) : 3
    const defWeight =
      item.weight !== null && item.weight !== undefined ? String(item.weight) : ''
    const defReps =
      item.reps !== null && item.reps !== undefined ? String(item.reps) : '10'

    let hasCustomSets = false
    let setRows: EditableSetRow[] = []

    if (item.setDetails && item.setDetails.length > 0) {
      hasCustomSets = true
      setRows = item.setDetails.map((sd, sIdx) => ({
        setNumber: sIdx + 1,
        weight:
          sd.weight !== null && sd.weight !== undefined
            ? String(sd.weight)
            : defWeight,
        reps:
          sd.reps !== null && sd.reps !== undefined ? String(sd.reps) : defReps,
      }))
    } else {
      setRows = Array.from({ length: rawSets }, (_, i) => ({
        setNumber: i + 1,
        weight: defWeight,
        reps: defReps,
      }))
    }

    return {
      id: `ex-${idx}-${Date.now()}`,
      exercise: item.exercise ?? '',
      weight: defWeight,
      unit: item.unit === 'lbs' ? 'lbs' : 'kg',
      reps: defReps,
      sets: String(setRows.length),
      notes: item.notes ?? '',
      hasCustomSets,
      setRows,
    }
  })
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
  const [suggestedExercises, setSuggestedExercises] = useState<string[]>([])

  useEffect(() => {
    let active = true
    void listActiveExercises()
      .then((list) => {
        if (active) setSuggestedExercises(list.map((e) => e.name))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const updateItem = (
    index: number,
    field: keyof EditableExercise,
    value: string,
  ) => {
    setExercises((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        if (field === 'weight') {
          const updatedRows = item.hasCustomSets
            ? item.setRows
            : item.setRows.map((r) => ({ ...r, weight: value }))
          return { ...item, weight: value, setRows: updatedRows }
        }
        if (field === 'reps') {
          const updatedRows = item.hasCustomSets
            ? item.setRows
            : item.setRows.map((r) => ({ ...r, reps: value }))
          return { ...item, reps: value, setRows: updatedRows }
        }
        if (field === 'sets') {
          const count = Math.max(1, Math.min(30, Number.parseInt(value, 10) || 1))
          let updatedRows = [...item.setRows]
          if (updatedRows.length < count) {
            const lastRow = updatedRows[updatedRows.length - 1]
            while (updatedRows.length < count) {
              updatedRows.push({
                setNumber: updatedRows.length + 1,
                weight: lastRow ? lastRow.weight : item.weight,
                reps: lastRow ? lastRow.reps : item.reps,
              })
            }
          } else if (updatedRows.length > count) {
            updatedRows = updatedRows.slice(0, count)
          }
          return { ...item, sets: value, setRows: updatedRows }
        }
        return { ...item, [field]: value }
      }),
    )
  }

  const toggleCustomSets = (index: number) => {
    setExercises((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        const nextState = !item.hasCustomSets
        if (!nextState) {
          // Reverting to uniform weights
          const baseWeight = item.setRows[0]?.weight ?? item.weight
          const baseReps = item.setRows[0]?.reps ?? item.reps
          const updatedRows = item.setRows.map((r) => ({
            ...r,
            weight: baseWeight,
            reps: baseReps,
          }))
          return {
            ...item,
            hasCustomSets: false,
            weight: baseWeight,
            reps: baseReps,
            setRows: updatedRows,
          }
        }
        return { ...item, hasCustomSets: true }
      }),
    )
  }

  const updateSetRow = (
    exerciseIndex: number,
    setIndex: number,
    field: 'weight' | 'reps',
    value: string,
  ) => {
    setExercises((prev) =>
      prev.map((ex, exIdx) => {
        if (exIdx !== exerciseIndex) return ex
        const updatedRows = ex.setRows.map((row, rIdx) =>
          rIdx === setIndex ? { ...row, [field]: value } : row,
        )
        return { ...ex, setRows: updatedRows }
      }),
    )
  }

  const addSetRow = (exerciseIndex: number) => {
    setExercises((prev) =>
      prev.map((ex, exIdx) => {
        if (exIdx !== exerciseIndex) return ex
        const lastRow = ex.setRows[ex.setRows.length - 1]
        const nextSetNum = ex.setRows.length + 1
        const newRow: EditableSetRow = {
          setNumber: nextSetNum,
          weight: lastRow ? lastRow.weight : ex.weight,
          reps: lastRow ? lastRow.reps : ex.reps,
        }
        const updatedRows = [...ex.setRows, newRow]
        return {
          ...ex,
          sets: String(updatedRows.length),
          setRows: updatedRows,
        }
      }),
    )
  }

  const removeSetRow = (exerciseIndex: number, setIndex: number) => {
    setExercises((prev) =>
      prev.map((ex, exIdx) => {
        if (exIdx !== exerciseIndex) return ex
        if (ex.setRows.length <= 1) return ex
        const updatedRows = ex.setRows
          .filter((_, rIdx) => rIdx !== setIndex)
          .map((row, i) => ({ ...row, setNumber: i + 1 }))
        return {
          ...ex,
          sets: String(updatedRows.length),
          setRows: updatedRows,
        }
      }),
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
        hasCustomSets: false,
        setRows: [
          { setNumber: 1, weight: '', reps: '10' },
          { setNumber: 2, weight: '', reps: '10' },
          { setNumber: 3, weight: '', reps: '10' },
        ],
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

      if (item.hasCustomSets) {
        if (item.setRows.length === 0) {
          setValidationError(
            `Exercise "${trimmedExercise}" must have at least 1 set.`,
          )
          return
        }

        const setDetails: ExerciseSetDetail[] = []
        for (let sIdx = 0; sIdx < item.setRows.length; sIdx++) {
          const s = item.setRows[sIdx]
          let parsedW: number | null = null
          if (s.weight.trim() !== '') {
            parsedW = Number.parseFloat(s.weight)
            if (Number.isNaN(parsedW) || parsedW < 0) {
              setValidationError(
                `Exercise "${trimmedExercise}" Set #${sIdx + 1} weight cannot be negative.`,
              )
              return
            }
          }
          const parsedR = Number.parseInt(s.reps, 10)
          if (Number.isNaN(parsedR) || parsedR < 1) {
            setValidationError(
              `Exercise "${trimmedExercise}" Set #${sIdx + 1} must have at least 1 rep.`,
            )
            return
          }
          setDetails.push({
            setNumber: sIdx + 1,
            weight: parsedW,
            reps: parsedR,
          })
        }

        confirmedItems.push({
          exercise: trimmedExercise,
          weight: setDetails[0]?.weight ?? null,
          unit: item.unit,
          reps: setDetails[0]?.reps ?? 10,
          sets: setDetails.length,
          durationSeconds: null,
          notes: item.notes.trim(),
          setDetails,
        })
      } else {
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
    (sum, ex) =>
      sum +
      (ex.hasCustomSets ? ex.setRows.length : Number.parseInt(ex.sets, 10) || 0),
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
            className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-soft p-3.5 text-xs leading-5 text-warning"
          >
            <Sparkles
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-amber-400"
            />
            <div>
              <span className="font-semibold text-warning">
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
            className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-soft p-3.5 text-xs leading-5 text-warning"
          >
            <Bot
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-amber-300"
            />
            <div>
              <span className="font-semibold text-warning">
                AI Follow-up Question:{' '}
              </span>
              {workout.followUpQuestion}
            </div>
          </div>
        )}

        {validationError && (
          <p
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-xs leading-5 text-danger"
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
                  list="exercise-suggestions"
                  required
                  disabled={saving}
                />

                {/* Weight & Sets Configuration Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Sets &amp; Weight Configuration
                    </span>
                    {item.hasCustomSets && (
                      <Badge variant="info">Varying weights per set</Badge>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCustomSets(index)}
                    disabled={saving}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                      item.hasCustomSets
                        ? 'border border-accent/40 bg-accent/15 text-accent hover:bg-accent/25'
                        : 'border border-line bg-surface text-muted hover:border-line/80 hover:text-ink'
                    }`}
                  >
                    <Sliders size={13} />
                    {item.hasCustomSets
                      ? 'Revert to uniform weight for all sets'
                      : 'Different weight per set'}
                  </button>
                </div>

                {!item.hasCustomSets ? (
                  /* Standard Uniform Mode */
                  <div className="space-y-2">
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
                    <div className="flex justify-start">
                      <button
                        type="button"
                        onClick={() => toggleCustomSets(index)}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
                      >
                        <Sliders size={12} />
                        Want different weights for each set? Click here to customize per set.
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Custom Per-Set Breakdown Mode */
                  <div className="space-y-3 rounded-xl border border-line bg-surface/50 p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted">
                          Unit for this exercise
                        </label>
                        <div className="inline-flex h-8 w-28 rounded-lg border border-line bg-surface p-0.5">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => updateItem(index, 'unit', 'kg')}
                            className={`flex-1 rounded text-xs font-semibold transition-colors ${
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
                            className={`flex-1 rounded text-xs font-semibold transition-colors ${
                              item.unit === 'lbs'
                                ? 'bg-accent text-accent-fg'
                                : 'text-muted hover:text-ink'
                            }`}
                          >
                            lbs
                          </button>
                        </div>
                      </div>
                      <span className="text-xs text-muted">
                        {item.setRows.length} {item.setRows.length === 1 ? 'set' : 'sets'} configured
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="grid grid-cols-[3.5rem_1fr_1fr_2.5rem] items-center gap-2 px-1 text-xs font-semibold text-muted">
                        <span>Set</span>
                        <span>Weight ({item.unit})</span>
                        <span>Reps</span>
                        <span className="text-right">Action</span>
                      </div>
                      {item.setRows.map((setRow, sIdx) => (
                        <div
                          key={`set-${item.id}-${sIdx}`}
                          className="grid grid-cols-[3.5rem_1fr_1fr_2.5rem] items-center gap-2 rounded-lg border border-line/60 bg-panel/80 p-2"
                        >
                          <span className="text-center text-xs font-bold text-accent">
                            #{sIdx + 1}
                          </span>

                          <div>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={setRow.weight}
                              onChange={(e) =>
                                updateSetRow(index, sIdx, 'weight', e.target.value)
                              }
                              placeholder={`e.g. 24`}
                              disabled={saving}
                              aria-label={`Set ${sIdx + 1} weight in ${item.unit}`}
                              className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-xs text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-accent"
                            />
                          </div>

                          <div>
                            <input
                              type="number"
                              min="1"
                              value={setRow.reps}
                              onChange={(e) =>
                                updateSetRow(index, sIdx, 'reps', e.target.value)
                              }
                              placeholder="10"
                              required
                              disabled={saving}
                              aria-label={`Set ${sIdx + 1} reps`}
                              className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-xs text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-accent"
                            />
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => removeSetRow(index, sIdx)}
                              disabled={saving || item.setRows.length <= 1}
                              aria-label={`Remove set ${sIdx + 1}`}
                              className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-500/15 hover:text-red-400 disabled:opacity-20 disabled:pointer-events-none"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="small"
                        icon={Plus}
                        onClick={() => addSetRow(index)}
                        disabled={saving}
                      >
                        Add Set #{item.setRows.length + 1}
                      </Button>
                      <span className="text-xs text-muted">
                        Each set can have a different weight and reps.
                      </span>
                    </div>
                  </div>
                )}

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

        {suggestedExercises.length > 0 && (
          <datalist id="exercise-suggestions">
            {suggestedExercises.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        )}
      </div>
    </Card>
  )
}

export default ParsedWorkoutPreview
