import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  Dumbbell,
  RefreshCw,
  Scale,
  Target,
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import PageContainer from '../../components/layout/PageContainer'
import { Button, Card } from '../../components/common'
import CapitalioHeader from './components/CapitalioHeader'
import MetricCardsGrid from './components/MetricCardsGrid'
import StrengthProgressionChart from './components/StrengthProgressionChart'
import PersonalRecordsSection from './components/PersonalRecordsSection'
import VolumeConsistencySection from './components/VolumeConsistencySection'
import ProgressEmptyState from './components/ProgressEmptyState'
import { loadProgressDashboardData } from './progressService'
import type { ProgressDashboardData, ProgressPeriod, WeightUnit } from './types'
import { loadActiveWorkoutThunk, startWorkoutThunk } from '../workouts/workoutThunks'
import {
  loadStepProgress,
  loadWeightProgression,
  type BodyMetricsPeriod,
  type StepProgressData,
  type WeightProgressionData,
} from '../body-metrics/bodyMetricsService'
import { WeightProgressionChart } from '../body-metrics/components/WeightProgressionChart'
import { StepVolumeChart } from '../body-metrics/components/StepVolumeChart'
import { LogWeightModal } from '../body-metrics/components/LogWeightModal'
import { LogStepsModal } from '../body-metrics/components/LogStepsModal'
import { MonthlyCalorieTracker } from '../nutrition/components/MonthlyCalorieTracker'
import { TdeeCalculatorModal } from '../nutrition/components/TdeeCalculatorModal'
import { getSavedNutritionGoals } from '../nutrition/nutritionService'

const UNIT_STORAGE_KEY = 'gym-tracker-progress-unit'

type ProgressTab = 'strength' | 'body' | 'calories'

function getInitialUnit(): WeightUnit {
  try {
    const saved = localStorage.getItem(UNIT_STORAGE_KEY)
    if (saved === 'kg' || saved === 'lb') return saved
  } catch {
    // Ignore localStorage access failures
  }
  return 'kg'
}

export default function ProgressDashboardPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialTab = (searchParams.get('tab') as ProgressTab) || 'strength'
  const [activeTab, setActiveTab] = useState<ProgressTab>(
    initialTab === 'body' || initialTab === 'calories' ? initialTab : 'strength',
  )

  const {
    activeWorkoutId,
    status: workoutStatus,
    error: workoutError,
  } = useAppSelector((state) => state.workoutUi)

  const [period, setPeriod] = useState<ProgressPeriod>('30d')
  const [unit, setUnit] = useState<WeightUnit>(getInitialUnit)
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('')
  const [dashboardData, setDashboardData] = useState<ProgressDashboardData | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'failed'>('idle')
  const [error, setError] = useState<string | null>(null)

  // Body Metrics State
  const [bodyPeriod, setBodyPeriod] = useState<BodyMetricsPeriod>('30d')
  const [weightData, setWeightData] = useState<WeightProgressionData | null>(null)
  const [stepData, setStepData] = useState<StepProgressData | null>(null)
  const [bodyStatus, setBodyStatus] = useState<'idle' | 'loading' | 'failed'>('idle')
  const [logWeightOpen, setLogWeightOpen] = useState(false)
  const [logStepsOpen, setLogStepsOpen] = useState(false)
  const [isTdeeModalOpen, setIsTdeeModalOpen] = useState(false)

  // Sync tab with URL
  const handleTabChange = (tab: ProgressTab) => {
    setActiveTab(tab)
    setSearchParams(tab === 'strength' ? {} : { tab })
  }

  // Ensure active workout state is current
  useEffect(() => {
    void dispatch(loadActiveWorkoutThunk())
  }, [dispatch])

  // Fetch strength progress data from IndexedDB
  const fetchProgressData = useCallback(async (
    targetPeriod: ProgressPeriod,
    targetUnit: WeightUnit,
    targetExerciseId?: string,
  ) => {
    setStatus('loading')
    setError(null)
    try {
      const data = await loadProgressDashboardData(
        targetPeriod,
        targetUnit,
        targetExerciseId,
      )
      setDashboardData(data)
      setStatus('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load progress data.')
      setStatus('failed')
    }
  }, [])

  // Fetch body metrics (Weight & Steps)
  const fetchBodyData = useCallback(async (
    targetPeriod: BodyMetricsPeriod,
    targetUnit: WeightUnit,
  ) => {
    setBodyStatus('loading')
    try {
      const [w, s] = await Promise.all([
        loadWeightProgression(targetPeriod, targetUnit),
        loadStepProgress(targetPeriod),
      ])
      setWeightData(w)
      setStepData(s)
      setBodyStatus('idle')
    } catch {
      setBodyStatus('failed')
    }
  }, [])

  // Trigger load when period, unit, or exercise change
  useEffect(() => {
    let isCancelled = false

    const execute = async () => {
      setStatus('loading')
      setError(null)
      try {
        const data = await loadProgressDashboardData(period, unit, selectedExerciseId)
        if (!isCancelled) {
          setDashboardData(data)
          setStatus('idle')
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Could not load progress data.')
          setStatus('failed')
        }
      }
    }

    void execute()

    return () => {
      isCancelled = true
    }
  }, [period, unit, selectedExerciseId])

  // Trigger body data load
  useEffect(() => {
    if (activeTab === 'body') {
      void fetchBodyData(bodyPeriod, unit)
    }
  }, [activeTab, bodyPeriod, unit, fetchBodyData])

  const handlePeriodChange = (newPeriod: ProgressPeriod) => {
    setPeriod(newPeriod)
  }

  const handleUnitChange = (newUnit: WeightUnit) => {
    setUnit(newUnit)
    try {
      localStorage.setItem(UNIT_STORAGE_KEY, newUnit)
    } catch {
      // Ignore storage errors
    }
  }

  const handleExerciseChange = (newExerciseId: string) => {
    setSelectedExerciseId(newExerciseId)
  }

  const handleStartWorkout = async () => {
    if (activeWorkoutId) {
      navigate('/workouts/active')
      return
    }
    try {
      await dispatch(startWorkoutThunk(undefined)).unwrap()
      navigate('/workouts/active')
    } catch {
      // workoutError will be rendered from Redux state
    }
  }

  return (
    <PageContainer>
      {/* Tab Navigation Strip */}
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-line pb-4 sm:gap-3">
        <button
          type="button"
          onClick={() => handleTabChange('strength')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === 'strength'
              ? 'bg-accent text-accent-fg shadow-sm'
              : 'border border-line bg-surface text-muted hover:text-ink'
          }`}
        >
          <Dumbbell size={16} />
          <span>Strength &amp; PRs</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('body')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === 'body'
              ? 'bg-accent text-accent-fg shadow-sm'
              : 'border border-line bg-surface text-muted hover:text-ink'
          }`}
        >
          <Scale size={16} />
          <span>Weight &amp; Steps</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('calories')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === 'calories'
              ? 'bg-accent text-accent-fg shadow-sm'
              : 'border border-line bg-surface text-muted hover:text-ink'
          }`}
        >
          <Target size={16} />
          <span>Monthly Calorie Adherence</span>
        </button>
      </div>

      {/* Visible Workout Action Error if any */}
      {workoutError && (
        <div
          role="alert"
          className="mb-6 flex items-center gap-2 rounded-xl border border-danger/20 bg-danger-soft p-3 text-xs text-danger"
        >
          <AlertCircle size={15} className="shrink-0" />
          <span>{workoutError}</span>
        </div>
      )}

      {/* TAB 1: Strength & Workouts */}
      {activeTab === 'strength' && (
        <>
          <CapitalioHeader
            period={period}
            onPeriodChange={handlePeriodChange}
            unit={unit}
            onUnitChange={handleUnitChange}
            activeWorkoutId={activeWorkoutId}
            workoutStatus={workoutStatus}
            onStartWorkout={handleStartWorkout}
          />

          {status === 'loading' && !dashboardData && (
            <Card>
              <div role="status" className="py-16 text-center">
                <RefreshCw size={24} className="mx-auto animate-spin text-lime-600 dark:text-lime-400" />
                <p className="mt-3 text-sm font-medium text-ink">Analyzing gym progression...</p>
                <p className="mt-1 text-xs text-muted">
                  Calculating real volume, personal records, and strength curves.
                </p>
              </div>
            </Card>
          )}

          {status === 'failed' && (
            <div
              role="alert"
              className="mb-6 flex flex-col justify-between gap-3 rounded-2xl border border-danger/20 bg-danger-soft p-5 text-sm text-danger sm:flex-row sm:items-center"
            >
              <div>
                <p className="font-semibold">Unable to load strength analytics</p>
                <p className="mt-1 text-xs">
                  {error ?? 'An unexpected error occurred while reading workout history.'}
                </p>
              </div>
              <Button
                size="small"
                variant="outline"
                icon={RefreshCw}
                onClick={() => void fetchProgressData(period, unit, selectedExerciseId)}
              >
                Retry
              </Button>
            </div>
          )}

          {dashboardData && (
            <>
              {!dashboardData.hasAnyWorkouts ? (
                <ProgressEmptyState
                  onStartWorkout={handleStartWorkout}
                  activeWorkoutId={activeWorkoutId}
                  workoutStatus={workoutStatus}
                />
              ) : (
                <div className="space-y-7 lg:space-y-9">
                  <section aria-label="Progress Metrics">
                    <MetricCardsGrid
                      metrics={dashboardData.metrics}
                      period={period}
                      unit={unit}
                    />
                  </section>

                  <section aria-label="Strength Progression">
                    <StrengthProgressionChart
                      points={dashboardData.strengthProgression}
                      selectedExerciseId={dashboardData.selectedExerciseId}
                      onSelectExercise={handleExerciseChange}
                      exercises={dashboardData.availableExercises}
                      unit={unit}
                      onSwitchToAllTime={() => setPeriod('all')}
                    />
                  </section>

                  <section aria-label="Personal Records">
                    <PersonalRecordsSection
                      personalRecords={dashboardData.personalRecords}
                      unit={unit}
                      onSelectExercise={handleExerciseChange}
                    />
                  </section>

                  <section aria-label="Volume & Consistency">
                    <VolumeConsistencySection
                      weeklyVolume={dashboardData.weeklyVolume}
                      recentWorkouts={dashboardData.recentWorkouts}
                      exerciseSummaries={dashboardData.exerciseSummaries}
                      unit={unit}
                      onSelectExercise={handleExerciseChange}
                    />
                  </section>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* TAB 2: Weight & Steps */}
      {activeTab === 'body' && (
        <div className="space-y-7 lg:space-y-9">
          {weightData && (
            <WeightProgressionChart
              data={weightData}
              period={bodyPeriod}
              onPeriodChange={setBodyPeriod}
              unit={unit}
              onUnitChange={handleUnitChange}
              onOpenLogWeight={() => setLogWeightOpen(true)}
            />
          )}

          {stepData && (
            <StepVolumeChart
              data={stepData}
              period={bodyPeriod}
              onPeriodChange={setBodyPeriod}
              onOpenLogSteps={() => setLogStepsOpen(true)}
            />
          )}

          {bodyStatus === 'loading' && !weightData && (
            <Card>
              <div role="status" className="py-16 text-center">
                <RefreshCw size={24} className="mx-auto animate-spin text-accent" />
                <p className="mt-3 text-sm font-medium text-ink">Loading body metrics…</p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* TAB 3: Monthly Calorie Adherence */}
      {activeTab === 'calories' && (
        <div className="space-y-7 lg:space-y-9">
          <MonthlyCalorieTracker
            onOpenCalculator={() => setIsTdeeModalOpen(true)}
            fallbackTargetCalories={getSavedNutritionGoals()?.calories ?? 2000}
          />
        </div>
      )}

      {/* Modals */}
      <LogWeightModal
        open={logWeightOpen}
        onClose={() => setLogWeightOpen(false)}
        initialWeightKg={weightData?.currentWeight ?? undefined}
        onSaved={() => {
          void fetchBodyData(bodyPeriod, unit)
        }}
      />

      <LogStepsModal
        open={logStepsOpen}
        onClose={() => setLogStepsOpen(false)}
        onSaved={() => {
          void fetchBodyData(bodyPeriod, unit)
        }}
      />

      <TdeeCalculatorModal
        open={isTdeeModalOpen}
        onClose={() => setIsTdeeModalOpen(false)}
        onGoalsApplied={() => {
          // refreshed
        }}
      />
    </PageContainer>
  )
}
