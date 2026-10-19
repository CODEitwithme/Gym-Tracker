import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GymTrackerDatabase } from '../../db/database'
import {
  addExerciseSet,
  addWorkoutExercise,
} from '../../db/repositories/workoutDetails'
import { createExercise } from '../../db/repositories/exercises'
import {
  createMealLog,
  createSavedMeal,
} from '../../db/repositories/nutrition'
import {
  createWorkoutSession,
  updateWorkoutSession,
} from '../../db/repositories/workoutSessions'
import { createTimestamp, createUUID, formatLocalDate } from '../../lib/dateTime'
import { loadDashboardAnalytics, loadExerciseProgress } from '../dashboard/analyticsService'
import { removeDemoData, seedDemoData } from './demoDataService'

let testDatabase: GymTrackerDatabase
const asOf = new Date(2026, 9, 19, 12, 0, 0)

function localDay(date: Date, offset: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + offset)
  return result
}

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  }
}

async function createCompletedWorkout(exerciseId: string) {
  const session = await createWorkoutSession(
    {
      name: 'Real workout',
      startedAt: '2026-10-18T10:00:00.000Z',
      completedAt: null,
      status: 'in_progress',
      notes: 'User note',
    },
    testDatabase,
  )
  const relation = await addWorkoutExercise(
    { workoutId: session.id, exerciseId },
    testDatabase,
  )
  const set = await addExerciseSet(
    {
      workoutExerciseId: relation.id,
      setNumber: 1,
      weightKg: 50,
      reps: 8,
      completed: true,
    },
    testDatabase,
  )
  await updateWorkoutSession(
    session.id,
    { status: 'completed', completedAt: '2026-10-18T11:00:00.000Z' },
    testDatabase,
  )
  return { session: await testDatabase.workoutSessions.get(session.id), relation, set }
}

beforeEach(async () => {
  testDatabase = new GymTrackerDatabase(`gym-tracker-demo-${createUUID()}`)
  await testDatabase.open()
  vi.stubGlobal('localStorage', memoryStorage())
})

afterEach(async () => {
  testDatabase.close()
  await testDatabase.delete()
  vi.unstubAllGlobals()
})

describe('demo history service', () => {
  it('creates a complete seven-local-day history that existing analytics read', async () => {
    const result = await seedDemoData(testDatabase, asOf)

    expect(result).toMatchObject({
      workoutSessions: 5,
      workoutExercises: 15,
      exerciseSets: 45,
      savedMeals: 8,
      mealLogs: 22,
      startDate: formatLocalDate(localDay(asOf, -6)),
      endDate: formatLocalDate(asOf),
      alreadyLoaded: false,
    })

    const sessions = await testDatabase.workoutSessions.toArray()
    expect(sessions).toHaveLength(5)
    expect(sessions.every((session) => session.status === 'completed')).toBe(true)
    expect(
      new Set(sessions.map((session) => formatLocalDate(new Date(session.completedAt!)))).size,
    ).toBe(5)
    expect(
      sessions.every(
        (session) =>
          Date.parse(session.startedAt) <= Date.parse(session.completedAt!) &&
          Date.parse(session.completedAt!) <= asOf.getTime(),
      ),
    ).toBe(true)

    const sets = await testDatabase.exerciseSets.toArray()
    expect(sets).toHaveLength(45)
    expect(sets.every((set) => set.completed)).toBe(true)
    expect(new Set(sets.map((set) => set.workoutExerciseId)).size).toBe(15)
    expect(sets.every((set) => set.weightKg > 0 && set.reps > 0)).toBe(true)

    const mealLogs = await testDatabase.mealLogs.toArray()
    expect(mealLogs).toHaveLength(22)
    expect(
      new Set(mealLogs.map((log) => log.localDate)).size,
    ).toBe(7)
    expect(
      mealLogs.every(
        (log) =>
          log.localDate === formatLocalDate(new Date(log.consumedAt)) &&
          Date.parse(log.consumedAt) <= asOf.getTime() &&
          log.mealNameSnapshot.startsWith('Demo ·') &&
          Object.values(log.nutritionSnapshot).every(
            (value) => Number.isFinite(value) && value > 0,
          ),
      ),
    ).toBe(true)
    expect(new Set(mealLogs.map((log) => log.mealType))).toEqual(
      new Set(['breakfast', 'lunch', 'dinner', 'snack']),
    )
    const savedMealIds = new Set(
      (await testDatabase.savedMeals.toArray()).map((meal) => meal.id),
    )
    expect(mealLogs.every((log) => savedMealIds.has(log.savedMealId))).toBe(true)

    const analytics = await loadDashboardAnalytics(7, testDatabase, asOf)
    expect(analytics.workouts.count).toBe(5)
    expect(analytics.nutrition.mealLogCount).toBe(22)
    expect(analytics.days).toHaveLength(7)
    expect(analytics.days.map((day) => day.date)).toEqual(
      Array.from({ length: 7 }, (_, index) =>
        formatLocalDate(localDay(asOf, index - 6)),
      ),
    )
    const squat = (await testDatabase.exercises
      .filter((exercise) => exercise.name === 'Demo · Barbell Squat')
      .first())
    expect(squat).toBeDefined()
    const progress = await loadExerciseProgress(squat!.id, testDatabase)
    expect(progress.entries).toHaveLength(1)
    expect(progress.entries[0].sets).toHaveLength(3)
  })

  it('leaves real records unchanged and safely reuses existing exercises', async () => {
    const exercise = await createExercise(
      { name: 'Bench Press', category: 'chest', equipment: 'Barbell' },
      testDatabase,
    )
    const realWorkout = await createCompletedWorkout(exercise.id)
    const realMeal = await createSavedMeal(
      {
        name: 'My lunch',
        servingDescription: 'One plate',
        calories: 520,
        proteinG: 35,
        carbsG: 55,
        fatG: 16,
        calorieSource: 'manual',
      },
      testDatabase,
    )
    const realLog = await createMealLog(
      {
        savedMealId: realMeal.id,
        consumedAt: '2026-10-18T12:00:00.000Z',
        mealType: 'lunch',
        portionPercent: 100,
      },
      testDatabase,
    )
    const before = {
      exercise: await testDatabase.exercises.get(exercise.id),
      session: await testDatabase.workoutSessions.get(realWorkout.session!.id),
      relation: await testDatabase.workoutExercises.get(realWorkout.relation.id),
      set: await testDatabase.exerciseSets.get(realWorkout.set.id),
      meal: await testDatabase.savedMeals.get(realMeal.id),
      log: await testDatabase.mealLogs.get(realLog.id),
    }

    const result = await seedDemoData(testDatabase, asOf)
    expect(result.exercises).toBe(12)
    expect(await testDatabase.exercises.get(exercise.id)).toEqual(before.exercise)
    expect(await testDatabase.workoutSessions.get(realWorkout.session!.id)).toEqual(before.session)
    expect(await testDatabase.workoutExercises.get(realWorkout.relation.id)).toEqual(before.relation)
    expect(await testDatabase.exerciseSets.get(realWorkout.set.id)).toEqual(before.set)
    expect(await testDatabase.savedMeals.get(realMeal.id)).toEqual(before.meal)
    expect(await testDatabase.mealLogs.get(realLog.id)).toEqual(before.log)
  })

  it('does not duplicate records when the action is repeated', async () => {
    const first = await seedDemoData(testDatabase, asOf)
    const firstCounts = await Promise.all([
      testDatabase.workoutSessions.count(),
      testDatabase.exercises.count(),
      testDatabase.workoutExercises.count(),
      testDatabase.exerciseSets.count(),
      testDatabase.savedMeals.count(),
      testDatabase.mealLogs.count(),
    ])

    const second = await seedDemoData(testDatabase, asOf)
    const secondCounts = await Promise.all([
      testDatabase.workoutSessions.count(),
      testDatabase.exercises.count(),
      testDatabase.workoutExercises.count(),
      testDatabase.exerciseSets.count(),
      testDatabase.savedMeals.count(),
      testDatabase.mealLogs.count(),
    ])

    expect(first.alreadyLoaded).toBe(false)
    expect(second.alreadyLoaded).toBe(true)
    expect(secondCounts).toEqual(firstCounts)
  })

  it('rolls back failed writes and removes the uncommitted manifest', async () => {
    testDatabase.savedMeals.hook('creating').subscribe(() => {
      throw new Error('simulated saved-meal write failure')
    })

    await expect(seedDemoData(testDatabase, asOf)).rejects.toThrow(
      'simulated saved-meal write failure',
    )

    const counts = await Promise.all([
      testDatabase.workoutSessions.count(),
      testDatabase.exercises.count(),
      testDatabase.workoutExercises.count(),
      testDatabase.exerciseSets.count(),
      testDatabase.savedMeals.count(),
      testDatabase.mealLogs.count(),
    ])
    expect(counts).toEqual([0, 0, 0, 0, 0, 0])
    expect(localStorage.getItem('gym-tracker-demo-data-v1')).toBeNull()
  })

  it('cleans only tracked demo records and preserves records that use a demo exercise', async () => {
    const existingExercise = await createExercise(
      { name: 'Bench Press', category: 'chest', equipment: 'Barbell' },
      testDatabase,
    )
    const realWorkout = await createCompletedWorkout(existingExercise.id)
    const realMeal = await createSavedMeal(
      {
        name: 'My saved meal',
        servingDescription: 'One serving',
        calories: 450,
        proteinG: 25,
        carbsG: 40,
        fatG: 18,
        calorieSource: 'manual',
      },
      testDatabase,
    )
    const realLog = await createMealLog(
      {
        savedMealId: realMeal.id,
        consumedAt: '2026-10-18T13:00:00.000Z',
        mealType: 'lunch',
        portionPercent: 100,
      },
      testDatabase,
    )
    await seedDemoData(testDatabase, asOf)
    const userWorkout = await createWorkoutSession(
      {
        name: 'My workout after demo load',
        startedAt: createTimestamp(asOf),
        completedAt: null,
        status: 'in_progress',
        notes: '',
      },
      testDatabase,
    )
    const demoExercise = await testDatabase.exercises
      .where('name')
      .equals('Demo · Barbell Squat')
      .first()
    expect(demoExercise).toBeDefined()
    const userRelation = await addWorkoutExercise(
      { workoutId: userWorkout.id, exerciseId: demoExercise!.id },
      testDatabase,
    )

    const result = await removeDemoData(testDatabase)

    expect(result.removed.workoutSessions).toBe(5)
    expect(result.removed.exerciseSets).toBe(45)
    expect(result.removed.mealLogs).toBe(22)
    expect(result.manifestRetained).toBe(true)
    expect(result.preserved).toBeGreaterThan(0)
    expect(await testDatabase.workoutSessions.get(userWorkout.id)).toBeDefined()
    expect(await testDatabase.workoutExercises.get(userRelation.id)).toBeDefined()
    expect(await testDatabase.exercises.get(demoExercise!.id)).toBeDefined()
    expect(await testDatabase.workoutSessions.get(realWorkout.session!.id)).toEqual(
      realWorkout.session,
    )
    expect(await testDatabase.exercises.get(existingExercise.id)).toBeDefined()
    expect(await testDatabase.savedMeals.get(realMeal.id)).toBeDefined()
    expect(await testDatabase.mealLogs.get(realLog.id)).toBeDefined()
    expect(
      await testDatabase.workoutSessions
        .filter((session) => session.name.startsWith('Demo:'))
        .count(),
    ).toBe(0)
    await expect(seedDemoData(testDatabase, asOf)).rejects.toThrow(
      /still in use or have changed/,
    )
  })
})
