import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GymTrackerDatabase, DATABASE_VERSION } from '../../db/database'
import { addExerciseSet, addWorkoutExercise } from '../../db/repositories/workoutDetails'
import { createExercise } from '../../db/repositories/exercises'
import {
  createMealLog,
  createSavedMeal,
  updateSavedMeal,
} from '../../db/repositories/nutrition'
import { createWorkoutSession, updateWorkoutSession } from '../../db/repositories/workoutSessions'
import { createUUID } from '../../lib/dateTime'
import { createCsvExport } from './csvExport'
import {
  createBackup,
  importBackup,
  readBackupData,
} from './backupService'
import {
  BACKUP_FORMAT,
  BACKUP_TABLES,
  BACKUP_VERSION,
  MAX_BACKUP_RECORDS,
  parseBackupText,
  serializeBackup,
  validateBackup,
} from './backupFormat'

let testDatabase: GymTrackerDatabase
let sourceDatabase: GymTrackerDatabase | undefined
const databaseName = () => `gym-tracker-backups-${createUUID()}`

function timestamp(day: number, hour: number): string {
  return new Date(2026, 8, day, hour, 0, 0, 0).toISOString()
}

async function seedRecords(
  database: GymTrackerDatabase,
  options: { hostileText?: boolean } = {},
) {
  const workout = await createWorkoutSession(
    {
      name: options.hostileText ? '+Formula, "workout"\nsecond line' : 'Backup workout',
      startedAt: timestamp(20, 10),
      completedAt: null,
      status: 'in_progress',
      notes: options.hostileText ? '=1+1, session note' : 'Session notes',
    },
    database,
  )
  const exercise = await createExercise(
    {
      name: options.hostileText ? '@SUM(1,1)' : 'Bench Press',
      category: 'chest',
      equipment: 'Barbell',
    },
    database,
  )
  const relation = await addWorkoutExercise(
    {
      workoutId: workout.id,
      exerciseId: exercise.id,
      notes: options.hostileText ? '=2+2' : 'Controlled reps',
    },
    database,
  )
  const set = await addExerciseSet(
    {
      workoutExerciseId: relation.id,
      setNumber: 1,
      weightKg: 50,
      reps: 8,
      completed: true,
    },
    database,
  )
  await updateWorkoutSession(
    workout.id,
    { status: 'completed', completedAt: timestamp(20, 11) },
    database,
  )
  const meal = await createSavedMeal(
    {
      name: options.hostileText ? '=HYPERLINK("x","y")' : 'Déjeuner',
      servingDescription: 'one bowl, 250 g',
      calorieSource: 'manual',
      calories: 500,
      proteinG: 30,
      carbsG: 50,
      fatG: 10,
    },
    database,
  )
  const log = await createMealLog(
    {
      savedMealId: meal.id,
      consumedAt: timestamp(20, 12),
      mealType: 'lunch',
      portionPercent: 50,
    },
    database,
  )
  return { workout, exercise, relation, set, meal, log }
}

beforeEach(async () => {
  testDatabase = new GymTrackerDatabase(databaseName())
  await testDatabase.open()
})

afterEach(async () => {
  vi.restoreAllMocks()
  testDatabase.close()
  await testDatabase.delete()
  if (sourceDatabase) {
    sourceDatabase.close()
    await sourceDatabase.delete()
    sourceDatabase = undefined
  }
})

describe('versioned JSON backup', () => {
  it('exports every application table and round-trips IDs, relationships, and snapshots', async () => {
    const records = await seedRecords(testDatabase)
    const backup = await createBackup(testDatabase)
    const parsed = parseBackupText(serializeBackup(backup))

    expect(parsed.format).toBe(BACKUP_FORMAT)
    expect(parsed.backupVersion).toBe(BACKUP_VERSION)
    expect(parsed.schemaVersion).toBe(2)
    expect(Object.keys(parsed.data).sort()).toEqual([...BACKUP_TABLES].sort())
    expect(parsed.data.workoutSessions[0]).toMatchObject({
      id: records.workout.id,
      completedAt: timestamp(20, 11),
      deletedAt: null,
    })
    expect(parsed.data.workoutExercises[0]).toMatchObject({
      id: records.relation.id,
      workoutId: records.workout.id,
      exerciseId: records.exercise.id,
      exerciseNameSnapshot: 'Bench Press',
    })
    expect(parsed.data.exerciseSets[0]).toMatchObject({
      id: records.set.id,
      workoutExerciseId: records.relation.id,
      weightKg: 50,
      reps: 8,
    })
    expect(parsed.data.savedMeals[0].calories).toBe(500)
    expect(parsed.data.mealLogs[0]).toMatchObject({
      id: records.log.id,
      savedMealId: records.meal.id,
      mealNameSnapshot: 'Déjeuner',
      portionPercent: 50,
      nutritionSnapshot: {
        calories: 250,
        proteinG: 15,
        carbsG: 25,
        fatG: 5,
      },
    })
  })

  it('exports and validates an empty database backup', async () => {
    const backup = await createBackup(testDatabase)
    const parsed = validateBackup(backup)
    expect(parsed.data).toEqual({
      workoutSessions: [],
      exercises: [],
      workoutExercises: [],
      exerciseSets: [],
      savedMeals: [],
      mealLogs: [],
    })
  })

  it('reports read failures and leaves persisted records untouched', async () => {
    await seedRecords(testDatabase)
    const sessionCount = await testDatabase.workoutSessions.count()
    vi.spyOn(testDatabase.workoutSessions, 'toArray').mockRejectedValueOnce(
      new Error('Read failure'),
    )

    await expect(createBackup(testDatabase)).rejects.toThrow(/Read failure/)
    expect(await testDatabase.workoutSessions.count()).toBe(sessionCount)
  })

  it('rejects invalid JSON, formats, versions, missing tables, and invalid records', async () => {
    const backup = await createBackup(testDatabase)
    expect(() => parseBackupText('{not json')).toThrow(/valid JSON/)
    expect(() => validateBackup({ ...backup, format: 'other' })).toThrow(
      /not a Gym Tracker backup/,
    )
    expect(() => validateBackup({ ...backup, backupVersion: 99 })).toThrow(
      /format version/,
    )
    expect(() => validateBackup({ ...backup, schemaVersion: 0 })).toThrow(
      /older than the supported version/,
    )
    const v1Backup = { ...backup, schemaVersion: 1 }
    const validatedV1 = validateBackup(v1Backup)
    expect(validatedV1.schemaVersion).toBe(DATABASE_VERSION)
    expect(() => validateBackup({ ...backup, schemaVersion: 99 })).toThrow(
      /newer than the supported version/,
    )
    const missingTable = structuredClone(backup)
    delete (missingTable.data as Partial<typeof missingTable.data>).mealLogs
    expect(() => validateBackup(missingTable)).toThrow(/data.mealLogs/)

    await seedRecords(testDatabase)
    const invalidSet = await createBackup(testDatabase)
    invalidSet.data.exerciseSets[0].weightKg = -1
    const before = await readBackupData(testDatabase)
    await expect(
      importBackup(invalidSet, 'replace', testDatabase),
    ).rejects.toThrow(/exerciseSets\[0\] is invalid/)
    expect(await readBackupData(testDatabase)).toEqual(before)

    const invalidMeal = await createBackup(testDatabase)
    invalidMeal.data.savedMeals[0].proteinG = Number.POSITIVE_INFINITY
    expect(() => validateBackup(invalidMeal)).toThrow(/savedMeals\[0\] is invalid/)

    const invalidPortion = await createBackup(testDatabase)
    invalidPortion.data.mealLogs[0].portionPercent = 0
    expect(() => validateBackup(invalidPortion)).toThrow(/mealLogs\[0\] is invalid/)

    const invalidEstimate = await createBackup(testDatabase)
    invalidEstimate.data.savedMeals[0].calorieSource = 'macro_estimate'
    expect(() => validateBackup(invalidEstimate)).toThrow(/savedMeals\[0\] is invalid/)

    const tooMany = await createBackup(testDatabase)
    const tooManyInput: unknown = {
      ...tooMany,
      data: {
        ...tooMany.data,
        exercises: Array.from({ length: MAX_BACKUP_RECORDS + 1 }, () => null),
      },
    }
    expect(() => validateBackup(tooManyInput)).toThrow(/maximum of .* records/)
  })

  it('rejects duplicate IDs and broken relationships before any database write', async () => {
    await seedRecords(testDatabase)
    const backup = await createBackup(testDatabase)
    const duplicate = structuredClone(backup)
    duplicate.data.exercises.push({ ...duplicate.data.exercises[0] })
    expect(() => validateBackup(duplicate)).toThrow(/duplicate ID/)

    const brokenReference = structuredClone(backup)
    brokenReference.data.workoutExercises[0].workoutId = createUUID()
    const before = await readBackupData(testDatabase)
    await expect(
      importBackup(brokenReference, 'replace', testDatabase),
    ).rejects.toThrow(/missing workout session/)
    expect(await readBackupData(testDatabase)).toEqual(before)
  })

  it('preserves soft-deleted parents and snapshots needed by historical logs', async () => {
    const records = await seedRecords(testDatabase)
    await testDatabase.savedMeals.update(records.meal.id, {
      deletedAt: timestamp(21, 10),
      updatedAt: timestamp(21, 10),
    })
    const backup = parseBackupText(
      serializeBackup(await createBackup(testDatabase)),
    )
    expect(backup.data.savedMeals[0].deletedAt).toBe(timestamp(21, 10))
    expect(backup.data.mealLogs[0].mealNameSnapshot).toBe('Déjeuner')
  })
})

describe('backup import strategies', () => {
  it('merges new records, preserves IDs, and reports exact duplicates on repeat import', async () => {
    sourceDatabase = new GymTrackerDatabase(databaseName())
    await sourceDatabase.open()
    const records = await seedRecords(sourceDatabase)
    const backup = await createBackup(sourceDatabase)

    const first = await importBackup(backup, 'merge', testDatabase)
    expect(first.inserted.workoutSessions).toBe(1)
    expect(first.inserted.exerciseSets).toBe(1)
    expect(await testDatabase.workoutSessions.get(records.workout.id)).toMatchObject({
      id: records.workout.id,
      status: 'completed',
    })

    const second = await importBackup(backup, 'merge', testDatabase)
    expect(Object.values(second.inserted).every((count) => count === 0)).toBe(true)
    expect(Object.values(second.alreadyPresent).reduce((sum, count) => sum + count, 0)).toBe(6)
  })

  it('stops merge before writing when IDs conflict', async () => {
    sourceDatabase = new GymTrackerDatabase(databaseName())
    await sourceDatabase.open()
    await seedRecords(sourceDatabase)
    const backup = await createBackup(sourceDatabase)
    await importBackup(backup, 'merge', testDatabase)

    const conflictBackup = structuredClone(backup)
    conflictBackup.data.exercises[0].name = 'Different content for same ID'
    conflictBackup.data.exercises.push({
      ...conflictBackup.data.exercises[0],
      id: createUUID(),
      name: 'Would otherwise be new',
    })
    const before = await readBackupData(testDatabase)

    await expect(
      importBackup(conflictBackup, 'merge', testDatabase),
    ).rejects.toMatchObject({
      name: 'BackupConflictError',
      conflicts: [{ table: 'exercises' }],
    })
    expect(await readBackupData(testDatabase)).toEqual(before)
  })

  it('replaces all six tables with validated backup records', async () => {
    const original = await seedRecords(testDatabase)
    sourceDatabase = new GymTrackerDatabase(databaseName())
    await sourceDatabase.open()
    const replacementRecords = await seedRecords(sourceDatabase)
    const replacement = await createBackup(sourceDatabase)

    const result = await importBackup(replacement, 'replace', testDatabase)
    expect(Object.values(result.inserted)).toEqual([1, 1, 1, 1, 1, 1])
    expect(await testDatabase.workoutSessions.get(original.workout.id)).toBeUndefined()
    expect(
      await testDatabase.workoutSessions.get(replacementRecords.workout.id),
    ).toMatchObject({ id: replacementRecords.workout.id, status: 'completed' })
    expect(await testDatabase.exerciseSets.get(replacementRecords.set.id)).toBeDefined()
    expect(await testDatabase.mealLogs.get(replacementRecords.log.id)).toBeDefined()
  })

  it('rolls back replacement if any bulk write fails', async () => {
    const original = await seedRecords(testDatabase)
    sourceDatabase = new GymTrackerDatabase(databaseName())
    await sourceDatabase.open()
    await seedRecords(sourceDatabase)
    const replacement = await createBackup(sourceDatabase)
    vi.spyOn(testDatabase.exerciseSets, 'bulkAdd').mockRejectedValueOnce(
      new Error('Injected write failure'),
    )

    await expect(
      importBackup(replacement, 'replace', testDatabase),
    ).rejects.toThrow(/Injected write failure/)
    expect(await testDatabase.workoutSessions.get(original.workout.id)).toBeDefined()
    expect(await testDatabase.exercises.get(original.exercise.id)).toBeDefined()
    expect(await testDatabase.exerciseSets.get(original.set.id)).toBeDefined()
    expect(await testDatabase.mealLogs.get(original.log.id)).toBeDefined()
  })

  it('rolls back a merge transaction if a later table write fails', async () => {
    sourceDatabase = new GymTrackerDatabase(databaseName())
    await sourceDatabase.open()
    await seedRecords(sourceDatabase)
    const incoming = await createBackup(sourceDatabase)
    const before = await readBackupData(testDatabase)
    vi.spyOn(testDatabase.exerciseSets, 'bulkAdd').mockRejectedValueOnce(
      new Error('Injected merge failure'),
    )

    await expect(importBackup(incoming, 'merge', testDatabase)).rejects.toThrow(
      /Injected merge failure/,
    )
    expect(await readBackupData(testDatabase)).toEqual(before)
  })
})

describe('CSV reports', () => {
  it('escapes user text and protects spreadsheet formulas without changing numbers', async () => {
    await seedRecords(testDatabase, { hostileText: true })
    await createSavedMeal(
      {
        name: 'Déjeuner',
        servingDescription: 'one serving',
        calorieSource: 'manual',
        calories: 120,
        proteinG: 4,
        carbsG: 18,
        fatG: 3,
      },
      testDatabase,
    )
    const history = await createCsvExport('workout-history', testDatabase)
    const exercisesAndSets = await createCsvExport('workout-sets', testDatabase)
    const meals = await createCsvExport('saved-meals', testDatabase)

    expect(history).toContain('Workout ID,Workout name,Started at')
    expect(history).toContain(`"'+Formula, ""workout""\nsecond line"`)
    expect(history).toContain(`"'=1+1, session note"`)
    expect(exercisesAndSets).toContain(`"'@SUM(1,1)"`)
    expect(exercisesAndSets).toContain(",'=2+2,")
    expect(meals).toContain(`"'=HYPERLINK(""x"",""y"")"`)
    expect(exercisesAndSets).toContain(',50,8,true')
    expect(new TextDecoder().decode(new TextEncoder().encode(meals))).toContain(
      'Déjeuner',
    )
  })

  it('exports nutrition snapshots rather than later saved-meal values', async () => {
    const records = await seedRecords(testDatabase)
    await updateSavedMeal(
      records.meal.id,
      { calories: 900, proteinG: 80 },
      testDatabase,
    )
    const nutrition = await createCsvExport('nutrition-logs', testDatabase)
    const savedMeals = await createCsvExport('saved-meals', testDatabase)

    expect(nutrition).toContain('Meal log ID,Saved meal ID,Local date')
    expect(nutrition).toContain(',50,250,15,25,5')
    expect(savedMeals).toContain(',900,80,50,10,manual,')
  })
})
