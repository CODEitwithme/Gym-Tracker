import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import {
  createAiWorkoutLog,
  getAiWorkoutLog,
  listAiWorkoutLogs,
  softDeleteAiWorkoutLog,
} from './aiWorkoutLogs'
import {
  createExercise,
  listActiveExercises,
  softDeleteExercise,
  updateExercise,
} from './exercises'
import {
  createMealLog,
  createSavedMeal,
  getSavedMeal,
  listSavedMeals,
  listMealLogsForDate,
  searchSavedMeals,
  softDeleteMealLog,
  softDeleteSavedMeal,
  updateMealLog,
  updateSavedMeal,
} from './nutrition'
import {
  addExerciseSet,
  addWorkoutExercise,
  listExerciseSets,
  listWorkoutExercises,
  softDeleteExerciseSet,
  updateExerciseSet,
} from './workoutDetails'
import {
  createWorkoutSession,
  listWorkoutSessions,
  listWorkoutSessionsPage,
  softDeleteWorkoutSession,
  updateWorkoutSession,
} from './workoutSessions'
import { GymTrackerDatabase } from '../database'
import { applyMigrations, migrations } from '../migrations'
import { createUUID, formatLocalDate } from '../../lib/dateTime'
import { estimateCaloriesFromMacros, scaleNutrition } from '../../lib/nutrition'
import { kilogramsToPounds, poundsToKilograms } from '../../lib/units'

let testDatabase: GymTrackerDatabase

beforeEach(async () => {
  testDatabase = new GymTrackerDatabase(`gym-tracker-tests-${createUUID()}`)
  await testDatabase.open()
})

afterEach(async () => {
  testDatabase.close()
  await testDatabase.delete()
})

describe('data utilities', () => {
  it('formats dates in the local calendar', () => {
    const nearLocalMidnight = new Date(2025, 0, 10, 0, 30)
    expect(formatLocalDate(nearLocalMidnight)).toBe('2025-01-10')
    expect(formatLocalDate(nearLocalMidnight)).toBe(
      [
        nearLocalMidnight.getFullYear().toString().padStart(4, '0'),
        String(nearLocalMidnight.getMonth() + 1).padStart(2, '0'),
        String(nearLocalMidnight.getDate()).padStart(2, '0'),
      ].join('-'),
    )
  })

  it('converts kilograms and pounds', () => {
    expect(kilogramsToPounds(1)).toBeCloseTo(2.20462, 4)
    expect(poundsToKilograms(kilogramsToPounds(72.5))).toBeCloseTo(72.5, 10)
    expect(() => kilogramsToPounds(-1)).toThrow(/non-negative/)
  })

  it('scales nutrition by portion percentage and validates the portion', () => {
    expect(
      scaleNutrition(
        { calories: 250, proteinG: 20, carbsG: 30, fatG: 10 },
        50,
      ),
    ).toEqual({ calories: 125, proteinG: 10, carbsG: 15, fatG: 5 })
    expect(() =>
      scaleNutrition(
        { calories: 250, proteinG: 20, carbsG: 30, fatG: 10 },
        0,
      ),
    ).toThrow(/greater than zero/)
  })

  it('estimates calories from macros without replacing manual calories', async () => {
    expect(estimateCaloriesFromMacros({ proteinG: 20, carbsG: 30, fatG: 10 })).toBe(290)
    const manualMeal = await createSavedMeal(
      {
        name: 'Illustrative meal',
        servingDescription: 'One serving',
        calories: 500,
        proteinG: 20,
        carbsG: 30,
        fatG: 10,
        calorieSource: 'manual',
      },
      testDatabase,
    )
    const estimatedMeal = await createSavedMeal(
      {
        name: 'Estimated meal',
        servingDescription: 'One serving',
        proteinG: 20,
        carbsG: 30,
        fatG: 10,
        calorieSource: 'macro_estimate',
      },
      testDatabase,
    )
    expect(manualMeal.calories).toBe(500)
    expect(estimatedMeal.calories).toBe(290)
  })
})

describe('repositories', () => {
  it('creates, updates, orders, and soft-deletes workout records', async () => {
    const workout = await createWorkoutSession(
      {
        name: 'Training session',
        startedAt: '2025-01-09T10:00:00.000Z',
        completedAt: null,
        status: 'in_progress',
        notes: '',
      },
      testDatabase,
    )
    const exercise = await createExercise(
      { name: 'Example movement', category: 'other', equipment: null },
      testDatabase,
    )
    const workoutExercise = await addWorkoutExercise(
      { workoutId: workout.id, exerciseId: exercise.id },
      testDatabase,
    )
    const secondSet = await addExerciseSet(
      {
        workoutExerciseId: workoutExercise.id,
        setNumber: 2,
        weightKg: 20,
        reps: 8,
        completed: false,
      },
      testDatabase,
    )
    const firstSet = await addExerciseSet(
      {
        workoutExerciseId: workoutExercise.id,
        setNumber: 1,
        weightKg: 18,
        reps: 10,
        completed: true,
      },
      testDatabase,
    )
    await updateExerciseSet(firstSet.id, { weightKg: 19 }, testDatabase)
    expect(
      (await listExerciseSets(workoutExercise.id, testDatabase)).map(
        (set) => set.setNumber,
      ),
    ).toEqual([1, 2])
    const deletedSet = await softDeleteExerciseSet(secondSet.id, testDatabase)
    expect(deletedSet.deletedAt).not.toBeNull()
    expect(await listExerciseSets(workoutExercise.id, testDatabase)).toHaveLength(1)

    await softDeleteExercise(exercise.id, testDatabase)
    expect(await listActiveExercises(testDatabase)).toHaveLength(0)
    const deletedWorkout = await softDeleteWorkoutSession(workout.id, testDatabase)
    expect(deletedWorkout.deletedAt).not.toBeNull()
    expect(await listWorkoutSessions(testDatabase)).toHaveLength(0)
  })

  it('paginates workout sessions with keyset cursor pagination', async () => {
    await createWorkoutSession(
      {
        name: 'Session 1',
        startedAt: '2025-01-01T10:00:00.000Z',
        completedAt: '2025-01-01T11:00:00.000Z',
        status: 'completed',
        notes: '',
      },
      testDatabase,
    )
    await createWorkoutSession(
      {
        name: 'Session 2',
        startedAt: '2025-01-02T10:00:00.000Z',
        completedAt: '2025-01-02T11:00:00.000Z',
        status: 'completed',
        notes: '',
      },
      testDatabase,
    )
    await createWorkoutSession(
      {
        name: 'Session 3',
        startedAt: '2025-01-03T10:00:00.000Z',
        completedAt: '2025-01-03T11:00:00.000Z',
        status: 'completed',
        notes: '',
      },
      testDatabase,
    )

    const page1 = await listWorkoutSessionsPage({ limit: 2 }, testDatabase)
    expect(page1).toHaveLength(2)
    expect(page1.map((s) => s.name)).toEqual(['Session 3', 'Session 2'])

    const page2 = await listWorkoutSessionsPage(
      { cursorStartedAt: page1[1].startedAt, limit: 2 },
      testDatabase,
    )
    expect(page2).toHaveLength(1)
    expect(page2[0].name).toBe('Session 1')
  })

  it('does not create a workout exercise when its related record is missing', async () => {
    const workout = await createWorkoutSession(
      {
        name: 'Training session',
        startedAt: '2025-01-09T10:00:00.000Z',
        completedAt: null,
        status: 'in_progress',
        notes: '',
      },
      testDatabase,
    )
    await expect(
      addWorkoutExercise(
        { workoutId: workout.id, exerciseId: 'missing-exercise' },
        testDatabase,
      ),
    ).rejects.toThrow(/not found/)
    expect(await testDatabase.workoutExercises.count()).toBe(0)
  })

  it('rejects invalid workout sets and accepts bodyweight zero', async () => {
    const workout = await createWorkoutSession(
      {
        name: 'Validation workout',
        startedAt: '2025-01-09T10:00:00.000Z',
        completedAt: null,
        status: 'in_progress',
        notes: '',
      },
      testDatabase,
    )
    const exercise = await createExercise(
      { name: 'Bodyweight movement', category: 'core', equipment: null },
      testDatabase,
    )
    const workoutExercise = await addWorkoutExercise(
      { workoutId: workout.id, exerciseId: exercise.id },
      testDatabase,
    )
    await expect(
      addExerciseSet(
        {
          workoutExerciseId: workoutExercise.id,
          setNumber: 1,
          weightKg: -1,
          reps: 5,
          completed: true,
        },
        testDatabase,
      ),
    ).rejects.toThrow(/non-negative/)
    await expect(
      addExerciseSet(
        {
          workoutExerciseId: workoutExercise.id,
          setNumber: 1.5,
          weightKg: 0,
          reps: 5,
          completed: true,
        },
        testDatabase,
      ),
    ).rejects.toThrow(/positive integer/)
    await expect(
      addExerciseSet(
        {
          workoutExerciseId: workoutExercise.id,
          setNumber: 1,
          weightKg: 0,
          reps: 5.5,
          completed: true,
        },
        testDatabase,
      ),
    ).rejects.toThrow(/positive integer/)
    const bodyweightSet = await addExerciseSet(
      {
        workoutExerciseId: workoutExercise.id,
        setNumber: 1,
        weightKg: 0,
        reps: 5,
        completed: true,
      },
      testDatabase,
    )
    expect(bodyweightSet.weightKg).toBe(0)
    expect(bodyweightSet.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(bodyweightSet.deletedAt).toBeNull()
  })

  it('rejects blank required names and invalid timestamps', async () => {
    await expect(
      createWorkoutSession(
        {
          name: '   ',
          startedAt: '2025-01-09T10:00:00.000Z',
          completedAt: null,
          status: 'in_progress',
          notes: '',
        },
        testDatabase,
      ),
    ).rejects.toThrow(/must not be blank/)
    await expect(
      createExercise(
        { name: '', category: 'other', equipment: null },
        testDatabase,
      ),
    ).rejects.toThrow(/must not be blank/)
    await expect(
      createWorkoutSession(
        {
          name: 'Valid name',
          startedAt: '2025-02-30T10:00:00.000Z',
          completedAt: null,
          status: 'in_progress',
          notes: '',
        },
        testDatabase,
      ),
    ).rejects.toThrow(/ISO 8601/)
  })

  it('keeps workout IDs stable through updates and preserves exercise-name snapshots', async () => {
    const workout = await createWorkoutSession(
      {
        name: 'Training session',
        startedAt: '2025-01-09T10:00:00.000Z',
        completedAt: null,
        status: 'in_progress',
        notes: '',
      },
      testDatabase,
    )
    const updatedWorkout = await updateWorkoutSession(
      workout.id,
      { name: 'Renamed session' },
      testDatabase,
    )
    expect(updatedWorkout.id).toBe(workout.id)

    const exercise = await createExercise(
      { name: 'Original name', category: 'other', equipment: null },
      testDatabase,
    )
    await addWorkoutExercise(
      { workoutId: workout.id, exerciseId: exercise.id },
      testDatabase,
    )
    await updateExercise(exercise.id, { name: 'Updated name' }, testDatabase)
    expect(await listWorkoutExercises(workout.id, testDatabase)).toMatchObject([
      { exerciseNameSnapshot: 'Original name' },
    ])
  })

  it('rolls back related writes when a transaction fails', async () => {
    await expect(
      testDatabase.transaction(
        'rw',
        [
          testDatabase.workoutSessions,
          testDatabase.exercises,
          testDatabase.workoutExercises,
        ],
        async () => {
          const workout = await createWorkoutSession(
            {
              name: 'Transaction test',
              startedAt: '2025-01-09T10:00:00.000Z',
              completedAt: null,
              status: 'in_progress',
              notes: '',
            },
            testDatabase,
          )
          await addWorkoutExercise(
            { workoutId: workout.id, exerciseId: 'missing-exercise' },
            testDatabase,
          )
        },
      ),
    ).rejects.toThrow(/not found/)
    expect(await testDatabase.workoutSessions.count()).toBe(0)
    expect(await testDatabase.workoutExercises.count()).toBe(0)
  })

  it('preserves the meal name and portion-scaled nutrition snapshot', async () => {
    const savedMeal = await createSavedMeal(
      {
        name: 'Saved name',
        servingDescription: 'One serving',
        calories: 400,
        proteinG: 20,
        carbsG: 40,
        fatG: 10,
        calorieSource: 'manual',
      },
      testDatabase,
    )
    const log = await createMealLog(
      {
        savedMealId: savedMeal.id,
        consumedAt: '2025-01-09T23:30:00-05:00',
        mealType: 'lunch',
        portionPercent: 50,
      },
      testDatabase,
    )
    await updateSavedMeal(
      savedMeal.id,
      {
        name: 'Edited saved name',
        calories: 900,
        proteinG: 90,
        carbsG: 90,
        fatG: 90,
      },
      testDatabase,
    )
    expect((await getSavedMeal(savedMeal.id, testDatabase))?.name).toBe(
      'Edited saved name',
    )
    expect(await searchSavedMeals('edited', testDatabase)).toHaveLength(1)
    const persistedLog = (await listMealLogsForDate(log.localDate, testDatabase))[0]
    expect(persistedLog.mealNameSnapshot).toBe('Saved name')
    expect(persistedLog.nutritionSnapshot).toEqual({
      calories: 200,
      proteinG: 10,
      carbsG: 20,
      fatG: 5,
    })
    expect(log.localDate).toBe(
      formatLocalDate(new Date('2025-01-09T23:30:00-05:00')),
    )
    expect(persistedLog.localDate).toBe(log.localDate)
  })

  it('updates and soft-deletes meal logs', async () => {
    const meal = await createSavedMeal(
      {
        name: 'Logged meal',
        servingDescription: 'One serving',
        calories: 250,
        proteinG: 10,
        carbsG: 30,
        fatG: 8,
        calorieSource: 'manual',
      },
      testDatabase,
    )
    const log = await createMealLog(
      {
        savedMealId: meal.id,
        consumedAt: '2025-01-09T12:00:00.000Z',
        mealType: 'lunch',
        portionPercent: 100,
      },
      testDatabase,
    )
    const updated = await updateMealLog(
      log.id,
      {
        consumedAt: '2025-01-10T00:30:00+05:30',
        portionPercent: 50,
        mealType: 'dinner',
      },
      testDatabase,
    )
    expect(updated.mealType).toBe('dinner')
    expect(updated.nutritionSnapshot.calories).toBe(125)
    expect(updated.localDate).toBe(
      formatLocalDate(new Date(updated.consumedAt)),
    )
    const deleted = await softDeleteMealLog(log.id, testDatabase)
    expect(deleted.deletedAt).not.toBeNull()
    expect(await listMealLogsForDate(updated.localDate, testDatabase)).toHaveLength(0)
  })

  it('soft-deletes saved meals without deleting their meal logs', async () => {
    const savedMeal = await createSavedMeal(
      {
        name: 'Meal for soft deletion',
        servingDescription: 'One serving',
        calories: 120,
        proteinG: 5,
        carbsG: 15,
        fatG: 4,
        calorieSource: 'manual',
      },
      testDatabase,
    )
    const mealLog = await createMealLog(
      {
        savedMealId: savedMeal.id,
        consumedAt: '2025-01-09T12:00:00.000Z',
        mealType: 'snack',
        portionPercent: 100,
      },
      testDatabase,
    )
    const deleted = await softDeleteSavedMeal(savedMeal.id, testDatabase)
    expect(deleted.deletedAt).not.toBeNull()
    expect(deleted.updatedAt).toBe(deleted.deletedAt)
    expect(await testDatabase.savedMeals.count()).toBe(1)
    expect(await listSavedMeals(testDatabase)).toHaveLength(0)
    expect(await searchSavedMeals('soft deletion', testDatabase)).toHaveLength(0)
    expect(await listMealLogsForDate(mealLog.localDate, testDatabase)).toHaveLength(1)
    await expect(
      createMealLog(
        {
          savedMealId: savedMeal.id,
          consumedAt: '2025-01-09T13:00:00.000Z',
          mealType: 'snack',
          portionPercent: 100,
        },
        testDatabase,
      ),
    ).rejects.toThrow(/not found/)
    expect(await listMealLogsForDate(mealLog.localDate, testDatabase)).toHaveLength(1)
  })

  it('rejects invalid nutrition values and non-positive meal portions', async () => {
    await expect(
      createSavedMeal(
        {
          name: 'Invalid nutrition',
          servingDescription: 'One serving',
          calories: 100,
          proteinG: -1,
          carbsG: 10,
          fatG: 5,
          calorieSource: 'manual',
        },
        testDatabase,
      ),
    ).rejects.toThrow(/non-negative/)

    const meal = await createSavedMeal(
      {
        name: 'Valid meal',
        servingDescription: 'One serving',
        calories: 100,
        proteinG: 5,
        carbsG: 10,
        fatG: 2,
        calorieSource: 'manual',
      },
      testDatabase,
    )
    await expect(
      createMealLog(
        {
          savedMealId: meal.id,
          consumedAt: '2025-01-09T12:00:00.000Z',
          mealType: 'lunch',
          portionPercent: 0,
        },
        testDatabase,
      ),
    ).rejects.toThrow(/greater than zero/)
    await expect(
      createMealLog(
        {
          savedMealId: meal.id,
          consumedAt: '2025-01-09T12:00:00.000Z',
          mealType: 'lunch',
          portionPercent: 100,
        },
        testDatabase,
      ),
    ).resolves.toMatchObject({ localDate: expect.any(String) })
  })

  it('preserves existing records when applying a later schema version', async () => {
    const databaseName = `gym-tracker-migration-${createUUID()}`
    const legacy = new Dexie(databaseName)
    legacy.version(1).stores({ workoutSessions: 'id,name' })
    await legacy.open()
    await legacy.table('workoutSessions').add({
      id: createUUID(),
      name: 'Legacy session',
    })
    const [legacyRecord] = await legacy.table('workoutSessions').toArray()
    legacy.close()

    const upgraded = new Dexie(databaseName)
    applyMigrations(upgraded, [{ ...migrations[0], version: 2 }])
    await upgraded.open()
    expect(await upgraded.table('workoutSessions').get(legacyRecord.id)).toEqual(
      legacyRecord,
    )
    expect(upgraded.tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        'workoutSessions',
        'exercises',
        'workoutExercises',
        'exerciseSets',
        'savedMeals',
        'mealLogs',
      ]),
    )
    upgraded.close()
    await upgraded.delete()
  })

  it('creates, retrieves, lists, and soft-deletes AI workout logs', async () => {
    const workout = await createWorkoutSession(
      {
        name: 'AI Tracked Workout',
        startedAt: '2025-01-09T10:00:00.000Z',
        completedAt: null,
        status: 'in_progress',
        notes: 'Created via AI Logger',
      },
      testDatabase,
    )
    const log = await createAiWorkoutLog(
      {
        workoutSessionId: workout.id,
        originalMessage: 'did 3 sets of bench press 10 reps at 80kg',
        provider: 'gemini',
        parsedExercise: 'Bench Press',
        confidence: 'high',
      },
      testDatabase,
    )
    expect(log.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(log.workoutSessionId).toBe(workout.id)
    expect(log.originalMessage).toBe('did 3 sets of bench press 10 reps at 80kg')
    expect(log.provider).toBe('gemini')
    expect(log.parsedExercise).toBe('Bench Press')
    expect(log.confidence).toBe('high')
    expect(log.deletedAt).toBeNull()
    expect(log.createdAt).toBeDefined()
    expect(log.updatedAt).toBeDefined()

    const retrieved = await getAiWorkoutLog(workout.id, testDatabase)
    expect(retrieved).toEqual(log)

    const missing = await getAiWorkoutLog('unknown-session-id', testDatabase)
    expect(missing).toBeUndefined()

    const activeLogs = await listAiWorkoutLogs(testDatabase)
    expect(activeLogs).toHaveLength(1)
    expect(activeLogs[0].id).toBe(log.id)

    const deleted = await softDeleteAiWorkoutLog(log.id, testDatabase)
    expect(deleted.deletedAt).not.toBeNull()
    expect(deleted.updatedAt).toBe(deleted.deletedAt)
    expect(await getAiWorkoutLog(workout.id, testDatabase)).toBeUndefined()
    expect(await listAiWorkoutLogs(testDatabase)).toHaveLength(0)
  })

  it('rejects invalid AI workout log inputs', async () => {
    await expect(
      createAiWorkoutLog(
        {
          workoutSessionId: '',
          originalMessage: '3 sets bench press',
          provider: 'gemini',
          parsedExercise: 'Bench Press',
          confidence: 'high',
        },
        testDatabase,
      ),
    ).rejects.toThrow(/Workout session ID/)

    await expect(
      createAiWorkoutLog(
        {
          workoutSessionId: createUUID(),
          originalMessage: '   ',
          provider: 'gemini',
          parsedExercise: 'Bench Press',
          confidence: 'high',
        },
        testDatabase,
      ),
    ).rejects.toThrow(/Original message/)

    await expect(
      createAiWorkoutLog(
        {
          workoutSessionId: createUUID(),
          originalMessage: '3 sets bench press',
          provider: 'gemini',
          parsedExercise: '',
          confidence: 'high',
        },
        testDatabase,
      ),
    ).rejects.toThrow(/Parsed exercise/)

    await expect(
      createAiWorkoutLog(
        {
          workoutSessionId: createUUID(),
          originalMessage: '3 sets bench press',
          provider: 'unsupported' as unknown as 'gemini',
          parsedExercise: 'Bench Press',
          confidence: 'high',
        },
        testDatabase,
      ),
    ).rejects.toThrow(/Provider must be gemini/)

    await expect(
      createAiWorkoutLog(
        {
          workoutSessionId: createUUID(),
          originalMessage: '3 sets bench press',
          provider: 'gemini',
          parsedExercise: 'Bench Press',
          confidence: 'medium' as unknown as 'high',
        },
        testDatabase,
      ),
    ).rejects.toThrow(/Confidence must be high or low/)
  })

  it('migrates from version 1 to version 2 schema and includes aiWorkoutLogs table', async () => {
    const databaseName = `gym-tracker-v1-to-v2-${createUUID()}`
    const dbV1 = new Dexie(databaseName)
    applyMigrations(dbV1, [migrations[0]])
    await dbV1.open()
    expect(dbV1.tables.map((table) => table.name)).not.toContain('aiWorkoutLogs')
    dbV1.close()

    const dbV2 = new Dexie(databaseName)
    applyMigrations(dbV2, migrations)
    await dbV2.open()
    expect(dbV2.tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        'workoutSessions',
        'exercises',
        'workoutExercises',
        'exerciseSets',
        'savedMeals',
        'mealLogs',
        'aiWorkoutLogs',
      ]),
    )
    dbV2.close()
    await dbV2.delete()
  })
})
