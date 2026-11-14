import { useEffect, useMemo, useState } from 'react'
import { Mic, MicOff, Plus, Search, Sparkles, Utensils } from 'lucide-react'
import { Button, Input, Modal } from '../../../components/common'
import { formatLocalDate } from '../../../lib/dateTime'
import { scaleNutrition } from '../../../lib/nutrition'
import {
  fetchSavedMeals,
  MEAL_TITLES,
  MEAL_TYPES,
} from '../nutritionService'
import type { MealType, SavedMeal } from '../types'
import SavedMealModal from './SavedMealModal'
import {
  parseMealMessage,
  saveAiMeal,
} from '../../ai-logger/aiLoggerService'
import { ParsedMealPreview } from '../../ai-logger/components/ParsedMealPreview'
import { useVoiceDictation } from '../../workouts/useVoiceDictation'
import type { ConfirmedMeal, ParsedMeal } from '../../ai-logger/types'

export type MealLogModalTab = 'direct' | 'library' | 'ai'

interface LogMealModalProps {
  open: boolean
  onClose: () => void
  initialDate?: string
  initialMealType?: MealType
  initialTab?: MealLogModalTab
  initialMeal?: SavedMeal | null
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
  onLogAiSuccess?: () => void | Promise<void>
}

function LogMealDialog({
  onClose,
  initialDate,
  initialMealType = 'breakfast',
  initialTab = 'direct',
  initialMeal,
  onLogMeal,
  onCreateSavedMeal,
  onLogAiSuccess,
}: Omit<LogMealModalProps, 'open'>) {
  const [activeTab, setActiveTab] = useState<MealLogModalTab>(initialTab)
  const [mealType, setMealType] = useState<MealType>(initialMealType)
  const [date, setDate] = useState(() => initialDate ?? formatLocalDate(new Date()))
  const todayStr = useMemo(() => formatLocalDate(new Date()), [])
  const [time, setTime] = useState(() => {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Direct quick log state
  const [directName, setDirectName] = useState('')
  const [directCalories, setDirectCalories] = useState('')
  const [directProtein, setDirectProtein] = useState('')
  const [directCarbs, setDirectCarbs] = useState('')
  const [directFat, setDirectFat] = useState('')

  // Saved meals library state
  const [query, setQuery] = useState('')
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([])
  const [loadingMeals, setLoadingMeals] = useState(true)
  const [selectedMeal, setSelectedMeal] = useState<SavedMeal | null>(
    () => initialMeal ?? null,
  )
  const [portionPercent, setPortionPercent] = useState('100')
  const [createModalOpen, setCreateModalOpen] = useState(false)

  // AI Quick Log State
  const [aiPrompt, setAiPrompt] = useState('')
  const [parsingAi, setParsingAi] = useState(false)
  const [parsedMeal, setParsedMeal] = useState<ParsedMeal | null>(null)
  const [savingAi, setSavingAi] = useState(false)

  const {
    isListening,
    isSupported,
    error: voiceError,
    toggleListening,
    stopListening,
    clearError: clearVoiceError,
  } = useVoiceDictation((transcript) => {
    setAiPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript))
  })

  useEffect(() => {
    let cancelled = false

    void fetchSavedMeals('')
      .then((meals) => {
        if (!cancelled && meals) {
          setSavedMeals(meals)
          setSelectedMeal((previous) =>
            meals.find((meal) => meal.id === previous?.id) ?? initialMeal ?? meals[0] ?? null,
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
  }, [initialMeal])

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

  const computeConsumedIsoString = (): string | null => {
    if (!date) return null
    const [hours, minutes] = (time || '12:00').split(':').map(Number)
    const [year, dayMonth, day] = date.split('-').map(Number)
    const consumedDate = new Date(year, dayMonth - 1, day, hours, minutes, 0, 0)
    if (Number.isNaN(consumedDate.getTime())) return null
    return consumedDate.toISOString()
  }

  const handleDirectSubmit = async () => {
    if (saving) return
    const nameTrimmed = directName.trim()
    if (!nameTrimmed) {
      setError('Please enter a meal name (e.g. Chicken & Rice).')
      return
    }

    const cal = Number(directCalories)
    if (!directCalories.trim() || !Number.isFinite(cal) || cal < 0) {
      setError('Please enter a valid calorie amount (0 or greater).')
      return
    }

    const prot = Number(directProtein) || 0
    const carbs = Number(directCarbs) || 0
    const fat = Number(directFat) || 0

    const consumedAt = computeConsumedIsoString()
    if (!consumedAt) {
      setError('Invalid date or time.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const meal = await onCreateSavedMeal({
        name: nameTrimmed,
        servingDescription: '1 serving',
        calorieSource: 'manual',
        calories: Math.round(cal),
        proteinG: Math.round(prot),
        carbsG: Math.round(carbs),
        fatG: Math.round(fat),
      })

      await onLogMeal({
        savedMealId: meal.id,
        consumedAt,
        mealType,
        portionPercent: 100,
      })
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to log meal.')
    } finally {
      setSaving(false)
    }
  }

  const handleLibraryLog = async () => {
    if (saving) return
    if (!selectedMeal) {
      setError('Please select a meal from your saved meals library.')
      return
    }
    if (!Number.isFinite(parsedPortion) || parsedPortion <= 0) {
      setError('Portion percentage must be a positive number (e.g. 100).')
      return
    }

    const consumedAt = computeConsumedIsoString()
    if (!consumedAt) {
      setError('Invalid date or time.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onLogMeal({
        savedMealId: selectedMeal.id,
        consumedAt,
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

  const handleAiParse = async () => {
    const trimmed = aiPrompt.trim()
    if (!trimmed || parsingAi) return

    stopListening()
    clearVoiceError()
    setParsingAi(true)
    setError(null)
    try {
      const parsed = await parseMealMessage(trimmed)
      const normalizedItems = (parsed.meals && parsed.meals.length > 0)
        ? parsed.meals.map((m) => ({ ...m, mealType: m.mealType || mealType }))
        : [
            {
              mealName: parsed.mealName || 'Meal',
              mealType: parsed.mealType || mealType,
              servingDescription: parsed.servingDescription || '1 serving',
              calories: parsed.calories ?? 0,
              proteinG: parsed.proteinG ?? 0,
              carbsG: parsed.carbsG ?? 0,
              fatG: parsed.fatG ?? 0,
              notes: parsed.notes || null,
            },
          ]

      setParsedMeal({
        ...parsed,
        mealType: parsed.mealType || mealType,
        meals: normalizedItems,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse meal with AI.')
    } finally {
      setParsingAi(false)
    }
  }

  const handleAiConfirm = async (confirmed: ConfirmedMeal) => {
    if (savingAi) return
    const consumedAt = computeConsumedIsoString() || new Date().toISOString()

    setSavingAi(true)
    setError(null)
    try {
      const payload: ConfirmedMeal = {
        ...confirmed,
        consumedAt,
        mealType: confirmed.mealType || mealType,
        meals: confirmed.meals?.map((m) => ({
          ...m,
          mealType: m.mealType || mealType,
          consumedAt: m.consumedAt || consumedAt,
        })),
      }

      await saveAiMeal(payload)
      if (onLogAiSuccess) {
        await onLogAiSuccess()
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save AI meal.')
    } finally {
      setSavingAi(false)
    }
  }

  const handleCreatedSavedMeal = async (newMealInput: {
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

  const renderFooter = () => {
    if (activeTab === 'ai') {
      if (parsedMeal) {
        return undefined
      }
      return (
        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button variant="ghost" disabled={parsingAi} onClick={onClose}>
            Cancel
          </Button>
          <Button
            icon={Sparkles}
            loading={parsingAi}
            disabled={parsingAi || !aiPrompt.trim()}
            onClick={() => void handleAiParse()}
          >
            Parse with AI
          </Button>
        </div>
      )
    }

    if (activeTab === 'direct') {
      return (
        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button variant="ghost" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            disabled={saving || !directName.trim() || !directCalories.trim()}
            onClick={() => void handleDirectSubmit()}
          >
            Log Meal
          </Button>
        </div>
      )
    }

    return (
      <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
        <Button variant="ghost" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button
          loading={saving}
          disabled={saving || !selectedMeal}
          onClick={() => void handleLibraryLog()}
        >
          Log from Library
        </Button>
      </div>
    )
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        closeBlocked={saving || savingAi || parsingAi}
        title="Log a Meal"
        footer={renderFooter()}
      >
        <div className="space-y-4">
          {(error || voiceError) && (
            <div
              role="alert"
              className="flex items-start justify-between gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-xs text-danger"
            >
              <span>{voiceError || error}</span>
              {voiceError && (
                <button
                  type="button"
                  onClick={clearVoiceError}
                  className="shrink-0 text-danger hover:opacity-80"
                  aria-label="Dismiss voice error"
                >
                  &times;
                </button>
              )}
            </div>
          )}

          {/* Tab Selector */}
          <div className="flex border-b border-line gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('direct')}
              className={`flex items-center gap-1.5 pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'direct'
                  ? 'border-accent text-accent font-semibold'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              <Utensils className="size-4" />
              <span>Quick Entry</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`flex items-center gap-1.5 pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'library'
                  ? 'border-accent text-accent font-semibold'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              <Search className="size-4" />
              <span>Saved Meals</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-1.5 pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'ai'
                  ? 'border-accent text-accent font-semibold'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              <Sparkles className="size-4" />
              <span>Log with AI</span>
            </button>
          </div>

          {/* Common Details: Meal Type, Date, Time */}
          <div className="space-y-3 rounded-xl border border-line bg-surface/60 p-3">
            {/* Meal Type selection */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                Meal Category
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {MEAL_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMealType(type)}
                    className={`rounded-lg py-1.5 text-xs font-medium transition-all ${
                      mealType === type
                        ? 'bg-accent text-accent-fg font-semibold shadow-sm'
                        : 'border border-line bg-surface text-muted hover:bg-hover hover:text-ink'
                    }`}
                  >
                    {MEAL_TITLES[type]}
                  </button>
                ))}
              </div>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Date"
                type="date"
                value={date}
                max={todayStr}
                onChange={(e) => setDate(e.target.value)}
              />
              <Input
                label="Time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          {/* TAB 1: DIRECT QUICK ENTRY */}
          {activeTab === 'direct' && (
            <div className="space-y-3">
              <Input
                label="Food or Meal Name"
                placeholder="e.g. Oatmeal with protein powder & blueberries"
                value={directName}
                onChange={(e) => setDirectName(e.target.value)}
                autoFocus
              />

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Input
                  label="Calories (kcal)"
                  type="number"
                  min="0"
                  placeholder="e.g. 450"
                  value={directCalories}
                  onChange={(e) => setDirectCalories(e.target.value)}
                />
                <Input
                  label="Protein (g)"
                  type="number"
                  min="0"
                  placeholder="e.g. 35"
                  value={directProtein}
                  onChange={(e) => setDirectProtein(e.target.value)}
                />
                <Input
                  label="Carbs (g)"
                  type="number"
                  min="0"
                  placeholder="e.g. 45"
                  value={directCarbs}
                  onChange={(e) => setDirectCarbs(e.target.value)}
                />
                <Input
                  label="Fat (g)"
                  type="number"
                  min="0"
                  placeholder="e.g. 10"
                  value={directFat}
                  onChange={(e) => setDirectFat(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* TAB 2: SAVED MEALS LIBRARY */}
          {activeTab === 'library' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    label="Search Saved Meals"
                    placeholder="Search by name…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    icon={Plus}
                    onClick={() => setCreateModalOpen(true)}
                  >
                    New
                  </Button>
                </div>
              </div>

              {loadingMeals ? (
                <p className="py-6 text-center text-sm text-muted">
                  Loading saved meals…
                </p>
              ) : filteredMeals.length === 0 ? (
                <div className="rounded-xl border border-line bg-surface p-6 text-center">
                  <p className="text-sm font-semibold text-ink">No saved meals found</p>
                  <p className="mt-1 text-xs text-muted">
                    Switch to Quick Entry tab or create a saved meal.
                  </p>
                  <Button
                    size="small"
                    className="mt-3"
                    onClick={() => setActiveTab('direct')}
                  >
                    Use Quick Entry
                  </Button>
                </div>
              ) : (
                <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                  {filteredMeals.map((meal) => {
                    const isSelected = selectedMeal?.id === meal.id
                    return (
                      <button
                        key={meal.id}
                        type="button"
                        onClick={() => setSelectedMeal(meal)}
                        className={`w-full rounded-xl border p-2.5 text-left transition-all ${
                          isSelected
                            ? 'border-accent bg-accent/10 ring-1 ring-accent'
                            : 'border-line bg-surface hover:bg-hover'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-ink">{meal.name}</p>
                          <span className="text-xs font-semibold text-accent">
                            {meal.calories} kcal
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted">
                          {meal.proteinG}g P · {meal.carbsG}g C · {meal.fatG}g F
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}

              {selectedMeal && (
                <div className="rounded-xl border border-line bg-surface p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink">Selected: {selectedMeal.name}</span>
                    <span className="text-xs text-muted">Base: {selectedMeal.calories} kcal</span>
                  </div>
                  <Input
                    label="Portion (%)"
                    type="number"
                    min="1"
                    step="5"
                    value={portionPercent}
                    onChange={(e) => setPortionPercent(e.target.value)}
                  />
                  {scaledNutrition && (
                    <p className="text-xs text-accent font-medium">
                      Portion totals: {Math.round(scaledNutrition.calories)} kcal ·{' '}
                      {Math.round(scaledNutrition.proteinG)}g P ·{' '}
                      {Math.round(scaledNutrition.carbsG)}g C ·{' '}
                      {Math.round(scaledNutrition.fatG)}g F
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LOG WITH AI */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              {!parsedMeal ? (
                <div className="space-y-3">
                  <div className="relative">
                    <textarea
                      rows={3}
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="e.g. 2 eggs, 2 slices toast with butter, and a glass of milk"
                      className="w-full resize-none rounded-xl border border-line bg-surface p-3 text-sm text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent"
                    />
                    {isSupported && (
                      <button
                        type="button"
                        onClick={toggleListening}
                        className={`absolute bottom-2.5 right-2.5 flex size-8 items-center justify-center rounded-lg transition-colors ${
                          isListening
                            ? 'bg-red-500 text-white animate-pulse'
                            : 'bg-surface border border-line text-muted hover:text-ink'
                        }`}
                      >
                        {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <ParsedMealPreview
                  meal={parsedMeal}
                  onConfirm={handleAiConfirm}
                  onCancel={() => setParsedMeal(null)}
                  saving={savingAi}
                />
              )}
            </div>
          )}
        </div>
      </Modal>

      {createModalOpen && (
        <SavedMealModal
          open
          onClose={() => setCreateModalOpen(false)}
          onSave={handleCreatedSavedMeal}
        />
      )}
    </>
  )
}

export function LogMealModal(props: LogMealModalProps) {
  if (!props.open) return null
  return <LogMealDialog {...props} />
}

export default LogMealModal
