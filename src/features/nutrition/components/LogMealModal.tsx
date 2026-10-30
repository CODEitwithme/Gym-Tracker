import { useEffect, useMemo, useState } from 'react'
import { Mic, MicOff, Plus, Search, Sparkles } from 'lucide-react'
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
import {
  parseMealMessage,
  saveAiMeal,
} from '../../ai-logger/aiLoggerService'
import { ParsedMealPreview } from '../../ai-logger/components/ParsedMealPreview'
import { useVoiceDictation } from '../../workouts/useVoiceDictation'
import type { ConfirmedMeal, ParsedMeal } from '../../ai-logger/types'

interface LogMealModalProps {
  open: boolean
  onClose: () => void
  initialDate?: string
  initialMealType?: MealType
  initialTab?: 'ai' | 'library'
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

function LogMealModal({
  open,
  onClose,
  initialDate,
  initialMealType = 'breakfast',
  initialTab = 'library',
  onLogMeal,
  onCreateSavedMeal,
  onLogAiSuccess,
}: LogMealModalProps) {
  const [activeTab, setActiveTab] = useState<'ai' | 'library'>(initialTab)
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
    if (!open) {
      stopListening()
      return
    }
    stopListening()
    clearVoiceError()
    let cancelled = false

    setActiveTab(initialTab)
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
    setAiPrompt('')
    setParsedMeal(null)
    setParsingAi(false)
    setSavingAi(false)

    void Promise.resolve()
      .then(() => {
        if (cancelled) return undefined
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
  }, [open, initialDate, initialMealType, initialTab, stopListening, clearVoiceError])

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
    const [year, month, day] = date.split('-').map(Number)
    const consumedDate = new Date(year, month - 1, day, hours, minutes, 0, 0)
    if (Number.isNaN(consumedDate.getTime())) return null
    return consumedDate.toISOString()
  }

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

  const renderFooter = () => {
    if (activeTab === 'ai') {
      if (parsedMeal) {
        // ParsedMealPreview provides its own Confirm and Cancel buttons
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

    return (
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
    )
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        closeBlocked={saving || savingAi || parsingAi}
        title="Log a Meal"
        footer={renderFooter()}
      >
        <div className="space-y-4">
          {(error || voiceError) && (
            <div
              role="alert"
              className="flex items-start justify-between gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300"
            >
              <span>{voiceError || error}</span>
              {voiceError && (
                <button
                  type="button"
                  onClick={clearVoiceError}
                  className="shrink-0 text-red-400 hover:text-red-200"
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
              onClick={() => setActiveTab('library')}
              className={`flex items-center gap-2 pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'library'
                  ? 'border-accent text-accent font-semibold'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              <Search className="size-4" />
              Saved & Custom
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-2 pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'ai'
                  ? 'border-accent text-accent font-semibold'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              <Sparkles className="size-4" />
              AI Quick Log
            </button>
          </div>

          {/* Common Date & Category selectors */}
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

          {/* AI Quick Log Tab Body */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              {parsedMeal ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink">
                      Review & adjust detected meals
                    </p>
                    <button
                      type="button"
                      onClick={() => setParsedMeal(null)}
                      className="text-xs text-accent hover:underline"
                    >
                      Edit prompt
                    </button>
                  </div>
                  <ParsedMealPreview
                    meal={parsedMeal}
                    saving={savingAi}
                    onCancel={() => setParsedMeal(null)}
                    onConfirm={(confirmed) => void handleAiConfirm(confirmed)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="ai-meal-prompt"
                      className="block text-sm font-medium text-ink"
                    >
                      Describe what you ate
                    </label>
                    <button
                      type="button"
                      onClick={toggleListening}
                      title={
                        !isSupported
                          ? 'Voice dictation is not supported in this browser. Please use Chrome, Edge, Safari, or device keyboard dictation.'
                          : isListening
                            ? 'Listening... Click to stop'
                            : 'Dictate meal with microphone'
                      }
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                        isListening
                          ? 'bg-rose-500 text-white animate-pulse ring-2 ring-rose-400/50'
                          : 'bg-accent-soft text-accent hover:bg-accent/20'
                      }`}
                    >
                      {isListening ? (
                        <>
                          <MicOff className="size-3.5" />
                          Listening... Stop
                        </>
                      ) : (
                        <>
                          <Mic className="size-3.5" />
                          Voice Dictation
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    id="ai-meal-prompt"
                    rows={4}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. 2 whole eggs scrambled, 2 slices of whole wheat toast with butter, and 1 large banana"
                    className="w-full rounded-xl border border-line bg-panel p-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        void handleAiParse()
                      }
                    }}
                  />
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>Tip: Mention portions (e.g. grams, slices, cups).</span>
                    <span>Ctrl + Enter to parse</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Library / Custom Tab Body */}
          {activeTab === 'library' && (
            <>
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
            </>
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
