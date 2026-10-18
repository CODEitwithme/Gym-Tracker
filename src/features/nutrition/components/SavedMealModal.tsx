import { useEffect, useState } from 'react'
import { Button, Input, Modal } from '../../../components/common'
import { estimateCaloriesFromMacros } from '../../../lib/nutrition'
import type { CalorieSource, SavedMeal } from '../types'

interface SavedMealModalProps {
  open: boolean
  onClose: () => void
  initialMeal?: SavedMeal | null
  onSave: (input: {
    name: string
    servingDescription: string
    calorieSource: CalorieSource
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }) => Promise<void>
}

function SavedMealModal({
  open,
  onClose,
  initialMeal,
  onSave,
}: SavedMealModalProps) {
  const [name, setName] = useState('')
  const [servingDescription, setServingDescription] = useState('1 serving')
  const [proteinG, setProteinG] = useState('0')
  const [carbsG, setCarbsG] = useState('0')
  const [fatG, setFatG] = useState('0')
  const [calorieSource, setCalorieSource] =
    useState<CalorieSource>('macro_estimate')
  const [manualCalories, setManualCalories] = useState('0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      void Promise.resolve().then(() => {
        if (initialMeal) {
          setName(initialMeal.name)
          setServingDescription(initialMeal.servingDescription)
          setProteinG(String(initialMeal.proteinG))
          setCarbsG(String(initialMeal.carbsG))
          setFatG(String(initialMeal.fatG))
          setCalorieSource(initialMeal.calorieSource)
          setManualCalories(String(initialMeal.calories))
        } else {
          setName('')
          setServingDescription('1 serving')
          setProteinG('0')
          setCarbsG('0')
          setFatG('0')
          setCalorieSource('macro_estimate')
          setManualCalories('0')
        }
        setError(null)
      })
    }
  }, [open, initialMeal])

  const parsedProtein = Math.max(0, Number(proteinG) || 0)
  const parsedCarbs = Math.max(0, Number(carbsG) || 0)
  const parsedFat = Math.max(0, Number(fatG) || 0)

  const estimatedCalories = Math.round(
    estimateCaloriesFromMacros({
      proteinG: parsedProtein,
      carbsG: parsedCarbs,
      fatG: parsedFat,
    }),
  )

  const displayedCalories =
    calorieSource === 'macro_estimate'
      ? estimatedCalories
      : Number(manualCalories) || 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return

    const trimmedName = name.trim()
    const trimmedServing = servingDescription.trim()

    if (!trimmedName) {
      setError('Meal name must not be blank.')
      return
    }
    if (!trimmedServing) {
      setError('Serving description must not be blank.')
      return
    }

    const numProtein = Number(proteinG)
    const numCarbs = Number(carbsG)
    const numFat = Number(fatG)

    if (!Number.isFinite(numProtein) || numProtein < 0) {
      setError('Protein must be a finite, non-negative number.')
      return
    }
    if (!Number.isFinite(numCarbs) || numCarbs < 0) {
      setError('Carbohydrates must be a finite, non-negative number.')
      return
    }
    if (!Number.isFinite(numFat) || numFat < 0) {
      setError('Fat must be a finite, non-negative number.')
      return
    }

    let calories = displayedCalories
    if (calorieSource === 'manual') {
      const numCal = Number(manualCalories)
      if (!Number.isFinite(numCal) || numCal < 0) {
        setError('Calories must be a finite, non-negative number.')
        return
      }
      calories = Math.round(numCal)
    }

    setSaving(true)
    setError(null)
    try {
      await onSave({
        name: trimmedName,
        servingDescription: trimmedServing,
        calorieSource,
        calories,
        proteinG: numProtein,
        carbsG: numCarbs,
        fatG: numFat,
      })
      onClose()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save the meal. Please retry.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialMeal ? 'Edit Saved Meal' : 'Create Saved Meal'}
      footer={
        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button variant="ghost" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="saved-meal-form"
            loading={saving}
            disabled={saving}
          >
            {initialMeal ? 'Save changes' : 'Create meal'}
          </Button>
        </div>
      }
    >
      <form id="saved-meal-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
            {error}
          </p>
        )}

        <Input
          label="Meal name"
          placeholder="e.g. Oatmeal with Protein"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />

        <Input
          label="Serving description"
          placeholder="e.g. 1 bowl, 100 g, or 1 serving"
          value={servingDescription}
          maxLength={80}
          onChange={(e) => setServingDescription(e.currentTarget.value)}
          required
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label="Protein (g)"
            type="number"
            min="0"
            step="0.1"
            value={proteinG}
            onChange={(e) => setProteinG(e.currentTarget.value)}
            required
          />
          <Input
            label="Carbs (g)"
            type="number"
            min="0"
            step="0.1"
            value={carbsG}
            onChange={(e) => setCarbsG(e.currentTarget.value)}
            required
          />
          <Input
            label="Fat (g)"
            type="number"
            min="0"
            step="0.1"
            value={fatG}
            onChange={(e) => setFatG(e.currentTarget.value)}
            required
          />
        </div>

        <div className="space-y-2 border-t border-line pt-3">
          <label className="text-sm font-medium text-ink">Calorie source</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input
                type="radio"
                name="calorieSource"
                value="macro_estimate"
                checked={calorieSource === 'macro_estimate'}
                onChange={() => setCalorieSource('macro_estimate')}
                className="text-accent focus:ring-accent"
              />
              Macro estimate (4P + 4C + 9F)
            </label>
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input
                type="radio"
                name="calorieSource"
                value="manual"
                checked={calorieSource === 'manual'}
                onChange={() => setCalorieSource('manual')}
                className="text-accent focus:ring-accent"
              />
              Manual entry
            </label>
          </div>
        </div>

        {calorieSource === 'manual' ? (
          <Input
            label="Calories (kcal)"
            type="number"
            min="0"
            step="1"
            value={manualCalories}
            onChange={(e) => setManualCalories(e.currentTarget.value)}
            helperText="Enter the exact calories printed on the nutrition label."
            required
          />
        ) : (
          <div className="rounded-xl border border-line bg-surface p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Calculated Calories
            </p>
            <p className="mt-1 text-2xl font-bold text-ink">
              {estimatedCalories}{' '}
              <span className="text-xs font-normal text-muted">kcal</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              ({parsedProtein}g × 4) + ({parsedCarbs}g × 4) + ({parsedFat}g × 9)
            </p>
          </div>
        )}
      </form>
    </Modal>
  )
}

export default SavedMealModal
