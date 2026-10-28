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
  ConfirmedMeal,
  ConfirmedMealItem,
  MealType,
  ParsedMeal,
} from '../types'

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

interface EditableMealItem {
  id: string
  mealName: string
  mealType: MealType
  servingDescription: string
  calories: string
  proteinG: string
  carbsG: string
  fatG: string
  notes: string
}

function parseInitialMeals(meal: ParsedMeal): EditableMealItem[] {
  const source =
    meal.meals && meal.meals.length > 0
      ? meal.meals
      : [
          {
            mealName: meal.mealName ?? '',
            mealType: meal.mealType ?? 'snack',
            servingDescription: meal.servingDescription ?? '1 serving',
            calories: meal.calories ?? 0,
            proteinG: meal.proteinG ?? 0,
            carbsG: meal.carbsG ?? 0,
            fatG: meal.fatG ?? 0,
            notes: meal.notes ?? null,
          },
        ]

  return source.map((item, idx) => ({
    id: `meal-${idx}-${Date.now()}`,
    mealName: item.mealName ?? '',
    mealType: item.mealType ?? 'snack',
    servingDescription: item.servingDescription ?? '1 serving',
    calories:
      item.calories !== null && item.calories !== undefined
        ? String(item.calories)
        : '',
    proteinG:
      item.proteinG !== null && item.proteinG !== undefined
        ? String(item.proteinG)
        : '0',
    carbsG:
      item.carbsG !== null && item.carbsG !== undefined
        ? String(item.carbsG)
        : '0',
    fatG:
      item.fatG !== null && item.fatG !== undefined
        ? String(item.fatG)
        : '0',
    notes: item.notes ?? '',
  }))
}

export function ParsedMealPreview({
  meal,
  onConfirm,
  onCancel,
  saving,
}: ParsedMealPreviewProps) {
  const [items, setItems] = useState<EditableMealItem[]>(() =>
    parseInitialMeals(meal),
  )
  const [validationError, setValidationError] = useState<string | null>(null)

  const updateItem = (
    index: number,
    field: keyof EditableMealItem,
    value: string,
  ) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    )
  }

  const removeItem = (index: number) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `meal-${Date.now()}`,
        mealName: '',
        mealType: 'snack',
        servingDescription: '1 serving',
        calories: '',
        proteinG: '0',
        carbsG: '0',
        fatG: '0',
        notes: '',
      },
    ])
  }

  const handleConfirm = () => {
    if (items.length === 0) {
      setValidationError('At least one meal item is required.')
      return
    }

    const confirmedItems: ConfirmedMealItem[] = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const trimmedName = item.mealName.trim()
      if (!trimmedName) {
        setValidationError(`Item #${i + 1} name cannot be blank.`)
        return
      }

      const calNum = Number.parseInt(item.calories, 10)
      if (Number.isNaN(calNum) || calNum < 0) {
        setValidationError(
          `Item "${trimmedName}" calories must be a non-negative number.`,
        )
        return
      }

      const pNum = Number.parseFloat(item.proteinG)
      if (Number.isNaN(pNum) || pNum < 0) {
        setValidationError(
          `Item "${trimmedName}" protein must be a non-negative number.`,
        )
        return
      }

      const cNum = Number.parseFloat(item.carbsG)
      if (Number.isNaN(cNum) || cNum < 0) {
        setValidationError(
          `Item "${trimmedName}" carbs must be a non-negative number.`,
        )
        return
      }

      const fNum = Number.parseFloat(item.fatG)
      if (Number.isNaN(fNum) || fNum < 0) {
        setValidationError(
          `Item "${trimmedName}" fat must be a non-negative number.`,
        )
        return
      }

      confirmedItems.push({
        mealName: trimmedName,
        mealType: item.mealType,
        servingDescription: item.servingDescription.trim() || '1 serving',
        calories: calNum,
        proteinG: Math.round(pNum * 10) / 10,
        carbsG: Math.round(cNum * 10) / 10,
        fatG: Math.round(fNum * 10) / 10,
        portionPercent: 100,
        notes: item.notes.trim(),
      })
    }

    setValidationError(null)

    const primary = confirmedItems[0]
    const totalCalories = confirmedItems.reduce((sum, m) => sum + m.calories, 0)
    const totalProtein = Math.round(
      confirmedItems.reduce((sum, m) => sum + m.proteinG, 0) * 10,
    ) / 10
    const totalCarbs = Math.round(
      confirmedItems.reduce((sum, m) => sum + m.carbsG, 0) * 10,
    ) / 10
    const totalFat = Math.round(
      confirmedItems.reduce((sum, m) => sum + m.fatG, 0) * 10,
    ) / 10

    onConfirm({
      meals: confirmedItems,
      // Legacy compatibility
      mealName:
        confirmedItems.length === 1
          ? primary.mealName
          : `${confirmedItems.length} items logged`,
      mealType: primary.mealType,
      servingDescription: primary.servingDescription,
      calories: totalCalories,
      proteinG: totalProtein,
      carbsG: totalCarbs,
      fatG: totalFat,
      portionPercent: 100,
    })
  }

  // Calculate live totals
  const totalCalories = items.reduce(
    (sum, m) => sum + (Number.parseInt(m.calories, 10) || 0),
    0,
  )
  const totalProtein = Math.round(
    items.reduce((sum, m) => sum + (Number.parseFloat(m.proteinG) || 0), 0) * 10,
  ) / 10
  const totalCarbs = Math.round(
    items.reduce((sum, m) => sum + (Number.parseFloat(m.carbsG) || 0), 0) * 10,
  ) / 10
  const totalFat = Math.round(
    items.reduce((sum, m) => sum + (Number.parseFloat(m.fatG) || 0), 0) * 10,
  ) / 10

  return (
    <Card
      title="Review Parsed Food &amp; Nutrition"
      description="Verify or adjust individual food items, meal types, and macronutrients before logging."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">
            {items.length} {items.length === 1 ? 'Food Item' : 'Food Items'}
          </Badge>
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
              Please check the portions and macronutrients below before
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

        {/* Live Total Nutrition Summary Bar */}
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-accent">
              Total Intake to Log
            </span>
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-ink">
              <span>
                <strong>{totalCalories}</strong> kcal
              </span>
              <span className="text-muted">·</span>
              <span>
                <strong>{totalProtein}g</strong> Protein
              </span>
              <span className="text-muted">·</span>
              <span>
                <strong>{totalCarbs}g</strong> Carbs
              </span>
              <span className="text-muted">·</span>
              <span>
                <strong>{totalFat}g</strong> Fat
              </span>
            </div>
          </div>
        </div>

        {/* List of Food / Meal Items */}
        <div className="space-y-4">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="rounded-xl border border-line bg-surface/60 p-4 transition-all hover:border-line/80"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-emerald-500/15 text-xs font-bold text-emerald-400">
                    {index + 1}
                  </span>
                  <span className="text-sm font-semibold text-ink">
                    {item.mealName || `Item #${index + 1}`}
                  </span>
                  <span className="rounded-md bg-hover px-2 py-0.5 text-[11px] font-medium uppercase text-muted">
                    {MEAL_TYPE_LABELS[item.mealType]}
                  </span>
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    disabled={saving}
                    aria-label={`Remove item ${index + 1}`}
                    className="flex size-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-500/15 hover:text-red-400"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <Input
                  label="Food / Meal Name"
                  value={item.mealName}
                  onChange={(e) =>
                    updateItem(index, 'mealName', e.target.value)
                  }
                  placeholder="e.g. Scrambled Eggs with Toast"
                  required
                  disabled={saving}
                />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink">
                      Meal Type
                    </label>
                    <div className="grid grid-cols-4 gap-1 rounded-lg border border-line bg-surface p-1">
                      {MEAL_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          disabled={saving}
                          onClick={() => updateItem(index, 'mealType', type)}
                          className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
                            item.mealType === type
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
                    value={item.servingDescription}
                    onChange={(e) =>
                      updateItem(index, 'servingDescription', e.target.value)
                    }
                    placeholder="e.g. 2 eggs, 2 slices toast"
                    disabled={saving}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Input
                    label="Calories (kcal)"
                    type="number"
                    min="0"
                    value={item.calories}
                    onChange={(e) =>
                      updateItem(index, 'calories', e.target.value)
                    }
                    placeholder="e.g. 350"
                    required
                    disabled={saving}
                  />

                  <Input
                    label="Protein (g)"
                    type="number"
                    step="any"
                    min="0"
                    value={item.proteinG}
                    onChange={(e) =>
                      updateItem(index, 'proteinG', e.target.value)
                    }
                    placeholder="e.g. 20"
                    disabled={saving}
                  />

                  <Input
                    label="Carbs (g)"
                    type="number"
                    step="any"
                    min="0"
                    value={item.carbsG}
                    onChange={(e) =>
                      updateItem(index, 'carbsG', e.target.value)
                    }
                    placeholder="e.g. 30"
                    disabled={saving}
                  />

                  <Input
                    label="Fat (g)"
                    type="number"
                    step="any"
                    min="0"
                    value={item.fatG}
                    onChange={(e) => updateItem(index, 'fatG', e.target.value)}
                    placeholder="e.g. 10"
                    disabled={saving}
                  />
                </div>

                <Input
                  label="Notes (Optional)"
                  value={item.notes}
                  onChange={(e) => updateItem(index, 'notes', e.target.value)}
                  placeholder="e.g. Cooked in olive oil"
                  disabled={saving}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Add Food Item Button */}
        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            variant="outline"
            size="small"
            icon={Plus}
            onClick={addItem}
            disabled={saving}
          >
            Add Another Food Item
          </Button>

          <span className="text-xs text-muted">
            Each item is logged with its specific category (breakfast, lunch, etc).
          </span>
        </div>

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
              ? 'Logging Foods…'
              : `Confirm & Log (${items.length} ${
                  items.length === 1 ? 'Item' : 'Items'
                })`}
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default ParsedMealPreview
