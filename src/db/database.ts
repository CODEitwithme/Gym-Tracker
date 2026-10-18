import Dexie from 'dexie'
import type { GymTrackerTables } from './migrations'
import { applyMigrations, DATABASE_VERSION } from './migrations'

export class GymTrackerDatabase extends Dexie implements GymTrackerTables {
  workoutSessions!: GymTrackerTables['workoutSessions']
  exercises!: GymTrackerTables['exercises']
  workoutExercises!: GymTrackerTables['workoutExercises']
  exerciseSets!: GymTrackerTables['exerciseSets']
  savedMeals!: GymTrackerTables['savedMeals']
  mealLogs!: GymTrackerTables['mealLogs']

  constructor(name = 'gym-tracker') {
    super(name)
    applyMigrations(this)
  }
}

export const db = new GymTrackerDatabase()
export { DATABASE_VERSION }
