import type { SyncMetadata } from '../../types/records'

export type WorkoutStatus = 'in_progress' | 'completed'

export type ExerciseCategory =
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'cardio'
  | 'other'

export interface WorkoutSession extends SyncMetadata {
  name: string
  startedAt: string
  completedAt: string | null
  status: WorkoutStatus
  notes: string
}

export interface Exercise extends SyncMetadata {
  name: string
  category: ExerciseCategory
  equipment: string | null
}

export interface WorkoutExercise extends SyncMetadata {
  workoutId: string
  exerciseId: string
  exerciseNameSnapshot: string
  order: number
  notes: string
}

export interface ExerciseSet extends SyncMetadata {
  workoutExerciseId: string
  setNumber: number
  weightKg: number
  reps: number
  completed: boolean
}
