import { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import type { FormEvent } from 'react'
import type { Exercise, ExerciseCategory } from '../types'
import { findExercises } from '../workoutService'
import { Button, Input, Modal } from '../../../components/common'

type ExercisePickerModalProps = {
  open: boolean
  onClose: () => void
  existingExerciseIds: string[]
  onAdd: (exercise: Exercise) => Promise<void>
  onCreateAndAdd: (input: {
    name: string
    category: ExerciseCategory
    equipment: string | null
  }) => Promise<void>
}

const categories: ExerciseCategory[] = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'cardio',
  'other',
]

function isExerciseCategory(value: string): value is ExerciseCategory {
  return categories.some((categoryOption) => categoryOption === value)
}

function formatCategory(category: ExerciseCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1)
}

function ExercisePickerModal({
  open,
  onClose,
  existingExerciseIds,
  onAdd,
  onCreateAndAdd,
}: ExercisePickerModalProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ExerciseCategory>('other')
  const [filterCategory, setFilterCategory] = useState<
    ExerciseCategory | 'all'
  >('all')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const existingIds = useMemo(
    () => new Set(existingExerciseIds),
    [existingExerciseIds],
  )
  const visibleExercises = exercises.filter(
    (exercise) =>
      filterCategory === 'all' || exercise.category === filterCategory,
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void Promise.resolve()
      .then(() => {
        if (cancelled) return undefined
        setLoading(true)
        return findExercises(query)
      })
      .then((results) => {
        if (results && !cancelled) setExercises(results)
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load exercises.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, query])

  const addExercise = async (exercise: Exercise) => {
    if (existingIds.has(exercise.id) || addingId !== null) return
    setAddingId(exercise.id)
    setError(null)
    try {
      await onAdd(exercise)
    } catch (addError) {
      setError(
        addError instanceof Error ? addError.message : 'Could not add exercise.',
      )
    } finally {
      setAddingId(null)
    }
  }

  const createExercise = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (creating) return
    const formData = new FormData(event.currentTarget)
    const name = String(formData.get('exerciseName') ?? '').trim()
    const equipmentValue = String(formData.get('equipment') ?? '').trim()
    setCreating(true)
    setError(null)
    try {
      await onCreateAndAdd({
        name,
        category,
        equipment: equipmentValue || null,
      })
      setQuery('')
      onClose()
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Could not create exercise.',
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add an exercise">
      <div className="space-y-5">
        <Input
          label="Search exercise library"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search by name"
          autoComplete="off"
          type="search"
          aria-label="Search exercise library"
        />
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Filter by category
          <select
            value={filterCategory}
            onChange={(event) => {
              const value = event.currentTarget.value
              if (value === 'all' || isExerciseCategory(value)) {
                setFilterCategory(value)
              }
            }}
            className="min-h-10 rounded-lg border border-line bg-panel px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option value={item} key={item}>
                {formatCategory(item)}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {loading ? (
          <p className="py-4 text-center text-sm text-muted">
            Loading exercises…
          </p>
        ) : visibleExercises.length ? (
          <ul className="max-h-52 divide-y divide-line overflow-y-auto rounded-xl border border-line">
            {visibleExercises.map((exercise) => {
              const alreadyAdded = existingIds.has(exercise.id)
              return (
                <li
                  key={exercise.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {exercise.name}
                    </p>
                    <p className="text-xs text-muted">
                      {formatCategory(exercise.category)}
                      {exercise.equipment ? ` · ${exercise.equipment}` : ''}
                    </p>
                  </div>
                  <Button
                    size="small"
                    variant="outline"
                    icon={Plus}
                    disabled={alreadyAdded || addingId !== null}
                    loading={addingId === exercise.id}
                    onClick={() => void addExercise(exercise)}
                  >
                    {alreadyAdded ? 'Added' : 'Add'}
                  </Button>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="rounded-xl bg-surface px-4 py-5 text-center">
            <Search aria-hidden="true" className="mx-auto text-muted" size={20} />
            <p className="mt-2 text-sm font-medium text-ink">
              No matching exercises
            </p>
            <p className="mt-1 text-xs text-muted">
              Create a custom exercise below.
            </p>
          </div>
        )}
        <form
          onSubmit={(event) => void createExercise(event)}
          className="space-y-3 border-t border-line pt-5"
        >
          <h3 className="text-sm font-semibold text-ink">Create custom exercise</h3>
          <Input
            name="exerciseName"
            label="Exercise name"
            placeholder="Required"
            required
            maxLength={100}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              Category
              <select
                value={category}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  if (isExerciseCategory(value)) setCategory(value)
                }}
                className="min-h-10 rounded-lg border border-line bg-panel px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              >
                {categories.map((item) => (
                  <option value={item} key={item}>
                    {formatCategory(item)}
                  </option>
                ))}
              </select>
            </label>
            <Input
              name="equipment"
              label="Equipment (optional)"
              placeholder="e.g. Dumbbell"
              maxLength={80}
            />
          </div>
          <Button type="submit" size="medium" loading={creating}>
            Create and add
          </Button>
        </form>
      </div>
    </Modal>
  )
}

export default ExercisePickerModal
