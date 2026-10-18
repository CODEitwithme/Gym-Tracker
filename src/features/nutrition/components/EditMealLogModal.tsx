import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Badge, Button, Input, Modal } from '../../../components/common'
import { formatLocalDate } from '../../../lib/dateTime'
import { scaleNutrition } from '../../../lib/nutrition'
import { MEAL_TITLES, MEAL_TYPES } from '../nutritionService'
import type { MealLog, MealType } from '../types'

interface EditMealLogModalProps {
  open: boolean
  onClose: () => void
  mealLog: MealLog | null
  onSave: (
    id: string,
    changes: {
      mealType?: MealType
      portionPercent?: number
      consumedAt?: string
    },
  ) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function EditMealLogModal({
  open,
  onClose,
  mealLog,
  onSave,
  onDelete,
}: EditMealLogModalProps) {
  const [mealType, setMealType] = useState<MealType>('breakfast')
  const [portionPercent, setPortionPercent] = useState('100')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('12:00')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (open && mealLog) {
      void Promise.resolve().then(() => {
        setMealType(mealLog.mealType)
        setPortionPercent(String(mealLog.portionPercent))
        const consumedDate = new Date(mealLog.consumedAt)
        setDate(formatLocalDate(consumedDate))
        setTime(
          `${String(consumedDate.getHours()).padStart(2, '0')}:${String(consumedDate.getMinutes()).padStart(2, '0')}`,
        )
        setError(null)
        setConfirmDelete(false)
      })
    }
  }, [open, mealLog])

  const parsedPortion = Number(portionPercent)

  const scaledNutrition = useMemo(() => {
    if (!mealLog || !Number.isFinite(parsedPortion) || parsedPortion <= 0) {
      return null
    }
    const priorFactor = mealLog.portionPercent / 100
    if (priorFactor <= 0) return null
    const perServing = {
      calories: mealLog.nutritionSnapshot.calories / priorFactor,
      proteinG: mealLog.nutritionSnapshot.proteinG / priorFactor,
      carbsG: mealLog.nutritionSnapshot.carbsG / priorFactor,
      fatG: mealLog.nutritionSnapshot.fatG / priorFactor,
    }
    try {
      return scaleNutrition(perServing, parsedPortion)
    } catch {
      return null
    }
  }, [mealLog, parsedPortion])

  if (!mealLog) return null

  const handleSave = async () => {
    if (saving || deleting) return
    if (!Number.isFinite(parsedPortion) || parsedPortion <= 0) {
      setError('Portion percentage must be a positive number (e.g. 100).')
      return
    }

    if (!date) {
      setError('Please choose a valid date.')
      return
    }

    const [hours, minutes] = (time || '12:00').split(':').map(Number)
    const [year, month, day] = date.split('-').map(Number)
    const consumedDate = new Date(year, month - 1, day, hours, minutes, 0, 0)

    if (Number.isNaN(consumedDate.getTime())) {
      setError('Invalid date or time.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSave(mealLog.id, {
        mealType,
        portionPercent: parsedPortion,
        consumedAt: consumedDate.toISOString(),
      })
      onClose()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to update meal log. Please retry.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (deleting || saving) return
    setDeleting(true)
    setError(null)
    try {
      await onDelete(mealLog.id)
      onClose()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete meal log.',
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeBlocked={saving || deleting}
      title="Edit Logged Meal"
      footer={
        <div className="flex flex-col-reverse justify-between gap-2 sm:flex-row sm:items-center">
          <Button
            variant="danger"
            size="small"
            icon={Trash2}
            disabled={saving || deleting}
            loading={deleting}
            onClick={() => setConfirmDelete(true)}
          >
            Delete log
          </Button>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" disabled={saving || deleting} onClick={onClose}>
              Cancel
            </Button>
            <Button
              loading={saving}
              disabled={saving || deleting}
              onClick={() => void handleSave()}
            >
              Save changes
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
            {error}
          </p>
        )}

        <div className="rounded-xl border border-line bg-surface p-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-ink">{mealLog.mealNameSnapshot}</h3>
            <Badge variant="default">{mealLog.portionPercent}%</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            Logged snapshot: {Math.round(mealLog.nutritionSnapshot.calories)} kcal ·{' '}
            {Math.round(mealLog.nutritionSnapshot.proteinG * 10) / 10}g P ·{' '}
            {Math.round(mealLog.nutritionSnapshot.carbsG * 10) / 10}g C ·{' '}
            {Math.round(mealLog.nutritionSnapshot.fatG * 10) / 10}g F
          </p>
        </div>

        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-ink">
            Meal category
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MEAL_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={mealType === type}
                onClick={() => setMealType(type)}
                className={`flex min-h-11 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                  mealType === type
                    ? 'border-accent bg-accent text-white'
                    : 'border-line bg-panel text-ink hover:bg-hover'
                }`}
              >
                {MEAL_TITLES[type]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label="Portion size (%)"
            type="number"
            min="1"
            step="5"
            value={portionPercent}
            onChange={(e) => setPortionPercent(e.currentTarget.value)}
            required
          />
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.currentTarget.value)}
            required
          />
          <Input
            label="Time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.currentTarget.value)}
            required
          />
        </div>

        {scaledNutrition && (
          <div className="rounded-xl border border-line bg-surface p-3 text-xs">
            <p className="font-semibold uppercase tracking-wider text-muted">
              Updated Nutrition Totals
            </p>
            <div className="mt-1.5 grid grid-cols-4 gap-2 text-center">
              <div className="rounded bg-panel p-1.5">
                <p className="font-bold text-ink">{Math.round(scaledNutrition.calories)}</p>
                <p className="text-[10px] text-muted">Calories</p>
              </div>
              <div className="rounded bg-panel p-1.5">
                <p className="font-bold text-ink">
                  {Math.round(scaledNutrition.proteinG * 10) / 10}g
                </p>
                <p className="text-[10px] text-muted">Protein</p>
              </div>
              <div className="rounded bg-panel p-1.5">
                <p className="font-bold text-ink">
                  {Math.round(scaledNutrition.carbsG * 10) / 10}g
                </p>
                <p className="text-[10px] text-muted">Carbs</p>
              </div>
              <div className="rounded bg-panel p-1.5">
                <p className="font-bold text-ink">
                  {Math.round(scaledNutrition.fatG * 10) / 10}g
                </p>
                <p className="text-[10px] text-muted">Fat</p>
              </div>
            </div>
          </div>
        )}

        {confirmDelete && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <p className="font-semibold">Are you sure you want to delete this log?</p>
            <p className="mt-1 text-xs text-red-600">
              This meal will be removed from your daily nutrition totals.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                variant="danger"
                size="small"
                loading={deleting}
                disabled={deleting}
                onClick={() => void handleDelete()}
              >
                Confirm delete
              </Button>
              <Button
                variant="outline"
                size="small"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default EditMealLogModal
