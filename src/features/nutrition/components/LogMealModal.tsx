import { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Badge, Button, Input, Modal } from '../../../components/common'
import { formatLocalDate } from '../../../lib/dateTime'
import { scaleNutrition } from '../../../lib/nutrition'
import {
  fetchSavedMeals,
  MEAL_TITLES,
  MEAL_TYPES,
} from '../nutritionService'
import type { MealType, SavedMeal } from '../types'
import SavedMealModal from './SavedMealModal'

interface LogMealModalProps {
  open: boolean
  onClose: () => void
  initialDate?: string
  initialMealType?: MealType
  onLogMeal: (input: {
    savedMealId: string
    consumedAt: string
    mealType: MealType
    portionPercent: number
  }) => Promise<void>
  onCreateSavedMeal: (input: {
    name: string
    servingDescription: string
    calorieSource: 'manual' | 'macro_estimate'
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }) => Promise<SavedMeal>
}

function LogMealModal({
  open,
  onClose,
  initialDate,
  initialMealType = 'breakfast',
  onLogMeal,
  onCreateSavedMeal,
}: LogMealModalProps) {
  const [mealType, setMealType] = useState<MealType>(initialMealType)
  const [query, setQuery] = useState('')
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([])
  const [loadingMeals, setLoadingMeals] = useState(false)
  const [selectedMeal, setSelectedMeal] = useState<SavedMeal | null>(null)
  const [portionPercent, setPortionPercent] = useState('100')
  const [date, setDate] = useState(() => initialDate ?? formatLocalDate(new Date()))
  const [time, setTime] = useState(() => {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    void Promise.resolve()
      .then(() => {
        if (cancelled) return undefined
        setMealType(initialMealType)
        setDate(initialDate ?? formatLocalDate(new Date()))
        const now = new Date()
        setTime(
          `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        )
        setPortionPercent('100')
        setError(null)
        setQuery('')
        setSelectedMeal(null)
        setLoadingMeals(true)
        return fetchSavedMeals('')
      })
      .then((meals) => {
        if (!cancelled && meals) {
          setSavedMeals(meals)
          setSelectedMeal((previous) =>
            meals.find((meal) => meal.id === previous?.id) ?? meals[0] ?? null,
          )
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load saved meals library.')
      })
      .finally(() => {
        if (!cancelled) setLoadingMeals(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, initialDate, initialMealType])

  const filteredMeals = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    if (!q) return savedMeals
    return savedMeals.filter((m) => m.name.toLocaleLowerCase().includes(q))
  }, [savedMeals, query])

  const parsedPortion = Number(portionPercent)

  const scaledNutrition = useMemo(() => {
    if (!selectedMeal || !Number.isFinite(parsedPortion) || parsedPortion <= 0) {
      return null
    }
    try {
      return scaleNutrition(
        {
          calories: selectedMeal.calories,
          proteinG: selectedMeal.proteinG,
          carbsG: selectedMeal.carbsG,
          fatG: selectedMeal.fatG,
        },
        parsedPortion,
      )
    } catch {
      return null
    }
  }, [selectedMeal, parsedPortion])

  const handleLog = async () => {
    if (saving) return
    if (!selectedMeal) {
      setError('Please select a meal from your saved meals library.')
      return
    }
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
      await onLogMeal({
        savedMealId: selectedMeal.id,
        consumedAt: consumedDate.toISOString(),
        mealType,
        portionPercent: parsedPortion,
      })
      onClose()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to log meal. Please retry.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleCreatedMeal = async (newMealInput: {
    name: string
    servingDescription: string
    calorieSource: 'manual' | 'macro_estimate'
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }) => {
    const created = await onCreateSavedMeal(newMealInput)
    setSavedMeals((prev) => [created, ...prev])
    setSelectedMeal(created)
    setCreateModalOpen(false)
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        closeBlocked={saving}
        title="Log a Meal"
        footer={
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button variant="ghost" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button
              loading={saving}
              disabled={saving || !selectedMeal}
              onClick={() => void handleLog()}
            >
              Log meal
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
              {error}
            </p>
          )}

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
                      ? 'border-accent bg-accent text-accent-fg'
                      : 'border-line bg-panel text-ink hover:bg-hover'
                  }`}
                >
                  {MEAL_TITLES[type]}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink">
                Select saved meal
              </p>
              <Button
                size="small"
                variant="ghost"
                icon={Plus}
                onClick={() => setCreateModalOpen(true)}
              >
                Create new meal
              </Button>
            </div>

            <Input
              label="Search saved meals"
              type="search"
              placeholder="Search by meal name…"
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
            />

            {loadingMeals ? (
              <p className="py-4 text-center text-sm text-muted">
                Loading saved meals…
              </p>
            ) : filteredMeals.length === 0 ? (
              <div className="rounded-xl border border-line bg-surface p-4 text-center">
                <Search aria-hidden="true" className="mx-auto size-5 text-muted" />
                <p className="mt-1 text-sm font-medium text-ink">No meals found</p>
                <p className="text-xs text-muted">
                  Create a saved meal first to log it.
                </p>
                <Button
                  size="small"
                  variant="outline"
                  icon={Plus}
                  className="mt-3"
                  onClick={() => setCreateModalOpen(true)}
                >
                  Create saved meal
                </Button>
              </div>
            ) : (
              <ul className="max-h-40 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                {filteredMeals.map((meal) => {
                  const isSelected = selectedMeal?.id === meal.id
                  return (
                    <li key={meal.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedMeal(meal)}
                        className={`w-full px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                          isSelected
                            ? 'bg-accent-soft font-semibold text-accent'
                            : 'hover:bg-hover text-ink'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="min-w-0 break-words">{meal.name}</span>
                          <span className="shrink-0 text-xs font-normal text-muted">
                            {meal.calories} kcal
                          </span>
                        </div>
                        <p className="text-xs font-normal text-muted">
                          {meal.servingDescription} · {meal.proteinG}P · {meal.carbsG}C ·{' '}
                          {meal.fatG}F
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {selectedMeal && (
            <div className="rounded-xl border border-accent/20 bg-accent-soft p-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm text-ink">{selectedMeal.name}</p>
                <Badge variant="info">{selectedMeal.servingDescription}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted">
                Base per serving: {selectedMeal.calories} kcal · {selectedMeal.proteinG}g P ·{' '}
                {selectedMeal.carbsG}g C · {selectedMeal.fatG}g F
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Portion size (%)"
              type="number"
              min="1"
              step="5"
              value={portionPercent}
              onChange={(e) => setPortionPercent(e.currentTarget.value)}
              helperText="100% = 1 full serving"
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
                Scaled Nutrition Snapshot
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
        </div>
      </Modal>

      <SavedMealModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSave={handleCreatedMeal}
      />
    </>
  )
}

export default LogMealModal
