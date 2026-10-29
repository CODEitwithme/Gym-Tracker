import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, RefreshCw } from 'lucide-react'
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

const UNIT_STORAGE_KEY = 'gym-tracker-progress-unit'

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

  // Ensure active workout state is current
  useEffect(() => {
    void dispatch(loadActiveWorkoutThunk())
  }, [dispatch])

  // Fetch progress data from IndexedDB
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
      {/* Header with Title, Controls, Unit, Log Workout */}
      <CapitalioHeader
        period={period}
        onPeriodChange={handlePeriodChange}
        unit={unit}
        onUnitChange={handleUnitChange}
        activeWorkoutId={activeWorkoutId}
        workoutStatus={workoutStatus}
        onStartWorkout={handleStartWorkout}
      />

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

      {/* Loading State */}
      {status === 'loading' && !dashboardData && (
        <Card>
          <div role="status" className="py-16 text-center">
            <RefreshCw size={24} className="mx-auto animate-spin text-lime-600 dark:text-lime-400" />
            <p className="mt-3 text-sm font-medium text-ink">Analyzing gym progression...</p>
            <p className="mt-1 text-xs text-muted">Calculating real volume, personal records, and strength curves.</p>
          </div>
        </Card>
      )}

      {/* Error State with Retry Button */}
      {status === 'failed' && (
        <div
          role="alert"
          className="mb-6 flex flex-col justify-between gap-3 rounded-2xl border border-danger/20 bg-danger-soft p-5 text-sm text-danger sm:flex-row sm:items-center"
        >
          <div>
            <p className="font-semibold">Unable to load strength analytics</p>
            <p className="mt-1 text-xs">{error ?? 'An unexpected error occurred while reading workout history.'}</p>
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

      {/* Main Content Area */}
      {dashboardData && (
        <>
          {!dashboardData.hasAnyWorkouts ? (
            <ProgressEmptyState
              onStartWorkout={handleStartWorkout}
              activeWorkoutId={activeWorkoutId}
              workoutStatus={workoutStatus}
            />
          ) : (
            <div className="space-y-7">
              {/* 1. Overview Metric Cards Grid (Workouts, Total Volume, PRs, Consistency) */}
              <section aria-label="Progress Metrics">
                <MetricCardsGrid
                  metrics={dashboardData.metrics}
                  period={period}
                  unit={unit}
                />
              </section>

              {/* 2. Interactive Strength Progression Chart */}
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

              {/* 3. Personal Records Section */}
              <section aria-label="Personal Records">
                <PersonalRecordsSection
                  personalRecords={dashboardData.personalRecords}
                  unit={unit}
                  onSelectExercise={handleExerciseChange}
                />
              </section>

              {/* 4. Training Volume & Consistency Analytics */}
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
    </PageContainer>
  )
}
