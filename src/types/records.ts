export type UUID = string

export interface SyncMetadata {
  id: UUID
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface NutritionValues {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

export interface WeightLog extends SyncMetadata {
  localDate: string // YYYY-MM-DD
  weightKg: number
  unit: 'kg' | 'lb'
  notes?: string
}

export interface StepLog extends SyncMetadata {
  localDate: string // YYYY-MM-DD
  stepCount: number
  targetSteps: number
}

export type CaloriePhase = 'cut' | 'maintain' | 'bulk'

export interface MonthlyCalorieTarget extends SyncMetadata {
  monthKey: string // YYYY-MM
  targetCalories: number
  targetProteinG?: number
  targetCarbsG?: number
  targetFatG?: number
  phase?: CaloriePhase
  tdeeEstimate?: number
}

