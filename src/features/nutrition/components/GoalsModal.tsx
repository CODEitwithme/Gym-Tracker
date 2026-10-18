import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Input, Modal } from '../../../components/common'
import type { DailyNutritionGoals } from '../types'

interface GoalsModalProps {
  open: boolean
  onClose: () => void
  currentGoals: DailyNutritionGoals | null
  onSave: (goals: DailyNutritionGoals) => boolean
}

function GoalsModal({ open, onClose, currentGoals, onSave }: GoalsModalProps) {
  const [calories, setCalories] = useState(
    currentGoals ? String(currentGoals.calories) : '2000',
  )
  const [proteinG, setProteinG] = useState(
    currentGoals ? String(currentGoals.proteinG) : '150',
  )
  const [carbsG, setCarbsG] = useState(
    currentGoals ? String(currentGoals.carbsG) : '200',
  )
  const [fatG, setFatG] = useState(
    currentGoals ? String(currentGoals.fatG) : '65',
  )
  const [error, setError] = useState<string | null>(null)
  const [persistenceWarning, setPersistenceWarning] = useState(false)

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsedCalories = Number(calories)
    const parsedProtein = Number(proteinG)
    const parsedCarbs = Number(carbsG)
    const parsedFat = Number(fatG)

    if (calories.trim() === '' || !Number.isFinite(parsedCalories) || parsedCalories < 0) {
      setError('Calories target must be a non-negative number.')
      return
    }
    if (proteinG.trim() === '' || !Number.isFinite(parsedProtein) || parsedProtein < 0) {
      setError('Protein target must be a non-negative number.')
      return
    }
    if (carbsG.trim() === '' || !Number.isFinite(parsedCarbs) || parsedCarbs < 0) {
      setError('Carbohydrates target must be a non-negative number.')
      return
    }
    if (fatG.trim() === '' || !Number.isFinite(parsedFat) || parsedFat < 0) {
      setError('Fat target must be a non-negative number.')
      return
    }

    const persisted = onSave({
      calories: Math.round(parsedCalories),
      proteinG: Math.round(parsedProtein),
      carbsG: Math.round(parsedCarbs),
      fatG: Math.round(parsedFat),
    })
    setError(null)
    setPersistenceWarning(!persisted)
    if (persisted) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Daily Nutrition Targets"
      footer={
        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="nutrition-goals-form">
            Save targets
          </Button>
        </div>
      }
    >
      <form
        id="nutrition-goals-form"
        onSubmit={handleSave}
        className="space-y-4"
      >
        <p className="text-sm text-muted">
          Set your personal daily targets. These will be used to show your progress
          on the nutrition dashboard.
        </p>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
            {error}
          </p>
        )}
        {persistenceWarning && (
          <p role="status" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            Targets are updated for this session, but browser storage could not
            save them. They may not be available after you close or refresh the app.
          </p>
        )}

        <Input
          label="Calories target (kcal)"
          type="number"
          min="0"
          step="10"
          value={calories}
          onChange={(e) => setCalories(e.currentTarget.value)}
          required
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label="Protein (g)"
            type="number"
            min="0"
            step="1"
            value={proteinG}
            onChange={(e) => setProteinG(e.currentTarget.value)}
            required
          />
          <Input
            label="Carbs (g)"
            type="number"
            min="0"
            step="1"
            value={carbsG}
            onChange={(e) => setCarbsG(e.currentTarget.value)}
            required
          />
          <Input
            label="Fat (g)"
            type="number"
            min="0"
            step="1"
            value={fatG}
            onChange={(e) => setFatG(e.currentTarget.value)}
            required
          />
        </div>
      </form>
    </Modal>
  )
}

export default GoalsModal
