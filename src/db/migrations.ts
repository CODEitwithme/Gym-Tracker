import type { Dexie, Table, Transaction } from 'dexie'
import type { Exercise, ExerciseSet, WorkoutExercise, WorkoutSession } from '../features/workouts/types'
import type { MealLog, SavedMeal } from '../features/nutrition/types'
import type { AiWorkoutLog } from '../features/ai-logger/types'
import type { UUID } from '../types/records'

export interface GymTrackerTables {
  workoutSessions: Table<WorkoutSession, UUID>
  exercises: Table<Exercise, UUID>
  workoutExercises: Table<WorkoutExercise, UUID>
  exerciseSets: Table<ExerciseSet, UUID>
  savedMeals: Table<SavedMeal, UUID>
  mealLogs: Table<MealLog, UUID>
  aiWorkoutLogs: Table<AiWorkoutLog, UUID>
}

export interface DatabaseMigration {
  version: number
  stores: Record<string, string>
  upgrade?: (transaction: Transaction) => Promise<void> | void
}

export const DATABASE_VERSION = 2

export const migrations: DatabaseMigration[] = [
  {
    version: 1,
    stores: {
      workoutSessions:
        'id,status,startedAt,completedAt,updatedAt,deletedAt',
      exercises: 'id,name,category,updatedAt,deletedAt',
      workoutExercises:
        'id,workoutId,exerciseId,[workoutId+order],updatedAt,deletedAt',
      exerciseSets:
        'id,workoutExerciseId,setNumber,[workoutExerciseId+setNumber],updatedAt,deletedAt',
      savedMeals: 'id,name,updatedAt,deletedAt',
      mealLogs:
        'id,savedMealId,localDate,mealType,[localDate+mealType],consumedAt,updatedAt,deletedAt',
    },
  },
  {
    version: 2,
    stores: {
      // all existing tables from version 1 (required by Dexie — must repeat them):
      workoutSessions:
        'id,status,startedAt,completedAt,updatedAt,deletedAt',
      exercises: 'id,name,category,updatedAt,deletedAt',
      workoutExercises:
        'id,workoutId,exerciseId,[workoutId+order],updatedAt,deletedAt',
      exerciseSets:
        'id,workoutExerciseId,setNumber,[workoutExerciseId+setNumber],updatedAt,deletedAt',
      savedMeals: 'id,name,updatedAt,deletedAt',
      mealLogs:
        'id,savedMealId,localDate,mealType,[localDate+mealType],consumedAt,updatedAt,deletedAt',
      // new table:
      aiWorkoutLogs: 'id,workoutSessionId,provider,createdAt,deletedAt',
    },
  },
]

export function applyMigrations<T extends Dexie>(
  database: T,
  migrationHistory: readonly DatabaseMigration[] = migrations,
): T {
  for (const migration of migrationHistory) {
    const version = database.version(migration.version)
    version.stores(migration.stores)
    if (migration.upgrade) version.upgrade(migration.upgrade)
  }
  return database
}
