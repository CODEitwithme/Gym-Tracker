import type { GymTrackerDatabase } from '../../db/database'
import { db } from '../../db/database'
import {
  createSavedMeal,
  createMealLog,
} from '../../db/repositories/nutrition'
import { createExercise } from '../../db/repositories/exercises'
import {
  addExerciseSet,
  addWorkoutExercise,
} from '../../db/repositories/workoutDetails'
import {
  createWorkoutSession,
  updateWorkoutSession,
} from '../../db/repositories/workoutSessions'
import { createTimestamp, createUUID, formatLocalDate } from '../../lib/dateTime'
import type { MealLog, SavedMeal } from '../nutrition/types'
import type {
  Exercise,
  ExerciseSet,
  WorkoutExercise,
  WorkoutSession,
} from '../workouts/types'

const DEMO_MANIFEST_KEY = 'gym-tracker-demo-data-v1'

type RecordGroups = {
  workoutSessions: WorkoutSession[]
  exercises: Exercise[]
  workoutExercises: WorkoutExercise[]
  exerciseSets: ExerciseSet[]
  savedMeals: SavedMeal[]
  mealLogs: MealLog[]
}

type IdGroups = { [K in keyof RecordGroups]: string[] }

interface DemoManifest {
  version: 1
  operationId: string
  state: 'prepared' | 'loaded' | 'cleanup_pending'
  startDate: string
  endDate: string
  ids: IdGroups
  records: RecordGroups
}

export interface DemoDataCounts {
  workoutSessions: number
  exercises: number
  workoutExercises: number
  exerciseSets: number
  savedMeals: number
  mealLogs: number
}

export interface DemoSeedResult extends DemoDataCounts {
  startDate: string
  endDate: string
  alreadyLoaded: boolean
}

export interface DemoCleanupResult {
  removed: DemoDataCounts
  preserved: number
  manifestRetained: boolean
}

const recordGroupNames: Array<keyof RecordGroups> = [
  'workoutSessions',
  'exercises',
  'workoutExercises',
  'exerciseSets',
  'savedMeals',
  'mealLogs',
]

const emptyRecords = (): RecordGroups => ({
  workoutSessions: [],
  exercises: [],
  workoutExercises: [],
  exerciseSets: [],
  savedMeals: [],
  mealLogs: [],
})

const emptyIds = (): IdGroups => ({
  workoutSessions: [],
  exercises: [],
  workoutExercises: [],
  exerciseSets: [],
  savedMeals: [],
  mealLogs: [],
})

function storage(): Storage {
  if (typeof globalThis.localStorage === 'undefined') {
    throw new Error('Browser local storage is required to track demo records safely.')
  }
  return globalThis.localStorage
}

function parseManifest(raw: string): DemoManifest {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new Error(
      'The demo-data manifest is unreadable. No demo operation was performed; do not remove it manually unless you have verified its contents.',
    )
  }
  if (typeof value !== 'object' || value === null) {
    throw new Error('The demo-data manifest is invalid. No records were changed.')
  }
  const candidate = value as Partial<DemoManifest>
  if (
    candidate.version !== 1 ||
    typeof candidate.operationId !== 'string' ||
    !['prepared', 'loaded', 'cleanup_pending'].includes(
      candidate.state ?? '',
    ) ||
    typeof candidate.startDate !== 'string' ||
    typeof candidate.endDate !== 'string' ||
    typeof candidate.ids !== 'object' ||
    candidate.ids === null ||
    typeof candidate.records !== 'object' ||
    candidate.records === null
  ) {
    throw new Error('The demo-data manifest is invalid. No records were changed.')
  }
  for (const group of recordGroupNames) {
    const ids = candidate.ids[group]
    const records = candidate.records[group]
    if (
      !Array.isArray(ids) ||
      !ids.every((id) => typeof id === 'string') ||
      !Array.isArray(records) ||
      !records.every(
        (record) =>
          typeof record === 'object' &&
          record !== null &&
          typeof (record as { id?: unknown }).id === 'string',
      )
    ) {
      throw new Error('The demo-data manifest is invalid. No records were changed.')
    }
  }
  return candidate as DemoManifest
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left.localeCompare(right),
    )
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

function sameRecord(left: unknown, right: unknown): boolean {
  return stableSerialize(left) === stableSerialize(right)
}

function localDay(date: Date, offset: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + offset)
  return result
}

function atLocalTime(date: Date, hour: number, minute: number): Date {
  const result = new Date(date)
  result.setHours(hour, minute, 0, 0)
  return result
}

function allIdsPresent(present: IdGroups, expected: IdGroups): boolean {
  return recordGroupNames.every(
    (group) => present[group].length === expected[group].length,
  )
}

function noIdsPresent(present: IdGroups): boolean {
  return recordGroupNames.every((group) => present[group].length === 0)
}

async function findPresentIds(
  database: GymTrackerDatabase,
  ids: IdGroups,
): Promise<IdGroups> {
  const [
    workoutSessions,
    exercises,
    workoutExercises,
    exerciseSets,
    savedMeals,
    mealLogs,
  ] = await Promise.all([
    database.workoutSessions.bulkGet(ids.workoutSessions),
    database.exercises.bulkGet(ids.exercises),
    database.workoutExercises.bulkGet(ids.workoutExercises),
    database.exerciseSets.bulkGet(ids.exerciseSets),
    database.savedMeals.bulkGet(ids.savedMeals),
    database.mealLogs.bulkGet(ids.mealLogs),
  ])
  return {
    workoutSessions: ids.workoutSessions.filter((_, index) => workoutSessions[index] !== undefined),
    exercises: ids.exercises.filter((_, index) => exercises[index] !== undefined),
    workoutExercises: ids.workoutExercises.filter((_, index) => workoutExercises[index] !== undefined),
    exerciseSets: ids.exerciseSets.filter((_, index) => exerciseSets[index] !== undefined),
    savedMeals: ids.savedMeals.filter((_, index) => savedMeals[index] !== undefined),
    mealLogs: ids.mealLogs.filter((_, index) => mealLogs[index] !== undefined),
  }
}

function countsFromManifest(manifest: DemoManifest): DemoDataCounts {
  return {
    workoutSessions: manifest.ids.workoutSessions.length,
    exercises: manifest.ids.exercises.length,
    workoutExercises: manifest.ids.workoutExercises.length,
    exerciseSets: manifest.ids.exerciseSets.length,
    savedMeals: manifest.ids.savedMeals.length,
    mealLogs: manifest.ids.mealLogs.length,
  }
}

interface MovementPlan {
  name: string
  category: Exercise['category']
  equipment: string
  baseWeightKg: number
  reps: [number, number, number]
  incrementKg: number
}

interface WorkoutPlan {
  dayOffset: number
  name: string
  movements: MovementPlan[]
}

const workoutPlans: WorkoutPlan[] = [
  {
    dayOffset: -6,
    name: 'Demo: Lower-body strength',
    movements: [
      { name: 'Barbell Squat', category: 'legs', equipment: 'Barbell', baseWeightKg: 55, reps: [10, 8, 8], incrementKg: 2.5 },
      { name: 'Romanian Deadlift', category: 'legs', equipment: 'Barbell', baseWeightKg: 45, reps: [10, 9, 8], incrementKg: 2.5 },
      { name: 'Leg Press', category: 'legs', equipment: 'Machine', baseWeightKg: 110, reps: [12, 10, 10], incrementKg: 5 },
    ],
  },
  {
    dayOffset: -4,
    name: 'Demo: Push strength',
    movements: [
      { name: 'Bench Press', category: 'chest', equipment: 'Barbell', baseWeightKg: 45, reps: [10, 8, 8], incrementKg: 2.5 },
      { name: 'Overhead Press', category: 'shoulders', equipment: 'Barbell', baseWeightKg: 25, reps: [10, 8, 8], incrementKg: 2.5 },
      { name: 'Incline Dumbbell Press', category: 'chest', equipment: 'Dumbbells', baseWeightKg: 18, reps: [12, 10, 10], incrementKg: 1 },
    ],
  },
  {
    dayOffset: -3,
    name: 'Demo: Back and shoulders',
    movements: [
      { name: 'Bent-over Row', category: 'back', equipment: 'Barbell', baseWeightKg: 40, reps: [10, 9, 8], incrementKg: 2.5 },
      { name: 'Lat Pulldown', category: 'back', equipment: 'Cable', baseWeightKg: 45, reps: [12, 10, 10], incrementKg: 2.5 },
      { name: 'Face Pull', category: 'shoulders', equipment: 'Cable', baseWeightKg: 17.5, reps: [15, 12, 12], incrementKg: 2.5 },
    ],
  },
  {
    dayOffset: -1,
    name: 'Demo: Posterior chain',
    movements: [
      { name: 'Conventional Deadlift', category: 'legs', equipment: 'Barbell', baseWeightKg: 75, reps: [8, 6, 6], incrementKg: 2.5 },
      { name: 'Goblet Squat', category: 'legs', equipment: 'Dumbbell', baseWeightKg: 20, reps: [12, 10, 10], incrementKg: 2 },
      { name: 'Leg Press', category: 'legs', equipment: 'Machine', baseWeightKg: 120, reps: [12, 10, 10], incrementKg: 5 },
    ],
  },
  {
    dayOffset: 0,
    name: 'Demo: Full-body session',
    movements: [
      { name: 'Dumbbell Bench Press', category: 'chest', equipment: 'Dumbbells', baseWeightKg: 20, reps: [12, 10, 10], incrementKg: 1 },
      { name: 'Seated Cable Row', category: 'back', equipment: 'Cable', baseWeightKg: 42.5, reps: [12, 10, 10], incrementKg: 2.5 },
      { name: 'Goblet Squat', category: 'legs', equipment: 'Dumbbell', baseWeightKg: 22, reps: [12, 10, 10], incrementKg: 2 },
    ],
  },
]

interface MealPlan {
  name: string
  servingDescription: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

const mealPlans: MealPlan[] = [
  { name: 'Demo · Greek yogurt, berries and oats', servingDescription: 'Bowl, about 350 g', calories: 430, proteinG: 32, carbsG: 56, fatG: 9 },
  { name: 'Demo · Eggs and whole-grain toast', servingDescription: 'Two eggs with two slices of toast', calories: 470, proteinG: 27, carbsG: 42, fatG: 21 },
  { name: 'Demo · Chicken and brown rice', servingDescription: 'Chicken breast with a cup of rice', calories: 610, proteinG: 48, carbsG: 70, fatG: 13 },
  { name: 'Demo · Salmon and quinoa bowl', servingDescription: 'Salmon fillet with quinoa and greens', calories: 660, proteinG: 42, carbsG: 62, fatG: 24 },
  { name: 'Demo · Turkey and bean chili', servingDescription: 'One hearty bowl', calories: 560, proteinG: 44, carbsG: 54, fatG: 17 },
  { name: 'Demo · Lean beef and roasted potatoes', servingDescription: 'Beef with potatoes and vegetables', calories: 700, proteinG: 46, carbsG: 62, fatG: 27 },
  { name: 'Demo · Banana protein smoothie', servingDescription: 'One blended shake', calories: 325, proteinG: 30, carbsG: 39, fatG: 6 },
  { name: 'Demo · Almonds and an apple', servingDescription: 'Small handful with one apple', calories: 255, proteinG: 7, carbsG: 29, fatG: 14 },
]

const dailyMealIndexes: Array<{ dayOffset: number; mealIndexes: number[] }> = [
  { dayOffset: -6, mealIndexes: [0, 2, 4, 6] },
  { dayOffset: -5, mealIndexes: [1, 3, 5] },
  { dayOffset: -4, mealIndexes: [0, 2, 5, 7] },
  { dayOffset: -3, mealIndexes: [1, 3, 4] },
  { dayOffset: -2, mealIndexes: [0, 2, 4, 6] },
  { dayOffset: -1, mealIndexes: [1, 3, 5] },
  { dayOffset: 0, mealIndexes: [6] },
]

const mealTypes: MealLog['mealType'][] = ['breakfast', 'lunch', 'dinner', 'snack']
const mealHours: Record<MealLog['mealType'], number> = {
  breakfast: 7,
  lunch: 12,
  dinner: 18,
  snack: 15,
}

function resultFromManifest(
  manifest: DemoManifest,
  alreadyLoaded: boolean,
): DemoSeedResult {
  return {
    ...countsFromManifest(manifest),
    startDate: manifest.startDate,
    endDate: manifest.endDate,
    alreadyLoaded,
  }
}

function newManifest(now: Date): DemoManifest {
  const start = localDay(now, -6)
  return {
    version: 1,
    operationId: createUUID(),
    state: 'prepared',
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(now),
    ids: emptyIds(),
    records: emptyRecords(),
  }
}

function prepareIds(manifest: DemoManifest): void {
  manifest.ids.workoutSessions = workoutPlans.map(() => createUUID())
  manifest.ids.workoutExercises = workoutPlans.flatMap((plan) =>
    plan.movements.map(() => createUUID()),
  )
  manifest.ids.exerciseSets = workoutPlans.flatMap((plan) =>
    plan.movements.flatMap(() => [createUUID(), createUUID(), createUUID()]),
  )
  manifest.ids.exercises = []
  manifest.ids.savedMeals = mealPlans.map(() => createUUID())
  manifest.ids.mealLogs = dailyMealIndexes.flatMap((day) =>
    day.mealIndexes.map(() => createUUID()),
  )
}

function dataCounts(records: RecordGroups): DemoDataCounts {
  return {
    workoutSessions: records.workoutSessions.length,
    exercises: records.exercises.length,
    workoutExercises: records.workoutExercises.length,
    exerciseSets: records.exerciseSets.length,
    savedMeals: records.savedMeals.length,
    mealLogs: records.mealLogs.length,
  }
}

function idGroups(records: RecordGroups): IdGroups {
  return {
    workoutSessions: records.workoutSessions.map(({ id }) => id),
    exercises: records.exercises.map(({ id }) => id),
    workoutExercises: records.workoutExercises.map(({ id }) => id),
    exerciseSets: records.exerciseSets.map(({ id }) => id),
    savedMeals: records.savedMeals.map(({ id }) => id),
    mealLogs: records.mealLogs.map(({ id }) => id),
  }
}

export async function seedDemoData(
  database: GymTrackerDatabase = db,
  asOf = new Date(),
): Promise<DemoSeedResult> {
  if (Number.isNaN(asOf.getTime())) {
    throw new Error('A valid local date is required to create demo history.')
  }
  const localStorage = storage()
  let operationId: string | null = null
  try {
    return await database.transaction(
      'rw',
      [
        database.workoutSessions,
        database.exercises,
        database.workoutExercises,
        database.exerciseSets,
        database.savedMeals,
        database.mealLogs,
      ],
      async () => {
        const currentRaw = localStorage.getItem(DEMO_MANIFEST_KEY)
        if (currentRaw) {
          const current = parseManifest(currentRaw)
          const present = await findPresentIds(database, current.ids)
          if (current.state === 'loaded' && allIdsPresent(present, current.ids)) {
            return resultFromManifest(current, true)
          }
          if (noIdsPresent(present)) {
            localStorage.removeItem(DEMO_MANIFEST_KEY)
          } else {
            throw new Error(
              current.state === 'cleanup_pending'
                ? 'Some demo-created records are still in use or have changed. Remove their user-created references or restore their original values, then remove the remaining demo data before loading again.'
                : 'The saved demo-data manifest does not match the database. No records were changed; remove the remaining demo data before trying again.',
            )
          }
        }

        const manifest = newManifest(asOf)
        prepareIds(manifest)
        operationId = manifest.operationId
        const exercises = await database.exercises
          .filter((exercise) => exercise.deletedAt === null)
          .toArray()
        const exerciseByName = new Map(
          exercises.map((exercise) => [exercise.name.trim().toLocaleLowerCase(), exercise]),
        )
        const exerciseIdsByName = new Map<string, string>()
        const createdExercises: Exercise[] = []
        const requiredMovements = new Map<string, MovementPlan>()
        for (const plan of workoutPlans) {
          for (const movement of plan.movements) {
            requiredMovements.set(movement.name, movement)
          }
        }
        for (const movement of requiredMovements.values()) {
          const key = movement.name.toLocaleLowerCase()
          const existing = exerciseByName.get(key)
          if (existing) {
            exerciseIdsByName.set(movement.name, existing.id)
          } else {
            manifest.ids.exercises.push(createUUID())
          }
        }
        localStorage.setItem(DEMO_MANIFEST_KEY, JSON.stringify(manifest))
        let exerciseIdIndex = 0
        for (const movement of requiredMovements.values()) {
          if (exerciseIdsByName.has(movement.name)) continue
          const id = manifest.ids.exercises[exerciseIdIndex++]
          if (!id) throw new Error('A demo exercise ID could not be prepared.')
          const exercise = await createExercise(
              {
                id,
                name: `Demo · ${movement.name}`,
                category: movement.category,
                equipment: movement.equipment,
              },
              database,
            )
          createdExercises.push(exercise)
          exerciseIdsByName.set(movement.name, exercise.id)
        }
        manifest.ids.exercises = createdExercises.map(({ id }) => id)

        const records = emptyRecords()
        records.exercises.push(...createdExercises)
        let workoutExerciseIdIndex = 0
        let exerciseSetIdIndex = 0
        for (const [workoutIndex, plan] of workoutPlans.entries()) {
          const day = localDay(asOf, plan.dayOffset)
          const completedAt =
            plan.dayOffset === 0
              ? new Date(asOf)
              : atLocalTime(day, 18, 30)
          const midnight = atLocalTime(day, 0, 0)
          const startedAt =
            plan.dayOffset === 0
              ? new Date(Math.max(midnight.getTime(), asOf.getTime() - 70 * 60_000))
              : atLocalTime(day, 17, 20)
          const session = await createWorkoutSession(
            {
              id: manifest.ids.workoutSessions[workoutIndex],
              name: plan.name,
              startedAt: createTimestamp(startedAt),
              completedAt: null,
              status: 'in_progress',
              notes: 'Fictional demonstration workout.',
            },
            database,
          )
          for (const movement of plan.movements) {
            const exerciseId = exerciseIdsByName.get(movement.name)
            if (!exerciseId) {
              throw new Error(`The demo exercise "${movement.name}" was not prepared.`)
            }
            const workoutExercise = await addWorkoutExercise(
              {
                id: manifest.ids.workoutExercises[workoutExerciseIdIndex++],
                workoutId: session.id,
                exerciseId,
                notes: '',
              },
              database,
            )
            records.workoutExercises.push(workoutExercise)
            for (const [setIndex, reps] of movement.reps.entries()) {
              const set = await addExerciseSet(
                {
                  id: manifest.ids.exerciseSets[exerciseSetIdIndex++],
                  workoutExerciseId: workoutExercise.id,
                  setNumber: setIndex + 1,
                  weightKg:
                    movement.baseWeightKg +
                    (workoutIndex % 3) * movement.incrementKg +
                    setIndex * movement.incrementKg,
                  reps,
                  completed: true,
                },
                database,
              )
              records.exerciseSets.push(set)
            }
          }
          records.workoutSessions.push(
            await updateWorkoutSession(
              session.id,
              {
                status: 'completed',
                completedAt: createTimestamp(completedAt),
              },
              database,
            ),
          )
        }

        const savedMeals = new Map<number, SavedMeal>()
        for (const [index, plan] of mealPlans.entries()) {
          const savedMeal = await createSavedMeal(
            {
              id: manifest.ids.savedMeals[index],
              ...plan,
              calorieSource: 'manual',
            },
            database,
          )
          savedMeals.set(index, savedMeal)
          records.savedMeals.push(savedMeal)
        }
        let mealLogIdIndex = 0
        for (const dayPlan of dailyMealIndexes) {
          const day = localDay(asOf, dayPlan.dayOffset)
          for (const [mealIndex, savedMealIndex] of dayPlan.mealIndexes.entries()) {
            const mealType =
              dayPlan.dayOffset === 0 ? 'snack' : mealTypes[mealIndex]
            const savedMeal = savedMeals.get(savedMealIndex)
            if (!savedMeal) {
              throw new Error('A demo saved meal could not be prepared.')
            }
            const consumedAt =
              dayPlan.dayOffset === 0
                ? new Date(
                    Math.max(
                      atLocalTime(day, 0, 0).getTime(),
                      asOf.getTime() - (mealIndex + 1) * 12 * 60_000,
                    ),
                  )
                : atLocalTime(day, mealHours[mealType], mealIndex === 0 ? 30 : 0)
            const log = await createMealLog(
              {
                id: manifest.ids.mealLogs[mealLogIdIndex++],
                savedMealId: savedMeal.id,
                consumedAt: createTimestamp(consumedAt),
                mealType,
                portionPercent: [95, 100, 105, 100][mealIndex],
              },
              database,
            )
            records.mealLogs.push(log)
          }
        }

        manifest.state = 'loaded'
        manifest.ids = idGroups(records)
        manifest.records = records
        localStorage.setItem(DEMO_MANIFEST_KEY, JSON.stringify(manifest))
        return {
          ...dataCounts(records),
          startDate: manifest.startDate,
          endDate: manifest.endDate,
          alreadyLoaded: false,
        }
      },
    )
  } catch (error) {
    if (operationId) {
      try {
        const raw = localStorage.getItem(DEMO_MANIFEST_KEY)
        if (raw && parseManifest(raw).operationId === operationId) {
          localStorage.removeItem(DEMO_MANIFEST_KEY)
        }
      } catch (manifestError) {
        throw new Error(
          `Demo data could not be loaded: ${error instanceof Error ? error.message : 'unknown error'}. The demo manifest also could not be repaired: ${manifestError instanceof Error ? manifestError.message : 'unknown storage error'}.`,
        )
      }
    }
    throw error
  }
}

function manifestRecords<K extends keyof RecordGroups>(
  manifest: DemoManifest,
  group: K,
): RecordGroups[K] {
  return manifest.records[group]
}

function indexById<T extends { id: string }>(records: T[]): Map<string, T> {
  return new Map(records.map((record) => [record.id, record]))
}

function exactRecords<T extends { id: string }>(
  current: Array<T | undefined>,
  expected: T[],
): T[] {
  const expectedById = indexById(expected)
  return current.filter(
    (record): record is T =>
      record !== undefined &&
      expectedById.has(record.id) &&
      sameRecord(record, expectedById.get(record.id)),
  )
}

function setDifferenceCount(before: IdGroups, after: IdGroups): DemoDataCounts {
  return {
    workoutSessions: before.workoutSessions.length - after.workoutSessions.length,
    exercises: before.exercises.length - after.exercises.length,
    workoutExercises: before.workoutExercises.length - after.workoutExercises.length,
    exerciseSets: before.exerciseSets.length - after.exerciseSets.length,
    savedMeals: before.savedMeals.length - after.savedMeals.length,
    mealLogs: before.mealLogs.length - after.mealLogs.length,
  }
}

export async function removeDemoData(
  database: GymTrackerDatabase = db,
): Promise<DemoCleanupResult> {
  const localStorage = storage()
  let originalRaw: string | null = null
  let manifestChanged = false
  try {
    return await database.transaction(
      'rw',
      [
        database.workoutSessions,
        database.exercises,
        database.workoutExercises,
        database.exerciseSets,
        database.savedMeals,
        database.mealLogs,
      ],
      async () => {
        originalRaw = localStorage.getItem(DEMO_MANIFEST_KEY)
        if (!originalRaw) {
          return { removed: dataCounts(emptyRecords()), preserved: 0, manifestRetained: false }
        }
        const manifest = parseManifest(originalRaw)
        if (manifest.state === 'prepared') {
          const present = await findPresentIds(database, manifest.ids)
          if (noIdsPresent(present)) {
            localStorage.removeItem(DEMO_MANIFEST_KEY)
            manifestChanged = true
            return { removed: dataCounts(emptyRecords()), preserved: 0, manifestRetained: false }
          }
          throw new Error('A demo-data operation is incomplete. No records were removed; reload the page and try again.')
        }

        const [sessions, exercises, relations, sets, savedMeals, mealLogs] =
          await Promise.all([
            database.workoutSessions.bulkGet(manifest.ids.workoutSessions),
            database.exercises.bulkGet(manifest.ids.exercises),
            database.workoutExercises.bulkGet(manifest.ids.workoutExercises),
            database.exerciseSets.bulkGet(manifest.ids.exerciseSets),
            database.savedMeals.bulkGet(manifest.ids.savedMeals),
            database.mealLogs.bulkGet(manifest.ids.mealLogs),
          ])
        const expectedSessions = manifestRecords(manifest, 'workoutSessions')
        const expectedRelations = manifestRecords(manifest, 'workoutExercises')
        const expectedSets = manifestRecords(manifest, 'exerciseSets')
        const expectedSavedMeals = manifestRecords(manifest, 'savedMeals')
        const expectedMealLogs = manifestRecords(manifest, 'mealLogs')
        const sessionById = indexById(expectedSessions)
        const relationById = indexById(expectedRelations)
        const protectedWorkoutIds = new Set<string>()

        for (const session of sessions) {
          if (
            session !== undefined &&
            !sameRecord(session, sessionById.get(session.id))
          ) {
            protectedWorkoutIds.add(session.id)
          }
        }
        for (const relation of relations) {
          if (!relation) continue
          const expected = relationById.get(relation.id)
          if (!expected || !sameRecord(relation, expected)) {
            if (manifest.ids.workoutSessions.includes(relation.workoutId)) {
              protectedWorkoutIds.add(relation.workoutId)
            }
          }
        }
        const relationsById = new Map(
          expectedRelations.map((relation) => [relation.id, relation]),
        )
        const allSetsForDemoRelations = manifest.ids.workoutExercises.length
          ? await database.exerciseSets
              .where('workoutExerciseId')
              .anyOf(manifest.ids.workoutExercises)
              .toArray()
          : []
        for (const set of allSetsForDemoRelations) {
          if (!manifest.ids.exerciseSets.includes(set.id)) {
            const parent = relationsById.get(set.workoutExerciseId)
            if (parent) protectedWorkoutIds.add(parent.workoutId)
          }
        }
        const expectedSetById = indexById(expectedSets)
        for (const set of sets) {
          if (set !== undefined && !sameRecord(set, expectedSetById.get(set.id))) {
            const parent = relationsById.get(set.workoutExerciseId)
            if (parent) protectedWorkoutIds.add(parent.workoutId)
          }
        }

        const trackedRelationIds = new Set(manifest.ids.workoutExercises)
        const actualRelationsForSessions = manifest.ids.workoutSessions.length
          ? await database.workoutExercises
              .where('workoutId')
              .anyOf(manifest.ids.workoutSessions)
              .toArray()
          : []
        for (const relation of actualRelationsForSessions) {
          if (!trackedRelationIds.has(relation.id)) {
            protectedWorkoutIds.add(relation.workoutId)
          }
        }

        const presentBefore = await findPresentIds(database, manifest.ids)
        const removableSets = exactRecords(sets, expectedSets).filter((set) => {
          const parent = relationsById.get(set.workoutExerciseId)
          return !parent || !protectedWorkoutIds.has(parent.workoutId)
        })
        const removableRelations = exactRecords(relations, expectedRelations).filter(
          (relation) => !protectedWorkoutIds.has(relation.workoutId),
        )
        const removableSessions = exactRecords(sessions, expectedSessions).filter(
          (session) => !protectedWorkoutIds.has(session.id),
        )
        const removableMealLogs = exactRecords(mealLogs, expectedMealLogs)
        if (removableSets.length) {
          await database.exerciseSets.bulkDelete(removableSets.map(({ id }) => id))
        }
        if (removableRelations.length) {
          await database.workoutExercises.bulkDelete(
            removableRelations.map(({ id }) => id),
          )
        }
        if (removableSessions.length) {
          await database.workoutSessions.bulkDelete(
            removableSessions.map(({ id }) => id),
          )
        }
        if (removableMealLogs.length) {
          await database.mealLogs.bulkDelete(removableMealLogs.map(({ id }) => id))
        }

        const unchangedMeals = exactRecords(savedMeals, expectedSavedMeals)
        const mealReferences = unchangedMeals.length
          ? await database.mealLogs
              .where('savedMealId')
              .anyOf(unchangedMeals.map(({ id }) => id))
              .toArray()
          : []
        const referencedMealIds = new Set(
          mealReferences.map((log) => log.savedMealId),
        )
        const removableMeals = unchangedMeals.filter(
          (meal) => !referencedMealIds.has(meal.id),
        )
        if (removableMeals.length) {
          await database.savedMeals.bulkDelete(removableMeals.map(({ id }) => id))
        }

        const unchangedExercises = exactRecords(
          exercises,
          manifestRecords(manifest, 'exercises'),
        )
        const exerciseReferences = unchangedExercises.length
          ? await database.workoutExercises
              .where('exerciseId')
              .anyOf(unchangedExercises.map(({ id }) => id))
              .toArray()
          : []
        const referencedExerciseIds = new Set(
          exerciseReferences.map((relation) => relation.exerciseId),
        )
        const removableExercises = unchangedExercises.filter(
          (exercise) => !referencedExerciseIds.has(exercise.id),
        )
        if (removableExercises.length) {
          await database.exercises.bulkDelete(
            removableExercises.map(({ id }) => id),
          )
        }

        const presentAfter = await findPresentIds(database, manifest.ids)
        const remaining = new Set(
          recordGroupNames.flatMap((group) => presentAfter[group]),
        )
        const records = emptyRecords()
        for (const group of recordGroupNames) {
          const recordIndex = indexById(manifest.records[group] as Array<{ id: string }>)
          ;(records[group] as Array<{ id: string }>).push(
            ...manifest.ids[group]
              .filter((id) => remaining.has(id))
              .map((id) => recordIndex.get(id))
              .filter((record): record is { id: string } => record !== undefined),
          )
        }
        const remainingIds = idGroups(records)
        const preserved = recordGroupNames.reduce(
          (total, group) => total + remainingIds[group].length,
          0,
        )
        const removed = setDifferenceCount(presentBefore, presentAfter)
        if (preserved === 0) {
          localStorage.removeItem(DEMO_MANIFEST_KEY)
        } else {
          manifest.state = 'cleanup_pending'
          manifest.ids = remainingIds
          manifest.records = records
          localStorage.setItem(DEMO_MANIFEST_KEY, JSON.stringify(manifest))
        }
        manifestChanged = true
        return { removed, preserved, manifestRetained: preserved > 0 }
      },
    )
  } catch (error) {
    if (manifestChanged && originalRaw !== null) {
      try {
        localStorage.setItem(DEMO_MANIFEST_KEY, originalRaw)
      } catch (manifestError) {
        throw new Error(
          `Demo cleanup failed: ${error instanceof Error ? error.message : 'unknown error'}. The original demo manifest could not be restored: ${manifestError instanceof Error ? manifestError.message : 'unknown storage error'}.`,
        )
      }
    }
    throw error
  }
}
