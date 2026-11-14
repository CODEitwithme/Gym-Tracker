import { useState } from 'react'
import {
  Calculator,
  Check,
  Moon,
  Sun,
} from 'lucide-react'
import { Badge, Button, Card, Input } from '../../components/common'
import PageContainer from '../../components/layout/PageContainer'
import SettingsNav from '../../components/layout/SettingsNav'
import { useUserPreferences } from '../../app/useUserPreferences'
import { useTheme } from '../../app/useTheme'
import {
  getSavedNutritionGoals,
  saveNutritionGoals,
} from '../nutrition/nutritionService'
import type { DailyNutritionGoals } from '../nutrition/types'
import { TdeeCalculatorModal } from '../nutrition/components/TdeeCalculatorModal'

export function PreferencesPage() {
  const [preferences, updatePreferences] = useUserPreferences()
  const { theme, toggleTheme } = useTheme()

  const [nutritionGoals, setNutritionGoals] = useState<DailyNutritionGoals>(() => {
    return (
      getSavedNutritionGoals() ?? {
        calories: 2200,
        proteinG: 160,
        carbsG: 220,
        fatG: 70,
      }
    )
  })

  const [stepTargetInput, setStepTargetInput] = useState(String(preferences.stepTarget))
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isTdeeOpen, setIsTdeeOpen] = useState(false)

  const handleSavePreferences = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const parsedSteps = parseInt(stepTargetInput, 10)

    updatePreferences({
      stepTarget: Number.isFinite(parsedSteps) && parsedSteps > 0 ? parsedSteps : 10000,
    })

    saveNutritionGoals(nutritionGoals)

    setStatusMessage('Preferences and targets saved successfully.')
    setTimeout(() => setStatusMessage(null), 3000)
  }

  return (
    <PageContainer>
      <div className="lg:mx-auto lg:max-w-4xl xl:max-w-5xl">
        <header className="mb-7 border-b border-line pb-6 lg:mb-8">
          <p className="mb-2 text-sm font-medium text-accent">Settings</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl lg:text-5xl">
            Preferences &amp; Targets
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Configure your units, daily fitness goals, workout rest timers, and appearance.
          </p>
        </header>

        <SettingsNav />

        {statusMessage && (
          <div
            role="status"
            className="mb-6 flex items-center gap-2 rounded-xl border border-success/30 bg-success-soft p-4 text-sm text-success"
          >
            <Check size={16} />
            <span>{statusMessage}</span>
          </div>
        )}

        <form onSubmit={handleSavePreferences} className="space-y-6">
          {/* Section 1: Units & Measurements */}
          <Card
            title="Units of Measurement"
            description="Choose the unit system used for weights in workouts, body tracking, and progress charts."
          >
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => updatePreferences({ weightUnit: 'kg' })}
                className={`flex flex-1 min-w-[140px] items-center justify-between rounded-xl border p-4 transition-all ${
                  preferences.weightUnit === 'kg'
                    ? 'border-accent bg-accent/10 ring-2 ring-accent/30 text-ink'
                    : 'border-line bg-surface hover:bg-hover text-muted'
                }`}
              >
                <div className="text-left">
                  <p className="font-semibold text-sm text-ink">Metric</p>
                  <p className="text-xs text-muted">Kilograms (kg)</p>
                </div>
                {preferences.weightUnit === 'kg' && (
                  <Badge variant="success">Active</Badge>
                )}
              </button>

              <button
                type="button"
                onClick={() => updatePreferences({ weightUnit: 'lb' })}
                className={`flex flex-1 min-w-[140px] items-center justify-between rounded-xl border p-4 transition-all ${
                  preferences.weightUnit === 'lb'
                    ? 'border-accent bg-accent/10 ring-2 ring-accent/30 text-ink'
                    : 'border-line bg-surface hover:bg-hover text-muted'
                }`}
              >
                <div className="text-left">
                  <p className="font-semibold text-sm text-ink">Imperial</p>
                  <p className="text-xs text-muted">Pounds (lb)</p>
                </div>
                {preferences.weightUnit === 'lb' && (
                  <Badge variant="success">Active</Badge>
                )}
              </button>
            </div>
          </Card>

          {/* Section 2: Daily Activity & Step Target */}
          <Card
            title="Daily Step Target"
            description="Set your daily walking and step count target for momentum tracking."
          >
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Input
                  label="Daily Step Goal"
                  type="number"
                  min="1000"
                  step="500"
                  value={stepTargetInput}
                  onChange={(e) => setStepTargetInput(e.target.value)}
                  placeholder="10000"
                />
              </div>
              <div className="flex gap-2">
                {[7500, 10000, 12500].map((steps) => (
                  <button
                    key={steps}
                    type="button"
                    onClick={() => {
                      setStepTargetInput(String(steps))
                      updatePreferences({ stepTarget: steps })
                    }}
                    className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink hover:bg-hover transition-colors"
                  >
                    {steps.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Section 4: Daily Nutrition Goals */}
          <Card
            title="Daily Nutrition Targets"
            description="Calorie and macronutrient targets used on your Dashboard and Nutrition views."
            actions={
              <Button
                type="button"
                size="small"
                variant="outline"
                icon={Calculator}
                onClick={() => setIsTdeeOpen(true)}
              >
                TDEE Calculator
              </Button>
            }
          >
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Target Calories (kcal)"
                type="number"
                min="500"
                value={String(nutritionGoals.calories)}
                onChange={(e) =>
                  setNutritionGoals((prev) => ({
                    ...prev,
                    calories: Math.max(0, parseInt(e.target.value, 10) || 0),
                  }))
                }
              />
              <Input
                label="Target Protein (g)"
                type="number"
                min="0"
                value={String(nutritionGoals.proteinG)}
                onChange={(e) =>
                  setNutritionGoals((prev) => ({
                    ...prev,
                    proteinG: Math.max(0, parseInt(e.target.value, 10) || 0),
                  }))
                }
              />
              <Input
                label="Target Carbs (g)"
                type="number"
                min="0"
                value={String(nutritionGoals.carbsG)}
                onChange={(e) =>
                  setNutritionGoals((prev) => ({
                    ...prev,
                    carbsG: Math.max(0, parseInt(e.target.value, 10) || 0),
                  }))
                }
              />
              <Input
                label="Target Fat (g)"
                type="number"
                min="0"
                value={String(nutritionGoals.fatG)}
                onChange={(e) =>
                  setNutritionGoals((prev) => ({
                    ...prev,
                    fatG: Math.max(0, parseInt(e.target.value, 10) || 0),
                  }))
                }
              />
            </div>
          </Card>

          {/* Section 5: Appearance */}
          <Card
            title="Appearance"
            description="Switch between dark and light theme."
          >
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-surface text-ink">
                  {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                  </p>
                  <p className="text-xs text-muted">
                    {theme === 'dark'
                      ? 'Deep OLED-friendly palette'
                      : 'Bright high-contrast daylight palette'}
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={toggleTheme}>
                Switch to {theme === 'dark' ? 'Light' : 'Dark'}
              </Button>
            </div>
          </Card>

          {/* Submit */}
          <div className="flex justify-end pt-4">
            <Button type="submit" variant="primary" size="large">
              Save Preferences
            </Button>
          </div>
        </form>

        {isTdeeOpen && (
          <TdeeCalculatorModal
            open
            onClose={() => setIsTdeeOpen(false)}
            onGoalsApplied={() => {
              const applied = getSavedNutritionGoals()
              if (applied) {
                setNutritionGoals(applied)
              }
              setIsTdeeOpen(false)
              setStatusMessage('Applied TDEE recommendations to your nutrition goals.')
            }}
          />
        )}
      </div>
    </PageContainer>
  )
}

export default PreferencesPage
