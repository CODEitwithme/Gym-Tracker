import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Edit2, Plus, Trash2, UtensilsCrossed } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Input, Modal } from '../../components/common'
import PageContainer from '../../components/layout/PageContainer'
import SavedMealModal from './components/SavedMealModal'
import LogMealModal from './components/LogMealModal'
import {
  createMeal,
  editSavedMeal,
  fetchSavedMeals,
  logMeal,
  removeSavedMeal,
} from './nutritionService'
import type { SavedMeal } from './types'

function SavedMealsPage() {
  const [meals, setMeals] = useState<SavedMeal[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMeal, setEditingMeal] = useState<SavedMeal | null>(null)
  const [mealToDelete, setMealToDelete] = useState<SavedMeal | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [quickLogMeal, setQuickLogMeal] = useState<SavedMeal | null>(null)
  const latestRequestId = useRef(0)

  const loadMeals = useCallback(async (searchQuery: string) => {
    const requestId = ++latestRequestId.current
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSavedMeals(searchQuery)
      if (requestId === latestRequestId.current) setMeals(data)
    } catch (loadError) {
      if (requestId === latestRequestId.current) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load saved meals library.',
        )
      }
    } finally {
      if (requestId === latestRequestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.resolve().then(() => {
      if (!cancelled) void loadMeals(query)
    })
    return () => {
      cancelled = true
      latestRequestId.current += 1
    }
  }, [loadMeals, query])

  const handleSaveMeal = async (input: {
    name: string
    servingDescription: string
    calorieSource: 'manual' | 'macro_estimate'
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }) => {
    if (editingMeal) {
      await editSavedMeal(editingMeal.id, input)
    } else {
      await createMeal(input)
    }
    await loadMeals(query)
  }

  const handleDeleteMeal = async () => {
    if (!mealToDelete || deleting) return
    setDeleting(true)
    try {
      await removeSavedMeal(mealToDelete.id)
      setMealToDelete(null)
      await loadMeals(query)
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete saved meal.',
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <PageContainer>
      <Link
        to="/nutrition"
        className="mb-5 inline-flex items-center gap-2 rounded-md text-sm font-medium text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        <ArrowLeft aria-hidden="true" size={16} />
        Back to Nutrition
      </Link>

      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm font-medium text-accent">Nutrition Library</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Saved Meals
          </h1>
          <p className="mt-2 text-sm text-muted">
            Manage your reusable meals, base portions, and nutritional information.
          </p>
        </div>
        <Button
          size="large"
          icon={Plus}
          onClick={() => {
            setEditingMeal(null)
            setIsModalOpen(true)
          }}
        >
          New Saved Meal
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 flex flex-col justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center"
        >
          <p>{error}</p>
          <Button
            size="small"
            variant="outline"
            onClick={() => void loadMeals(query)}
          >
            Retry
          </Button>
        </div>
      )}

      <div className="mb-6 max-w-md">
        <Input
          type="search"
          label="Search meals"
          placeholder="Search by name…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
      </div>

      {loading ? (
        <p role="status" className="py-16 text-center text-sm text-muted">
          Loading saved meals…
        </p>
      ) : error && meals.length === 0 ? null : meals.length === 0 ? (
        <Card>
          <EmptyState
            icon={UtensilsCrossed}
            title={query ? 'No matching saved meals' : 'No saved meals yet'}
            description={
              query
                ? `No meals matched "${query}". Clear the search or create a new meal.`
                : 'Create your first saved meal to quickly log it into your daily nutrition.'
            }
            action={
              <Button
                icon={Plus}
                onClick={() => {
                  setEditingMeal(null)
                  setIsModalOpen(true)
                }}
              >
                Create Saved Meal
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {meals.map((meal) => (
            <Card key={meal.id} className="flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="break-words font-semibold text-ink">{meal.name}</h2>
                    <p className="break-words text-xs text-muted">{meal.servingDescription}</p>
                  </div>
                  <Badge
                    variant={
                      meal.calorieSource === 'macro_estimate'
                        ? 'default'
                        : 'info'
                    }
                  >
                    {meal.calorieSource === 'macro_estimate'
                      ? 'Macro est.'
                      : 'Manual cal'}
                  </Badge>
                </div>

                <div className="rounded-xl border border-line bg-surface p-3 text-center">
                  <p className="text-2xl font-bold text-ink">
                    {meal.calories}{' '}
                    <span className="text-xs font-normal text-muted">kcal</span>
                  </p>
                  <div className="mt-2 grid grid-cols-3 divide-x divide-line text-xs">
                    <div>
                      <p className="font-semibold text-ink">{meal.proteinG}g</p>
                      <p className="text-[10px] text-muted">Protein</p>
                    </div>
                    <div>
                      <p className="font-semibold text-ink">{meal.carbsG}g</p>
                      <p className="text-[10px] text-muted">Carbs</p>
                    </div>
                    <div>
                      <p className="font-semibold text-ink">{meal.fatG}g</p>
                      <p className="text-[10px] text-muted">Fat</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <Button
                  size="small"
                  variant="outline"
                  onClick={() => setQuickLogMeal(meal)}
                >
                  Log meal
                </Button>
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label={`Edit ${meal.name}`}
                    onClick={() => {
                      setEditingMeal(meal)
                      setIsModalOpen(true)
                    }}
                    className="flex size-11 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <Edit2 aria-hidden="true" size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${meal.name}`}
                    onClick={() => setMealToDelete(meal)}
                    className="flex size-11 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-500"
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SavedMealModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialMeal={editingMeal}
        onSave={handleSaveMeal}
      />

      {quickLogMeal && (
        <LogMealModal
          open={Boolean(quickLogMeal)}
          onClose={() => setQuickLogMeal(null)}
          onLogMeal={async (logInput) => {
            await logMeal(logInput)
          }}
          onCreateSavedMeal={createMeal}
        />
      )}

      <Modal
        open={Boolean(mealToDelete)}
        onClose={() => setMealToDelete(null)}
        closeBlocked={deleting}
        title="Delete Saved Meal"
        footer={
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button
              variant="ghost"
              disabled={deleting}
              onClick={() => setMealToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              disabled={deleting}
              onClick={() => void handleDeleteMeal()}
            >
              Delete meal
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <p className="text-sm text-ink">
            Are you sure you want to delete{' '}
            <span className="font-semibold">{mealToDelete?.name}</span>?
          </p>
          <p className="text-xs text-muted">
            Existing meal logs that already used this meal will keep their
            historical snapshot and will not be deleted.
          </p>
        </div>
      </Modal>
    </PageContainer>
  )
}

export default SavedMealsPage
