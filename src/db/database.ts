import Dexie from 'dexie'
import type { GymTrackerTables } from './migrations'
import {
  applyMigrations,
  DATABASE_VERSION,
  seedDefaultExercises,
} from './migrations'
import type { AiWorkoutLog } from '../features/ai-logger/types'

export class GymTrackerDatabase extends Dexie implements GymTrackerTables {
  workoutSessions!: GymTrackerTables['workoutSessions']
  exercises!: GymTrackerTables['exercises']
  workoutExercises!: GymTrackerTables['workoutExercises']
  exerciseSets!: GymTrackerTables['exerciseSets']
  savedMeals!: GymTrackerTables['savedMeals']
  mealLogs!: GymTrackerTables['mealLogs']
  aiWorkoutLogs!: GymTrackerTables['aiWorkoutLogs']
  weightLogs!: GymTrackerTables['weightLogs']
  stepLogs!: GymTrackerTables['stepLogs']
  monthlyCalorieTargets!: GymTrackerTables['monthlyCalorieTargets']

  constructor(name = 'gym-tracker') {
    super(name)
    applyMigrations(this)
    this.on('populate', seedDefaultExercises)
  }
}

export const db = new GymTrackerDatabase()
export { DATABASE_VERSION }
export type { AiWorkoutLog }
