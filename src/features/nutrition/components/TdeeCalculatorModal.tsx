import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Calculator,
  Check,
} from 'lucide-react'
import { Badge, Button, Input, Modal } from '../../../components/common'
import { getLatestWeightLog } from '../../../db/repositories/bodyMetrics'
import { saveMonthlyCalorieTarget } from '../../../db/repositories/monthlyTargets'
import { saveNutritionGoals } from '../nutritionService'
import {
  ACTIVITY_INFO,
  calculateCompleteTdee,
  cmToFeetInches,
  feetInchesToCm,
  GOAL_INFO,
  type ActivityLevel,
  type BiologicalSex,
  type CalorieGoalType,
} from '../../../lib/tdee'
import { kilogramsToPounds, poundsToKilograms } from '../../../lib/units'
import { formatLocalDate } from '../../../lib/dateTime'

interface TdeeCalculatorModalProps {
  open: boolean
  onClose: () => void
  onGoalsApplied?: () => void
}

export function TdeeCalculatorModal({
  open,
  onClose,
  onGoalsApplied,
}: TdeeCalculatorModalProps) {
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>('metric')
  const [sex, setSex] = useState<BiologicalSex>('male')
  const [age, setAge] = useState('26')
  const [heightCm, setHeightCm] = useState('178')
  const [heightFt, setHeightFt] = useState('5')
  const [heightIn, setHeightIn] = useState('10')
  const [weight, setWeight] = useState('75')
  const [activity, setActivity] = useState<ActivityLevel>('moderate')
  const [goalType, setGoalType] = useState<CalorieGoalType>('maintain')

  const [appliedMessage, setAppliedMessage] = useState<string | null>(null)
  const [isLatestWeightPrefilled, setIsLatestWeightPrefilled] = useState(false)

  // Try to prefill weight with latest log on open
  useEffect(() => {
    if (!open) {
      setAppliedMessage(null)
      return
    }

    const loadLatest = async () => {
      try {
        const latest = await getLatestWeightLog()
        if (latest && latest.weightKg > 0) {
          if (unitSystem === 'metric') {
            setWeight(String(latest.weightKg))
          } else {
            setWeight(String(Math.round(kilogramsToPounds(latest.weightKg) * 10) / 10))
          }
          setIsLatestWeightPrefilled(true)
        }
      } catch {
        // Ignore fallback
      }
    }
    void loadLatest()
  }, [open, unitSystem])

  // Compute normalized metric values
  const parsedAge = Math.max(12, Math.min(100, Number(age) || 25))
  const parsedHeightCm =
    unitSystem === 'metric'
      ? Math.max(100, Math.min(250, Number(heightCm) || 175))
      : feetInchesToCm(Number(heightFt) || 5, Number(heightIn) || 9)

  const parsedWeightKg =
    unitSystem === 'metric'
      ? Math.max(30, Math.min(300, Number(weight) || 70))
      : poundsToKilograms(Math.max(66, Math.min(660, Number(weight) || 154)))

  // Calculate live results
  const result = calculateCompleteTdee({
    age: parsedAge,
    sex,
    weightKg: parsedWeightKg,
    heightCm: parsedHeightCm,
    activityLevel: activity,
    goalType,
  })

  const currentMonthKey = formatLocalDate(new Date()).slice(0, 7)

  const handleApplyToDailyGoals = () => {
    const success = saveNutritionGoals({
      calories: result.targetCalories,
      proteinG: result.macros.proteinG,
      carbsG: result.macros.carbsG,
      fatG: result.macros.fatG,
    })
    if (success) {
      setAppliedMessage('Applied to daily nutrition targets!')
      onGoalsApplied?.()
      setTimeout(() => setAppliedMessage(null), 3500)
    }
  }

  const handleSaveAsMonthlyTarget = async () => {
    try {
      await saveMonthlyCalorieTarget({
        monthKey: currentMonthKey,
        targetCalories: result.targetCalories,
        targetProteinG: result.macros.proteinG,
        targetCarbsG: result.macros.carbsG,
        targetFatG: result.macros.fatG,
        phase: result.phase,
        tdeeEstimate: result.tdee,
      })
      // Also apply to daily
      saveNutritionGoals({
        calories: result.targetCalories,
        proteinG: result.macros.proteinG,
        carbsG: result.macros.carbsG,
        fatG: result.macros.fatG,
      })
      setAppliedMessage(`Saved as target for ${currentMonthKey} & applied to daily!`)
      onGoalsApplied?.()
      setTimeout(() => setAppliedMessage(null), 3500)
    } catch {
      setAppliedMessage('Could not save monthly target.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Calculator size={18} />
          </span>
          <span>Maintenance & Calorie Calculator</span>
        </div>
      }
      footer={
        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="outline"
            icon={Check}
            onClick={handleApplyToDailyGoals}
          >
            Apply to Daily Targets
          </Button>
          <Button
            variant="primary"
            icon={ArrowRight}
            onClick={() => void handleSaveAsMonthlyTarget()}
          >
            Set as This Month's Target
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {appliedMessage && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-success/30 bg-success-soft p-3 text-xs font-medium text-success"
          >
            <Check size={16} />
            <span>{appliedMessage}</span>
          </div>
        )}

        {/* Units & Sex Selector */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              Unit System
            </label>
            <div className="mt-1.5 flex rounded-lg border border-line bg-surface p-1">
              <button
                type="button"
                onClick={() => {
                  if (unitSystem === 'imperial') {
                    setWeight(String(Math.round(poundsToKilograms(Number(weight) || 165))))
                  }
                  setUnitSystem('metric')
                }}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                  unitSystem === 'metric'
                    ? 'bg-panel text-ink shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Metric (kg, cm)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (unitSystem === 'metric') {
                    setWeight(String(Math.round(kilogramsToPounds(Number(weight) || 75))))
                    const { feet, inches } = cmToFeetInches(Number(heightCm) || 178)
                    setHeightFt(String(feet))
                    setHeightIn(String(inches))
                  }
                  setUnitSystem('imperial')
                }}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                  unitSystem === 'imperial'
                    ? 'bg-panel text-ink shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Imperial (lb, ft)
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              Biological Sex
            </label>
            <div className="mt-1.5 flex rounded-lg border border-line bg-surface p-1">
              <button
                type="button"
                onClick={() => setSex('male')}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                  sex === 'male'
                    ? 'bg-panel text-ink shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Male
              </button>
              <button
                type="button"
                onClick={() => setSex('female')}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                  sex === 'female'
                    ? 'bg-panel text-ink shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Female
              </button>
            </div>
          </div>
        </div>

        {/* Inputs: Age, Height, Weight */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label="Age"
            type="number"
            min={12}
            max={100}
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />

          {unitSystem === 'metric' ? (
            <Input
              label="Height (cm)"
              type="number"
              min={100}
              max={250}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Feet"
                type="number"
                min={3}
                max={7}
                value={heightFt}
                onChange={(e) => setHeightFt(e.target.value)}
              />
              <Input
                label="Inches"
                type="number"
                min={0}
                max={11}
                value={heightIn}
                onChange={(e) => setHeightIn(e.target.value)}
              />
            </div>
          )}

          <div>
            <Input
              label={unitSystem === 'metric' ? 'Weight (kg)' : 'Weight (lbs)'}
              type="number"
              step="0.1"
              min={unitSystem === 'metric' ? 30 : 66}
              max={unitSystem === 'metric' ? 300 : 660}
              value={weight}
              onChange={(e) => {
                setWeight(e.target.value)
                setIsLatestWeightPrefilled(false)
              }}
              helperText={
                isLatestWeightPrefilled ? 'Auto-filled from your latest weigh-in.' : undefined
              }
            />
          </div>
        </div>

        {/* Activity Level */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted">
            Activity Level
          </label>
          <div className="mt-2 space-y-2">
            {(Object.keys(ACTIVITY_INFO) as ActivityLevel[]).map((level) => {
              const info = ACTIVITY_INFO[level]
              const isSelected = activity === level
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setActivity(level)}
                  className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? 'border-accent bg-accent/5 ring-1 ring-accent'
                      : 'border-line bg-panel hover:bg-hover'
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">{info.label}</p>
                    <p className="text-xs text-muted">{info.description}</p>
                  </div>
                  <span className="text-xs font-mono font-medium text-accent">
                    ×{info.multiplier}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Primary Goal */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted">
            Calorie Goal Strategy
          </label>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(Object.keys(GOAL_INFO) as CalorieGoalType[]).map((type) => {
              const info = GOAL_INFO[type]
              const isSelected = goalType === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setGoalType(type)}
                  className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? 'border-accent bg-accent/5 ring-1 ring-accent'
                      : 'border-line bg-panel hover:bg-hover'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink">{info.label}</span>
                    <Badge
                      variant={
                        info.phase === 'cut'
                          ? 'warning'
                          : info.phase === 'bulk'
                            ? 'success'
                            : 'default'
                      }
                    >
                      {info.phase}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">{info.description}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Results Card */}
        <div className="rounded-2xl border border-accent/30 bg-surface p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-4 border-b border-line pb-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Target Daily Calories
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-ink sm:text-4xl">
                  {result.targetCalories.toLocaleString()}
                </span>
                <span className="text-sm font-semibold text-muted">kcal / day</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="rounded-xl bg-panel px-3 py-2 border border-line">
                <p className="text-muted">BMR (Basal Rate)</p>
                <p className="mt-0.5 text-sm font-bold text-ink">{result.bmr} kcal</p>
              </div>
              <div className="rounded-xl bg-panel px-3 py-2 border border-line">
                <p className="text-muted">Maintenance (TDEE)</p>
                <p className="mt-0.5 text-sm font-bold text-ink">{result.tdee} kcal</p>
              </div>
            </div>
          </div>

          {/* Macro Split Preview */}
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted">Suggested Macronutrient Target</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center sm:gap-3">
              <div className="rounded-xl bg-panel p-2.5 border border-line">
                <span className="text-xs font-medium text-muted">Protein</span>
                <p className="text-lg font-bold text-ink">{result.macros.proteinG}g</p>
                <span className="text-[10px] text-muted font-mono">
                  {Math.round((result.macros.proteinG * 4 * 100) / result.targetCalories)}%
                </span>
              </div>
              <div className="rounded-xl bg-panel p-2.5 border border-line">
                <span className="text-xs font-medium text-muted">Carbs</span>
                <p className="text-lg font-bold text-ink">{result.macros.carbsG}g</p>
                <span className="text-[10px] text-muted font-mono">
                  {Math.round((result.macros.carbsG * 4 * 100) / result.targetCalories)}%
                </span>
              </div>
              <div className="rounded-xl bg-panel p-2.5 border border-line">
                <span className="text-xs font-medium text-muted">Fat</span>
                <p className="text-lg font-bold text-ink">{result.macros.fatG}g</p>
                <span className="text-[10px] text-muted font-mono">
                  {Math.round((result.macros.fatG * 9 * 100) / result.targetCalories)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
