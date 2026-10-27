import Dexie from 'dexie'
import type { GymTrackerTables } from './migrations'
import { applyMigrations, DATABASE_VERSION } from './migrations'
import type { AiWorkoutLog } from '../features/ai-logger/types'

export class GymTrackerDatabase extends Dexie implements GymTrackerTables {
  workoutSessions!: GymTrackerTables['workoutSessions']
  exercises!: GymTrackerTables['exercises']
  workoutExercises!: GymTrackerTables['workoutExercises']
  exerciseSets!: GymTrackerTables['exerciseSets']
  savedMeals!: GymTrackerTables['savedMeals']
  mealLogs!: GymTrackerTables['mealLogs']
  aiWorkoutLogs!: GymTrackerTables['aiWorkoutLogs']

  constructor(name = 'gym-tracker') {
    super(name)
    applyMigrations(this)
  }
}

export const db = new GymTrackerDatabase()
export { DATABASE_VERSION }
export type { AiWorkoutLog }
