import type { SyncMetadata } from '../../types/records'
import type { MealType } from '../nutrition/types'

export type { MealType }

export type AiProvider = 'gemini'

export type AiLoggerMode = 'workout' | 'nutrition'

export interface ParsedExerciseItem {
  exercise: string
  weight: number | null
  unit: 'kg' | 'lbs' | null
  reps: number | null
  sets: number | null
  durationSeconds: number | null
  notes: string | null
}

export interface ParsedWorkout {
  exercises: ParsedExerciseItem[]
  exercise: string
  weight: number | null
  unit: 'kg' | 'lbs' | null
  reps: number | null
  sets: number | null
  durationSeconds: number | null
  notes: string | null
  confidence: 'high' | 'low'
  followUpQuestion: string | null
  sessionName?: string | null
  startTime?: string | null
  endTime?: string | null
  durationMinutes?: number | null
  workoutDate?: string | null
}

export interface ParsedMealItem {
  mealName: string
  mealType: MealType
  servingDescription: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  notes: string | null
}

export interface ParsedMeal {
  meals: ParsedMealItem[]
  mealName: string
  mealType: MealType
  servingDescription: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  notes: string | null
  confidence: 'high' | 'low'
  followUpQuestion: string | null
}

export interface AiConversationTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  parsedWorkout?: ParsedWorkout
  parsedMeal?: ParsedMeal
  timestamp: string
}

export interface ConfirmedExerciseItem {
  exercise: string
  weight: number | null
  unit: 'kg' | 'lbs'
  reps: number
  sets: number
  durationSeconds: number | null
  notes: string
}

export interface ConfirmedWorkout {
  exercises?: ConfirmedExerciseItem[]
  sessionName?: string
  notes?: string
  startedAt?: string
  completedAt?: string
  // Legacy / single exercise compatibility fields
  exercise?: string
  weight?: number | null
  unit?: 'kg' | 'lbs'
  reps?: number
  sets?: number
  durationSeconds?: number | null
}

export interface ConfirmedMealItem {
  mealName: string
  mealType: MealType
  servingDescription: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  portionPercent: number
  consumedAt?: string
  notes?: string
}

export interface ConfirmedMeal {
  meals?: ConfirmedMealItem[]
  // Legacy / single meal compatibility fields
  mealName?: string
  mealType?: MealType
  servingDescription?: string
  calories?: number
  proteinG?: number
  carbsG?: number
  fatG?: number
  portionPercent?: number
  consumedAt?: string
  notes?: string
}

export interface AiWorkoutLog extends SyncMetadata {
  workoutSessionId: string
  originalMessage: string
  provider: AiProvider
  parsedExercise: string
  confidence: 'high' | 'low'
}
