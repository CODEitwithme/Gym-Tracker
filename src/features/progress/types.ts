export type ProgressPeriod = '7d' | '30d' | '90d' | 'all'
export type WeightUnit = 'kg' | 'lb'

export type PrType = 'heaviest' | 'one_rep_max' | 'rep_record'

export interface PersonalRecord {
  id: string
  exerciseId: string
  exerciseName: string
  workoutId: string
  workoutName: string
  achievedAt: string // ISO timestamp
  localDate: string  // YYYY-MM-DD
  type: PrType
  weightKg: number
  reps: number
  estimated1RmKg: number
  previousWeightKg: number | null
  previousEstimated1RmKg: number | null
  previousReps: number | null
  improvementKg: number | null
  improvementPercent: number | null
  isNewInPeriod: boolean
}

export interface ExerciseSummary {
  exerciseId: string
  exerciseName: string
  category: string
  totalSets: number
  totalVolumeKg: number
  bestWeightKg: number
  bestReps: number
  estimated1RmKg: number
  lastTrainedAt: string | null
  workoutCount: number
}

export interface WorkoutHistoryItem {
  id: string
  name: string
  completedAt: string
  durationSeconds: number | null
  exerciseCount: number
  completedSetCount: number
  totalVolumeKg: number
  exercises: string[]
}

export interface StrengthChartPoint {
  workoutId: string
  workoutName: string
  timestamp: string
  localDate: string
  bestWeightKg: number
  bestWeightReps: number
  estimated1RmKg: number
  totalExerciseVolumeKg: number
}

export interface WeeklyVolumePoint {
  weekKey: string // e.g. "2026-W42" or "Oct 14"
  label: string
  startDate: string
  endDate: string
  volumeKg: number
  workoutCount: number
}

export interface ProgressOverviewMetrics {
  workoutsCount: number
  previousWorkoutsCount: number
  totalVolumeKg: number
  previousTotalVolumeKg: number
  prsCount: number
  previousPrsCount: number
  activeTrainingDays: number
  previousActiveTrainingDays: number
  workoutsPerWeek: number
  previousWorkoutsPerWeek: number
  totalCompletedDurationSeconds: number | null
  hasPreviousData: boolean
  periodDays: number
}

export interface ProgressDashboardData {
  period: ProgressPeriod
  unit: WeightUnit
  selectedExerciseId: string
  metrics: ProgressOverviewMetrics
  strengthProgression: StrengthChartPoint[]
  personalRecords: PersonalRecord[]
  weeklyVolume: WeeklyVolumePoint[]
  recentWorkouts: WorkoutHistoryItem[]
  exerciseSummaries: ExerciseSummary[]
  availableExercises: Array<{ id: string; name: string; category?: string }>
  hasAnyWorkouts: boolean
}

