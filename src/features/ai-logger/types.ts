import type { SyncMetadata } from '../../types/records'
import type { MealType } from '../nutrition/types'

export type { MealType }

export type AiProvider = 'gemini'

export type AiLoggerMode = 'workout' | 'nutrition'

export interface ParsedWorkout {
  exercise: string
  weight: number | null
  unit: 'kg' | 'lbs' | null
  reps: number | null
  sets: number | null
  durationSeconds: number | null
  notes: string | null
  confidence: 'high' | 'low'
  followUpQuestion: string | null
}

export interface ParsedMeal {
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

export interface ConfirmedWorkout {
  exercise: string
  weight: number | null
  unit: 'kg' | 'lbs'
  reps: number
  sets: number
  durationSeconds: number | null
  notes: string
}

export interface ConfirmedMeal {
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

export interface AiWorkoutLog extends SyncMetadata {
  workoutSessionId: string
  originalMessage: string
  provider: AiProvider
  parsedExercise: string
  confidence: 'high' | 'low'
}
