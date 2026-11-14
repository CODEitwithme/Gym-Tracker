import type { Dexie, Table, Transaction } from 'dexie'
import type { Exercise, ExerciseSet, WorkoutExercise, WorkoutSession } from '../features/workouts/types'
import type { MealLog, SavedMeal } from '../features/nutrition/types'
import type { AiWorkoutLog } from '../features/ai-logger/types'
import type { MonthlyCalorieTarget, StepLog, UUID, WeightLog } from '../types/records'

export interface GymTrackerTables {
  workoutSessions: Table<WorkoutSession, UUID>
  exercises: Table<Exercise, UUID>
  workoutExercises: Table<WorkoutExercise, UUID>
  exerciseSets: Table<ExerciseSet, UUID>
  savedMeals: Table<SavedMeal, UUID>
  mealLogs: Table<MealLog, UUID>
  aiWorkoutLogs: Table<AiWorkoutLog, UUID>
  weightLogs: Table<WeightLog, UUID>
  stepLogs: Table<StepLog, UUID>
  monthlyCalorieTargets: Table<MonthlyCalorieTarget, UUID>
}

export interface DatabaseMigration {
  version: number
  stores: Record<string, string>
  upgrade?: (transaction: Transaction) => Promise<void> | void
}

export const DATABASE_VERSION = 4

export const DEFAULT_EXERCISES: Pick<Exercise, 'name' | 'category' | 'equipment'>[] = [
  { name: 'Barbell Bench Press', category: 'chest', equipment: 'Barbell' },
  { name: 'Dumbbell Bench Press', category: 'chest', equipment: 'Dumbbell' },
  { name: 'Incline Dumbbell Press', category: 'chest', equipment: 'Dumbbell' },
  { name: 'Push-Up', category: 'chest', equipment: 'Bodyweight' },
  { name: 'Lat Pulldown', category: 'back', equipment: 'Cable' },
  { name: 'Seated Cable Row', category: 'back', equipment: 'Cable' },
  { name: 'Barbell Row', category: 'back', equipment: 'Barbell' },
  { name: 'One-Arm Dumbbell Row', category: 'back', equipment: 'Dumbbell' },
  { name: 'Back Squat', category: 'legs', equipment: 'Barbell' },
  { name: 'Leg Press', category: 'legs', equipment: 'Machine' },
  { name: 'Romanian Deadlift', category: 'legs', equipment: 'Barbell' },
  { name: 'Leg Curl', category: 'legs', equipment: 'Machine' },
  { name: 'Leg Extension', category: 'legs', equipment: 'Machine' },
  { name: 'Calf Raise', category: 'legs', equipment: 'Machine' },
  { name: 'Overhead Press', category: 'shoulders', equipment: 'Barbell' },
  { name: 'Dumbbell Shoulder Press', category: 'shoulders', equipment: 'Dumbbell' },
  { name: 'Lateral Raise', category: 'shoulders', equipment: 'Dumbbell' },
  { name: 'Face Pull', category: 'shoulders', equipment: 'Cable' },
  { name: 'Barbell Curl', category: 'arms', equipment: 'Barbell' },
  { name: 'Dumbbell Curl', category: 'arms', equipment: 'Dumbbell' },
  { name: 'Triceps Pushdown', category: 'arms', equipment: 'Cable' },
  { name: 'Overhead Triceps Extension', category: 'arms', equipment: 'Dumbbell' },
  { name: 'Crunch', category: 'core', equipment: 'Bodyweight' },
  { name: 'Cable Crunch', category: 'core', equipment: 'Cable' },
  { name: 'Hanging Knee Raise', category: 'core', equipment: 'Bodyweight' },
]

const DEFAULT_EXERCISE_TIMESTAMP = '2026-11-14T00:00:00.000Z'

export function defaultExerciseId(name: string): UUID {
  const normalized = name.trim().toLowerCase()
  let h1 = 0xdeadbeef ^ 0
  let h2 = 0x41c6ce57 ^ 0
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0')
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0')
  const hex3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0')
  const hex4 = ((h1 + h2) >>> 0).toString(16).padStart(8, '0')
  const seg1 = hex1
  const seg2 = hex2.slice(0, 4)
  const seg3 = `4${hex2.slice(4, 7)}`
  const seg4 = `8${hex3.slice(0, 3)}`
  const seg5 = `${hex3.slice(3, 7)}${hex4}`
  return `${seg1}-${seg2}-${seg3}-${seg4}-${seg5}` as UUID
}

export async function seedDefaultExercises(
  transaction: Transaction,
): Promise<void> {
  const exercises = transaction.table('exercises') as Table<Exercise, UUID>
  const existingExercises = await exercises.toArray()
  const existingNames = new Set(
    existingExercises.map((exercise) => exercise.name.trim().toLowerCase()),
  )
  const missingExercises = DEFAULT_EXERCISES.filter(
    (exercise) => !existingNames.has(exercise.name.toLowerCase()),
  )
  if (missingExercises.length === 0) return

  await exercises.bulkAdd(
    missingExercises.map((exercise) => ({
      ...exercise,
      id: defaultExerciseId(exercise.name),
      createdAt: DEFAULT_EXERCISE_TIMESTAMP,
      updatedAt: DEFAULT_EXERCISE_TIMESTAMP,
      deletedAt: null,
    })),
  )
}

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
  {
    version: 3,
    stores: {
      // all existing tables from version 2:
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
      aiWorkoutLogs: 'id,workoutSessionId,provider,createdAt,deletedAt',
      // new tables for version 3:
      weightLogs: 'id,localDate,createdAt,updatedAt,deletedAt',
      stepLogs: 'id,localDate,createdAt,updatedAt,deletedAt',
      monthlyCalorieTargets: 'id,monthKey,updatedAt,deletedAt',
    },
  },
  {
    version: 4,
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
      aiWorkoutLogs: 'id,workoutSessionId,provider,createdAt,deletedAt',
      weightLogs: 'id,localDate,createdAt,updatedAt,deletedAt',
      stepLogs: 'id,localDate,createdAt,updatedAt,deletedAt',
      monthlyCalorieTargets: 'id,monthKey,updatedAt,deletedAt',
    },
    upgrade: seedDefaultExercises,
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
