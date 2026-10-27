import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Apple,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
  Utensils,
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { Badge, Button, Card, EmptyState, Modal } from '../../components/common'
import PageContainer from '../../components/layout/PageContainer'
import { formatLocalDate } from '../../lib/dateTime'
import {
  clearNutritionError,
  setNutritionError,
  setSelectedDate,
} from './nutritionSlice'
import {
  createMeal,
  editMealLog,
  getSavedNutritionGoals,
  loadDailyNutrition,
  logMeal,
  MEAL_TYPES,
  removeMealLog,
  saveNutritionGoals,
} from './nutritionService'
import type {
  DailyNutritionGoals,
  DailyNutritionSummary,
  MealLog,
  MealType,
} from './types'
import LogMealModal from './components/LogMealModal'
import EditMealLogModal from './components/EditMealLogModal'
import GoalsModal from './components/GoalsModal'

function formatDateDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

function getDateRelativeBadge(dateStr: string): string | null {
  const todayStr = formatLocalDate(new Date())
  if (dateStr === todayStr) return 'Today'

  const [y, m, d] = dateStr.split('-').map(Number)
  const [ty, tm, td] = todayStr.split('-').map(Number)
  const current = new Date(y, m - 1, d).getTime()
  const today = new Date(ty, tm - 1, td).getTime()
  const diffDays = Math.round((current - today) / (1000 * 60 * 60 * 24))

  if (diffDays === -1) return 'Yesterday'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays > 1) return 'Future'
  return null
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString)
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(d)
  } catch {
    return ''
  }
}

function shiftDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day + days)
  return formatLocalDate(d)
}

function NutritionPage() {
  const dispatch = useAppDispatch()
  const selectedDate = useAppSelector(
    (state) => state.nutritionUi.selectedDate,
  )
  const reduxError = useAppSelector((state) => state.nutritionUi.error)

  const [todayDate] = useState(() => formatLocalDate(new Date()))
  const [summary, setSummary] = useState<DailyNutritionSummary | null>(null)
  const [summaryDate, setSummaryDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState<DailyNutritionGoals | null>(() =>
    getSavedNutritionGoals(),
  )
  const [isGoalsModalOpen, setIsGoalsModalOpen] = useState(false)
  const [logModalOpen, setLogModalOpen] = useState(false)
  const [logMealType, setLogMealType] = useState<MealType>('breakfast')
  const [editingLog, setEditingLog] = useState<MealLog | null>(null)
  const [logToDelete, setLogToDelete] = useState<MealLog | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Stale-request guarding
  const latestRequestId = useRef(0)

  const loadData = useCallback(async (dateToLoad: string) => {
    const requestId = ++latestRequestId.current
    setLoading(true)
    setSummary(null)
    setSummaryDate(null)
    dispatch(clearNutritionError())
    try {
      const data = await loadDailyNutrition(dateToLoad)
      if (requestId === latestRequestId.current) {
        setSummary(data)
        setSummaryDate(dateToLoad)
      }
    } catch (loadError) {
      if (requestId === latestRequestId.current) {
        dispatch(
          setNutritionError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load nutrition logs for this date.',
          ),
        )
      }
    } finally {
      if (requestId === latestRequestId.current) {
        setLoading(false)
      }
    }
  }, [dispatch])

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadData(selectedDate)
    })
  }, [selectedDate, loadData])

  const handleDateChange = (newDate: string) => {
    dispatch(setSelectedDate(newDate))
  }

  const handleSaveGoals = (newGoals: DailyNutritionGoals) => {
    const persisted = saveNutritionGoals(newGoals)
    setGoals(newGoals)
    return persisted
  }

  const handleDeleteLog = async () => {
    if (!logToDelete || deleting) return
    setDeleting(true)
    try {
      await removeMealLog(logToDelete.id)
      setLogToDelete(null)
      await loadData(selectedDate)
    } catch (err) {
      dispatch(
        setNutritionError(
          err instanceof Error ? err.message : 'Failed to delete meal log.',
        ),
      )
    } finally {
      setDeleting(false)
    }
  }

  const relativeBadge = getDateRelativeBadge(selectedDate)
  const currentSummary = summaryDate === selectedDate ? summary : null

  return (
    <PageContainer>
      {/* Page Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm font-medium text-accent">Diet & Fuel</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Nutrition
          </h1>
          <p className="mt-2 text-sm text-muted">
            Track daily meals, calories, and macronutrients.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/ai-logger?mode=nutrition">
            <Button variant="outline" icon={Sparkles}>
              Log with AI
            </Button>
          </Link>
          <Link to="/nutrition/meals">
            <Button variant="outline" icon={Utensils}>
              Saved meals
            </Button>
          </Link>
          <Button
            icon={Plus}
            onClick={() => {
              setLogMealType('breakfast')
              setLogModalOpen(true)
            }}
          >
            Log meal
          </Button>
        </div>
      </div>

      {reduxError && (
        <div
          role="alert"
          className="mb-6 flex flex-col justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center"
        >
          <p>{reduxError}</p>
          <Button
            size="small"
            variant="outline"
            onClick={() => void loadData(selectedDate)}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Date Navigation Bar */}
      <Card className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => handleDateChange(shiftDate(selectedDate, -1))}
              className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-line text-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              <ChevronLeft aria-hidden="true" size={18} />
            </button>
            <button
              type="button"
              aria-label="Next day"
              onClick={() => handleDateChange(shiftDate(selectedDate, 1))}
              className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-line text-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              <ChevronRight aria-hidden="true" size={18} />
            </button>
            <div className="flex items-center gap-2.5">
              <CalendarIcon aria-hidden="true" size={18} className="text-accent" />
              <span className="font-semibold text-ink sm:text-lg">
                {formatDateDisplay(selectedDate)}
              </span>
              {relativeBadge && (
                <Badge
                  variant={
                    relativeBadge === 'Today'
                      ? 'success'
                      : relativeBadge === 'Future'
                        ? 'warning'
                        : 'default'
                  }
                >
                  {relativeBadge}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedDate !== todayDate && (
              <Button
                size="small"
                variant="outline"
                icon={RotateCcw}
                onClick={() => handleDateChange(todayDate)}
              >
                Today
              </Button>
            )}
            <label
              htmlFor="jump-date"
              className="sr-only"
            >
              Jump to date
            </label>
            <input
              id="jump-date"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.currentTarget.value) {
                  handleDateChange(e.currentTarget.value)
                }
              }}
              className="min-h-9 rounded-lg border border-line bg-panel px-2.5 py-1 text-xs text-ink focus-visible:outline-2 focus-visible:outline-accent"
            />
          </div>
        </div>
      </Card>

      {/* Daily Nutrition Summary Card */}
      <Card
        className="mb-8"
        title="Daily Nutrition Summary"
        description={`Totals calculated from all active logs for ${selectedDate}.`}
        actions={
          <Button
            size="small"
            variant="ghost"
            icon={Target}
            onClick={() => setIsGoalsModalOpen(true)}
          >
            {goals ? 'Edit targets' : 'Set daily targets'}
          </Button>
        }
      >
        {loading ? (
          <p role="status" className="py-8 text-center text-sm text-muted">
            Calculating daily totals…
          </p>
        ) : reduxError ? (
          <p className="py-8 text-center text-sm text-muted">
            Daily totals are unavailable until the data can be loaded.
          </p>
        ) : currentSummary ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryMetric
                label="Calories"
                consumed={currentSummary.totals.calories}
                target={goals?.calories}
                unit="kcal"
              />
              <SummaryMetric
                label="Protein"
                consumed={currentSummary.totals.proteinG}
                target={goals?.proteinG}
                unit="g"
              />
              <SummaryMetric
                label="Carbohydrates"
                consumed={currentSummary.totals.carbsG}
                target={goals?.carbsG}
                unit="g"
              />
              <SummaryMetric
                label="Fat"
                consumed={currentSummary.totals.fatG}
                target={goals?.fatG}
                unit="g"
              />
            </div>
          </div>
        ) : null}
      </Card>

      {/* Meal Sections */}
      {loading ? (
        <p role="status" className="py-8 text-center text-sm text-muted">
          Loading meals for this date…
        </p>
      ) : currentSummary ? (
      <div className="space-y-6">
        {MEAL_TYPES.map((type) => {
          const section = currentSummary.sections[type]
          const logs = section?.logs ?? []
          const totals = section?.totals ?? {
            calories: 0,
            proteinG: 0,
            carbsG: 0,
            fatG: 0,
          }

          return (
            <Card
              key={type}
              title={`${section?.title ?? type} (${logs.length} item${logs.length === 1 ? '' : 's'})`}
              description={
                totals.calories > 0
                  ? `${totals.calories} kcal · ${totals.proteinG}g P · ${totals.carbsG}g C · ${totals.fatG}g F`
                  : '0 kcal'
              }
              actions={
                <Button
                  size="small"
                  variant="outline"
                  icon={Plus}
                  onClick={() => {
                    setLogMealType(type)
                    setLogModalOpen(true)
                  }}
                >
                  Add
                </Button>
              }
            >
              {logs.length === 0 ? (
                <EmptyState
                  icon={Apple}
                  title={`No ${type} logged`}
                  description={`Add foods or meals consumed for ${type.toLowerCase()}.`}
                  action={
                    <Button
                      size="small"
                      icon={Plus}
                      onClick={() => {
                        setLogMealType(type)
                        setLogModalOpen(true)
                      }}
                    >
                      Log {type}
                    </Button>
                  }
                />
              ) : (
                <div className="divide-y divide-line">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-ink truncate">
                            {log.mealNameSnapshot}
                          </p>
                          <Badge variant="default">{log.portionPercent}%</Badge>
                          <span className="text-xs text-muted">
                            {formatTime(log.consumedAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {Math.round(log.nutritionSnapshot.calories)} kcal ·{' '}
                          {Math.round(log.nutritionSnapshot.proteinG * 10) / 10}g P ·{' '}
                          {Math.round(log.nutritionSnapshot.carbsG * 10) / 10}g C ·{' '}
                          {Math.round(log.nutritionSnapshot.fatG * 10) / 10}g F
                        </p>
                      </div>

                      <div className="flex items-center gap-1 self-end sm:self-center">
                        <button
                          type="button"
                          aria-label={`Edit ${log.mealNameSnapshot}`}
                          onClick={() => setEditingLog(log)}
                          className="flex size-11 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <Edit2 aria-hidden="true" size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${log.mealNameSnapshot}`}
                          onClick={() => setLogToDelete(log)}
                          className="flex size-11 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-500"
                        >
                          <Trash2 aria-hidden="true" size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )
        })}
      </div>
      ) : null}

      {/* Modals */}
      <LogMealModal
        open={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        initialDate={selectedDate}
        initialMealType={logMealType}
        onLogMeal={async (input) => {
          await logMeal(input)
          await loadData(selectedDate)
        }}
        onCreateSavedMeal={createMeal}
      />

      <EditMealLogModal
        open={Boolean(editingLog)}
        onClose={() => setEditingLog(null)}
        mealLog={editingLog}
        onSave={async (id, changes) => {
          await editMealLog(id, changes)
          await loadData(selectedDate)
        }}
        onDelete={async (id) => {
          await removeMealLog(id)
          await loadData(selectedDate)
        }}
      />

      <GoalsModal
        open={isGoalsModalOpen}
        onClose={() => setIsGoalsModalOpen(false)}
        currentGoals={goals}
        onSave={handleSaveGoals}
      />

      <Modal
        open={Boolean(logToDelete)}
        onClose={() => setLogToDelete(null)}
        closeBlocked={deleting}
        title="Delete Logged Meal"
        footer={
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button
              variant="ghost"
              disabled={deleting}
              onClick={() => setLogToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              disabled={deleting}
              onClick={() => void handleDeleteLog()}
            >
              Confirm delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink">
          Are you sure you want to remove{' '}
          <span className="font-semibold">{logToDelete?.mealNameSnapshot}</span>{' '}
          from your {logToDelete?.mealType} log?
        </p>
      </Modal>
    </PageContainer>
  )
}

function SummaryMetric({
  label,
  consumed,
  target,
  unit,
}: {
  label: string
  consumed: number
  target?: number
  unit: string
}) {
  const percent =
    target && target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : null
  const isOver = target && target > 0 && consumed > target

  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
          {label}
        </span>
        {isOver && <Badge variant="warning">Exceeded</Badge>}
      </div>

      <p className="mt-2 text-2xl font-bold text-ink">
        {consumed}{' '}
        <span className="text-xs font-normal text-muted">{unit}</span>
      </p>

      {target != null && target > 0 ? (
        <div className="mt-2 space-y-1.5">
          <div className="flex justify-between text-xs text-muted">
            <span>Goal: {target} {unit}</span>
            <span>{percent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className={`h-full transition-all duration-300 ${
                isOver ? 'bg-amber-500' : 'bg-accent'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted">No target set</p>
      )}
    </div>
  )
}

export default NutritionPage
