import type { SyncMetadata } from '../../types/records'

export type AiProvider = 'gemini'

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

export interface AiConversationTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  parsedWorkout?: ParsedWorkout
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

export interface AiWorkoutLog extends SyncMetadata {
  workoutSessionId: string
  originalMessage: string
  provider: AiProvider
  parsedExercise: string
  confidence: 'high' | 'low'
}
