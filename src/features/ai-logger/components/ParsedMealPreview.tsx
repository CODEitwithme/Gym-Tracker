import { useState } from 'react'
import { Bot, CheckCircle, Sparkles, XCircle } from 'lucide-react'
import { Badge, Button, Card, Input } from '../../../components/common'
import type { ConfirmedMeal, MealType, ParsedMeal } from '../types'

export interface ParsedMealPreviewProps {
  meal: ParsedMeal
  onConfirm: (confirmed: ConfirmedMeal) => void
  onCancel: () => void
  saving: boolean
}

const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

export function ParsedMealPreview({
  meal,
  onConfirm,
  onCancel,
  saving,
}: ParsedMealPreviewProps) {
  const [mealName, setMealName] = useState(meal.mealName ?? '')
  const [mealType, setMealType] = useState<MealType>(meal.mealType ?? 'snack')
  const [servingDescription, setServingDescription] = useState(
    meal.servingDescription ?? '1 serving',
  )
  const [calories, setCalories] = useState(
    meal.calories !== null && meal.calories !== undefined
      ? String(meal.calories)
      : '',
  )
  const [proteinG, setProteinG] = useState(
    meal.proteinG !== null && meal.proteinG !== undefined
      ? String(meal.proteinG)
      : '0',
  )
  const [carbsG, setCarbsG] = useState(
    meal.carbsG !== null && meal.carbsG !== undefined
      ? String(meal.carbsG)
      : '0',
  )
  const [fatG, setFatG] = useState(
    meal.fatG !== null && meal.fatG !== undefined ? String(meal.fatG) : '0',
  )
  const [notes, setNotes] = useState(meal.notes ?? '')
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleConfirm = () => {
    const trimmedName = mealName.trim()
    if (!trimmedName) {
      setValidationError('Meal name cannot be blank.')
      return
    }

    const calNum = Number.parseInt(calories, 10)
    if (Number.isNaN(calNum) || calNum < 0) {
      setValidationError('Calories must be a non-negative number.')
      return
    }

    const pNum = Number.parseFloat(proteinG)
    if (Number.isNaN(pNum) || pNum < 0) {
      setValidationError('Protein must be a non-negative number.')
      return
    }

    const cNum = Number.parseFloat(carbsG)
    if (Number.isNaN(cNum) || cNum < 0) {
      setValidationError('Carbohydrates must be a non-negative number.')
      return
    }

    const fNum = Number.parseFloat(fatG)
    if (Number.isNaN(fNum) || fNum < 0) {
      setValidationError('Fat must be a non-negative number.')
      return
    }

    setValidationError(null)
    onConfirm({
      mealName: trimmedName,
      mealType,
      servingDescription: servingDescription.trim() || '1 serving',
      calories: calNum,
      proteinG: Math.round(pNum * 10) / 10,
      carbsG: Math.round(cNum * 10) / 10,
      fatG: Math.round(fNum * 10) / 10,
      portionPercent: 100,
      notes: notes.trim(),
    })
  }

  return (
    <Card
      title="Review Parsed Meal"
      description="Verify or adjust the meal items and nutrition values before logging."
      actions={
        <div className="flex items-center gap-2">
          {meal.confidence === 'low' ? (
            <Badge variant="warning">Low Confidence</Badge>
          ) : (
            <Badge variant="success">High Confidence</Badge>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {meal.confidence === 'low' && (
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
                Estimated values:{' '}
              </span>
              Please check the portion size and macronutrients carefully before
              confirming.
            </div>
          </div>
        )}

        {meal.followUpQuestion && (
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
              {meal.followUpQuestion}
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
            label="Meal Name"
            value={mealName}
            onChange={(e) => setMealName(e.target.value)}
            placeholder="e.g. Oatmeal with Berries"
            required
            disabled={saving}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                Meal Category
              </label>
              <div className="grid grid-cols-4 gap-1 rounded-lg border border-line bg-surface p-1">
                {MEAL_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    disabled={saving}
                    onClick={() => setMealType(type)}
                    className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
                      mealType === type
                        ? 'bg-accent text-surface'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {MEAL_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Serving / Portion"
              value={servingDescription}
              onChange={(e) => setServingDescription(e.target.value)}
              placeholder="e.g. 1 bowl (300g)"
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Input
              label="Calories (kcal)"
              type="number"
              min="0"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="e.g. 450"
              required
              disabled={saving}
            />

            <Input
              label="Protein (g)"
              type="number"
              step="any"
              min="0"
              value={proteinG}
              onChange={(e) => setProteinG(e.target.value)}
              placeholder="e.g. 30"
              disabled={saving}
            />

            <Input
              label="Carbs (g)"
              type="number"
              step="any"
              min="0"
              value={carbsG}
              onChange={(e) => setCarbsG(e.target.value)}
              placeholder="e.g. 50"
              disabled={saving}
            />

            <Input
              label="Fat (g)"
              type="number"
              step="any"
              min="0"
              value={fatG}
              onChange={(e) => setFatG(e.target.value)}
              placeholder="e.g. 12"
              disabled={saving}
            />
          </div>

          <Input
            label="Notes (Optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Post-workout meal"
            disabled={saving}
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <Button
            variant="outline"
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
            icon={CheckCircle}
          >
            Confirm &amp; Log Meal
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default ParsedMealPreview

