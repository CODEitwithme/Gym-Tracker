import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GymTrackerDatabase } from '../../db/database'
import {
  addExerciseSet,
  addWorkoutExercise,
  softDeleteExerciseSet,
} from '../../db/repositories/workoutDetails'
import {
  createExercise,
  softDeleteExercise,
} from '../../db/repositories/exercises'
import {
  createMealLog,
  createSavedMeal,
  softDeleteMealLog,
  updateSavedMeal,
} from '../../db/repositories/nutrition'
import { createWorkoutSession, softDeleteWorkoutSession, updateWorkoutSession } from '../../db/repositories/workoutSessions'
import { createUUID, formatLocalDate } from '../../lib/dateTime'
import {
  loadDashboardAnalytics,
  loadExerciseProgress,
} from './analyticsService'
import dashboardReducer, {
  loadDashboardThunk,
  loadExerciseProgressThunk,
  setDashboardPeriod,
} from './dashboardSlice'

let testDatabase: GymTrackerDatabase
const databaseName = () => `gym-tracker-analytics-${createUUID()}`
const asOf = new Date(2026, 9, 18, 12)

function localDay(offset: number): Date {
  const date = new Date(asOf)
  date.setDate(date.getDate() + offset)
  date.setHours(12, 0, 0, 0)
  return date
}

function localTimestamp(date: Date, hour: number): string {
  const timestamp = new Date(date)
  timestamp.setHours(hour, 0, 0, 0)
  return timestamp.toISOString()
}

async function makeExercise(name = 'Bench Press') {
  return createExercise(
    { name, category: 'chest', equipment: 'Barbell' },
    testDatabase,
  )
}

async function makeWorkout(
  date: Date,
  exercise: Awaited<ReturnType<typeof makeExercise>>,
  sets: Array<{ weightKg: number; reps: number; completed: boolean }>,
  name = 'Training session',
  invalidStart = false,
  softDeleteSetIndexes: number[] = [],
) {
  const session = await createWorkoutSession(
    {
      name,
      startedAt: localTimestamp(date, 16),
      completedAt: null,
      status: 'in_progress',
      notes: '',
    },
    testDatabase,
  )
  const relation = await addWorkoutExercise(
    { workoutId: session.id, exerciseId: exercise.id },
    testDatabase,
  )
  const storedSets = []
  for (const [index, set] of sets.entries()) {
    storedSets.push(
      await addExerciseSet(
        {
          workoutExerciseId: relation.id,
          setNumber: index + 1,
          ...set,
        },
        testDatabase,
      ),
    )
  }
  for (const index of softDeleteSetIndexes) {
    const set = storedSets[index]
    if (set) await softDeleteExerciseSet(set.id, testDatabase)
  }
  const completedAt = localTimestamp(date, 18)
  const completed = await updateWorkoutSession(
    session.id,
    { status: 'completed', completedAt },
    testDatabase,
  )
  if (invalidStart) {
    await testDatabase.workoutSessions.update(completed.id, {
      startedAt: 'invalid timestamp',
    })
  }
  return { session: completed, relation, sets: storedSets }
}

async function makeMeal(date: Date, name: string, calories: number) {
  const meal = await createSavedMeal(
    {
      name,
      servingDescription: 'one serving',
      calorieSource: 'manual',
      calories,
      proteinG: 20,
      carbsG: 30,
      fatG: 10,
    },
    testDatabase,
  )
  const log = await createMealLog(
    {
      savedMealId: meal.id,
      consumedAt: localTimestamp(date, 13),
      mealType: 'lunch',
      portionPercent: 50,
    },
    testDatabase,
  )
  return { meal, log }
}

beforeEach(async () => {
  testDatabase = new GymTrackerDatabase(databaseName())
  await testDatabase.open()
})

afterEach(async () => {
  testDatabase.close()
  await testDatabase.delete()
})

describe('progress analytics service', () => {
  it('uses inclusive local calendar bounds and compares equal non-overlapping periods', async () => {
    const exercise = await makeExercise()
    await makeWorkout(localDay(-6), exercise, [], 'First current day')
    await makeWorkout(localDay(0), exercise, [], 'Last current day')
    await makeWorkout(localDay(-7), exercise, [], 'Previous period')
    await makeWorkout(localDay(-14), exercise, [], 'Outside both periods')

    const analytics = await loadDashboardAnalytics(7, testDatabase, asOf)

    expect(analytics.period).toMatchObject({
      startDate: formatLocalDate(localDay(-6)),
      endDate: formatLocalDate(asOf),
      previousStartDate: formatLocalDate(localDay(-13)),
      previousEndDate: formatLocalDate(localDay(-7)),
    })
    expect(analytics.workouts.count).toBe(2)
    expect(analytics.workouts.trainingDays).toBe(2)
    expect(analytics.comparison.workouts).toBe(1)
    expect(analytics.days).toHaveLength(7)
  })

  it('counts distinct local training days and safely totals valid duration', async () => {
    const exercise = await makeExercise()
    await makeWorkout(localDay(-1), exercise, [], 'Same day one')
    await makeWorkout(localDay(-1), exercise, [], 'Same day two', true)

    const analytics = await loadDashboardAnalytics(7, testDatabase, asOf)

    expect(analytics.workouts.count).toBe(2)
    expect(analytics.workouts.trainingDays).toBe(1)
    expect(analytics.workouts.totalDurationSeconds).toBe(7200)
    expect(analytics.workouts.recent.some((item) => item.durationSeconds === null)).toBe(true)
  })

  it('calculates external-load volume from valid completed sets only', async () => {
    const exercise = await makeExercise()
    const workout = await makeWorkout(localDay(-2), exercise, [
      { weightKg: 50, reps: 8, completed: true },
      { weightKg: 120, reps: 4, completed: false },
      { weightKg: 0, reps: 10, completed: true },
    ], 'Training session', false, [0])
    await testDatabase.exerciseSets.update(workout.sets[2].id, {
      weightKg: Number.NaN,
    })

    const analytics = await loadDashboardAnalytics(7, testDatabase, asOf)

    expect(analytics.workouts.totalVolumeKg).toBe(0)
    expect(analytics.days.find((day) => day.date === formatLocalDate(localDay(-2)))?.trainingVolumeKg).toBe(0)
  })

  it('excludes soft-deleted workouts, relations, exercises, and sets from statistics', async () => {
    const exercise = await makeExercise()
    const deletedExercise = await makeExercise('Deleted exercise')
    const kept = await makeWorkout(localDay(-2), exercise, [
      { weightKg: 40, reps: 10, completed: true },
    ])
    const deletedSession = await makeWorkout(localDay(-1), exercise, [
      { weightKg: 100, reps: 10, completed: true },
    ])
    const deletedExerciseWorkout = await makeWorkout(localDay(-1), deletedExercise, [
      { weightKg: 100, reps: 10, completed: true },
    ])
    await softDeleteWorkoutSession(deletedSession.session.id, testDatabase)
    await softDeleteExercise(deletedExercise.id, testDatabase)
    await testDatabase.workoutExercises.update(kept.relation.id, {
      deletedAt: new Date().toISOString(),
    })

    const analytics = await loadDashboardAnalytics(7, testDatabase, asOf)

    expect(analytics.workouts.count).toBe(2)
    expect(analytics.workouts.totalVolumeKg).toBe(0)
    expect(deletedExerciseWorkout.session.status).toBe('completed')
  })

  it('groups portion-scaled nutrition snapshots by local date and preserves empty-day distinction', async () => {
    const { meal, log } = await makeMeal(localDay(-1), 'Historic lunch', 500)
    await updateSavedMeal(meal.id, { calories: 900 }, testDatabase)
    const zeroMeal = await createSavedMeal(
      {
        name: 'Zero nutrition entry',
        servingDescription: 'one serving',
        calorieSource: 'manual',
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      },
      testDatabase,
    )
    const zeroLog = await createMealLog(
      {
        savedMealId: zeroMeal.id,
        consumedAt: localTimestamp(localDay(-2), 14),
        mealType: 'snack',
        portionPercent: 100,
      },
      testDatabase,
    )
    await softDeleteMealLog(zeroLog.id, testDatabase)

    const analytics = await loadDashboardAnalytics(7, testDatabase, asOf)
    const loggedDay = analytics.days.find((day) => day.date === formatLocalDate(localDay(-1)))
    const emptyDay = analytics.days.find((day) => day.date === formatLocalDate(localDay(-3)))

    expect(log.nutritionSnapshot.calories).toBe(250)
    expect(loggedDay).toMatchObject({
      hasMealEntries: true,
      nutrition: { calories: 250, proteinG: 10, carbsG: 15, fatG: 5 },
    })
    expect(emptyDay).toMatchObject({
      hasMealEntries: false,
      nutrition: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    })
    expect(analytics.nutrition.averagePerCalendarDay.calories).toBeCloseTo(250 / 7)
    expect(analytics.nutrition.mealLogCount).toBe(1)
  })

  it('uses only the exact exercise ID and completed history for best recorded weight', async () => {
    const exercise = await makeExercise()
    const otherExercise = await makeExercise('Different movement')
    const older = await makeWorkout(localDay(-8), exercise, [
      { weightKg: 60, reps: 5, completed: true },
      { weightKg: 80, reps: 1, completed: false },
    ])
    await makeWorkout(localDay(-1), exercise, [
      { weightKg: 55, reps: 8, completed: true },
    ])
    await makeWorkout(localDay(-1), otherExercise, [
      { weightKg: 200, reps: 1, completed: true },
    ])
    await makeWorkout(localDay(-2), exercise, [
      { weightKg: 120, reps: 1, completed: true },
    ], 'Deleted-set fixture', false, [0])
    const inProgress = await createWorkoutSession(
      {
        name: 'Still working',
        startedAt: localTimestamp(localDay(-1), 16),
        completedAt: null,
        status: 'in_progress',
        notes: '',
      },
      testDatabase,
    )
    const inProgressRelation = await addWorkoutExercise(
      { workoutId: inProgress.id, exerciseId: exercise.id },
      testDatabase,
    )
    await addExerciseSet(
      {
        workoutExerciseId: inProgressRelation.id,
        setNumber: 1,
        weightKg: 250,
        reps: 1,
        completed: true,
      },
      testDatabase,
    )

    const progress = await loadExerciseProgress(exercise.id, testDatabase)

    expect(progress.bestRecordedWeightKg).toBe(60)
    expect(progress.entries).toHaveLength(2)
    expect(progress.entries[0].workoutId).toBe(older.session.id)
    expect(progress.entries[0].exerciseNameSnapshot).toBe('Bench Press')
  })

  it('returns a real empty result and excludes soft-deleted selected exercises', async () => {
    const exercise = await makeExercise()
    expect(await loadExerciseProgress(exercise.id, testDatabase)).toEqual({
      exerciseId: exercise.id,
      bestRecordedWeightKg: null,
      entries: [],
    })
    await softDeleteExercise(exercise.id, testDatabase)
    await expect(loadExerciseProgress(exercise.id, testDatabase)).rejects.toThrow(
      /no longer available/,
    )
  })
})

describe('dashboard async state', () => {
  it('ignores stale period responses and exposes recoverable load errors', () => {
    let state = dashboardReducer(undefined, setDashboardPeriod(7))
    state = dashboardReducer(state, loadDashboardThunk.pending('older', 7))
    state = dashboardReducer(state, setDashboardPeriod(30))
    state = dashboardReducer(state, loadDashboardThunk.pending('latest', 30))
    state = dashboardReducer(
      state,
      loadDashboardThunk.rejected(
        new Error('Storage unavailable'),
        'older',
        7,
      ),
    )
    expect(state.status).toBe('loading')
    expect(state.error).toBeNull()

    state = dashboardReducer(
      state,
      loadDashboardThunk.rejected(
        new Error('Storage unavailable'),
        'latest',
        30,
      ),
    )
    expect(state.status).toBe('failed')
    expect(state.error).toBe('Storage unavailable')
    expect(state.period).toBe(30)
  })

  it('ignores stale exercise-history results after a new selection', () => {
    let state = dashboardReducer(
      undefined,
      loadExerciseProgressThunk.pending('older-exercise', 'exercise-a'),
    )
    state = dashboardReducer(
      state,
      loadExerciseProgressThunk.pending('new-exercise', 'exercise-b'),
    )
    state = dashboardReducer(
      state,
      loadExerciseProgressThunk.rejected(
        new Error('Old request failed'),
        'older-exercise',
        'exercise-a',
      ),
    )
    expect(state.exerciseStatus).toBe('loading')
    expect(state.exerciseError).toBeNull()
    expect(state.exerciseRequestId).toBe('new-exercise')
  })
})
