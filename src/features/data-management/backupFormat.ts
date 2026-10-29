import type { MealLog, SavedMeal } from '../nutrition/types'
import type {
  Exercise,
  ExerciseSet,
  WorkoutExercise,
  WorkoutSession,
} from '../workouts/types'
import type { UUID } from '../../types/records'
import type { NutritionValues } from '../../types/records'
import { DATABASE_VERSION } from '../../db/database'

export const BACKUP_FORMAT = 'gym-tracker-backup'
export const BACKUP_VERSION = 1
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024
export const MAX_BACKUP_RECORDS = 100_000

export const BACKUP_TABLES = [
  'workoutSessions',
  'exercises',
  'workoutExercises',
  'exerciseSets',
  'savedMeals',
  'mealLogs',
] as const

export interface BackupData {
  workoutSessions: WorkoutSession[]
  exercises: Exercise[]
  workoutExercises: WorkoutExercise[]
  exerciseSets: ExerciseSet[]
  savedMeals: SavedMeal[]
  mealLogs: MealLog[]
}

export interface GymTrackerBackup {
  format: typeof BACKUP_FORMAT
  backupVersion: typeof BACKUP_VERSION
  schemaVersion: number
  appVersion: string
  exportedAt: string
  data: BackupData
}

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupValidationError'
  }
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0
}

function isUuid(value: unknown): value is UUID {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
}

function isDateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    )
  if (!match || !Number.isFinite(Date.parse(value))) return false
  const [year, month, day] = match.slice(1, 4).map(Number)
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function isLocalDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function hasOnlyKeys(value: UnknownRecord, keys: readonly string[]): boolean {
  const allowed = new Set(keys)
  return Object.keys(value).every((key) => allowed.has(key))
}

const metadataKeys = ['id', 'createdAt', 'updatedAt', 'deletedAt'] as const

function isMetadata(value: UnknownRecord): boolean {
  return (
    isUuid(value.id) &&
    isDateTime(value.createdAt) &&
    isDateTime(value.updatedAt) &&
    (value.deletedAt === null || isDateTime(value.deletedAt))
  )
}

function isNutritionValues(value: unknown): value is NutritionValues {
  return (
    isRecord(value) &&
    isNonNegativeNumber(value.calories) &&
    isNonNegativeNumber(value.proteinG) &&
    isNonNegativeNumber(value.carbsG) &&
    isNonNegativeNumber(value.fatG)
  )
}

function isWorkoutSession(value: unknown): value is WorkoutSession {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      ...metadataKeys,
      'name',
      'startedAt',
      'completedAt',
      'status',
      'notes',
    ]) ||
    !isMetadata(value) ||
    typeof value.name !== 'string' ||
    value.name.trim().length === 0 ||
    !isDateTime(value.startedAt) ||
    !(value.completedAt === null || isDateTime(value.completedAt)) ||
    !['in_progress', 'completed'].includes(String(value.status)) ||
    typeof value.notes !== 'string'
  ) {
    return false
  }
  return (
    (value.status === 'in_progress' && value.completedAt === null) ||
    (value.status === 'completed' &&
      typeof value.completedAt === 'string' &&
      Date.parse(value.completedAt) >= Date.parse(value.startedAt))
  )
}

function isExercise(value: unknown): value is Exercise {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      ...metadataKeys,
      'name',
      'category',
      'equipment',
    ]) &&
    isMetadata(value) &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'other'].includes(
      String(value.category),
    ) &&
    (value.equipment === null || typeof value.equipment === 'string')
  )
}

function isWorkoutExercise(value: unknown): value is WorkoutExercise {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      ...metadataKeys,
      'workoutId',
      'exerciseId',
      'exerciseNameSnapshot',
      'order',
      'notes',
    ]) &&
    isMetadata(value) &&
    isUuid(value.workoutId) &&
    isUuid(value.exerciseId) &&
    typeof value.exerciseNameSnapshot === 'string' &&
    value.exerciseNameSnapshot.trim().length > 0 &&
    Number.isInteger(value.order) &&
    Number(value.order) >= 0 &&
    typeof value.notes === 'string'
  )
}

function isExerciseSet(value: unknown): value is ExerciseSet {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      ...metadataKeys,
      'workoutExerciseId',
      'setNumber',
      'weightKg',
      'reps',
      'completed',
    ]) &&
    isMetadata(value) &&
    isUuid(value.workoutExerciseId) &&
    Number.isInteger(value.setNumber) &&
    Number(value.setNumber) > 0 &&
    isNonNegativeNumber(value.weightKg) &&
    Number.isInteger(value.reps) &&
    Number(value.reps) > 0 &&
    typeof value.completed === 'boolean'
  )
}

function isSavedMeal(value: unknown): value is SavedMeal {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      ...metadataKeys,
      'name',
      'servingDescription',
      'calories',
      'proteinG',
      'carbsG',
      'fatG',
      'calorieSource',
    ]) ||
    !isMetadata(value) ||
    typeof value.name !== 'string' ||
    value.name.trim().length === 0 ||
    typeof value.servingDescription !== 'string' ||
    value.servingDescription.trim().length === 0 ||
    !isNutritionValues(value) ||
    !['manual', 'macro_estimate'].includes(String(value.calorieSource))
  ) {
    return false
  }
  return (
    value.calorieSource !== 'macro_estimate' ||
    value.calories ===
      4 * value.proteinG + 4 * value.carbsG + 9 * value.fatG
  )
}

function isMealLog(value: unknown): value is MealLog {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      ...metadataKeys,
      'savedMealId',
      'mealNameSnapshot',
      'consumedAt',
      'localDate',
      'mealType',
      'portionPercent',
      'nutritionSnapshot',
    ]) &&
    isMetadata(value) &&
    isUuid(value.savedMealId) &&
    typeof value.mealNameSnapshot === 'string' &&
    value.mealNameSnapshot.trim().length > 0 &&
    isDateTime(value.consumedAt) &&
    isLocalDate(value.localDate) &&
    ['breakfast', 'lunch', 'dinner', 'snack'].includes(String(value.mealType)) &&
    isFiniteNumber(value.portionPercent) &&
    value.portionPercent > 0 &&
    isNutritionValues(value.nutritionSnapshot)
  )
}

function requireTable<T>(
  data: UnknownRecord,
  table: keyof BackupData,
  guard: (value: unknown) => value is T,
): T[] {
  const value = data[table]
  if (!Array.isArray(value)) {
    throw new BackupValidationError(`data.${table} must be an array.`)
  }
  const records: T[] = []
  for (const [index, record] of value.entries()) {
    if (!guard(record)) {
      throw new BackupValidationError(
        `data.${table}[${index}] is invalid or contains unsupported fields.`,
      )
    }
    records.push(record)
  }
  return records
}

function assertUniqueIds(
  tableName: keyof BackupData,
  records: ReadonlyArray<{ id: UUID }>,
): void {
  const seen = new Set<UUID>()
  for (const record of records) {
    if (seen.has(record.id)) {
      throw new BackupValidationError(
        `data.${tableName} contains duplicate ID "${record.id}".`,
      )
    }
    seen.add(record.id)
  }
}

function assertRelationships(data: BackupData): void {
  const sessionIds = new Set(data.workoutSessions.map((item) => item.id))
  const exerciseIds = new Set(data.exercises.map((item) => item.id))
  const relationIds = new Set(data.workoutExercises.map((item) => item.id))
  const savedMealIds = new Set(data.savedMeals.map((item) => item.id))

  for (const item of data.workoutExercises) {
    if (!sessionIds.has(item.workoutId)) {
      throw new BackupValidationError(
        `Workout exercise "${item.id}" references a missing workout session.`,
      )
    }
    if (!exerciseIds.has(item.exerciseId)) {
      throw new BackupValidationError(
        `Workout exercise "${item.id}" references a missing exercise.`,
      )
    }
  }
  for (const set of data.exerciseSets) {
    if (!relationIds.has(set.workoutExerciseId)) {
      throw new BackupValidationError(
        `Exercise set "${set.id}" references a missing workout exercise.`,
      )
    }
  }
  for (const log of data.mealLogs) {
    if (!savedMealIds.has(log.savedMealId)) {
      throw new BackupValidationError(
        `Meal log "${log.id}" references a missing saved meal.`,
      )
    }
  }

  const activeExercisePairs = new Set<string>()
  for (const item of data.workoutExercises) {
    if (item.deletedAt !== null) continue
    const pair = `${item.workoutId}:${item.exerciseId}`
    if (activeExercisePairs.has(pair)) {
      throw new BackupValidationError(
        `Workout "${item.workoutId}" contains duplicate active exercise relationships.`,
      )
    }
    activeExercisePairs.add(pair)
  }
  const activeSetNumbers = new Set<string>()
  for (const set of data.exerciseSets) {
    if (set.deletedAt !== null) continue
    const key = `${set.workoutExerciseId}:${set.setNumber}`
    if (activeSetNumbers.has(key)) {
      throw new BackupValidationError(
        `Workout exercise "${set.workoutExerciseId}" contains duplicate active set numbers.`,
      )
    }
    activeSetNumbers.add(key)
  }
}

export function validateBackup(value: unknown): GymTrackerBackup {
  if (!isRecord(value)) {
    throw new BackupValidationError('Backup must be a JSON object.')
  }
  if (
    !hasOnlyKeys(value, [
      'format',
      'backupVersion',
      'schemaVersion',
      'appVersion',
      'exportedAt',
      'data',
    ])
  ) {
    throw new BackupValidationError('Backup contains unsupported top-level fields.')
  }
  if (value.format !== BACKUP_FORMAT) {
    throw new BackupValidationError('This is not a Gym Tracker backup file.')
  }
  if (value.backupVersion !== BACKUP_VERSION) {
    throw new BackupValidationError(
      `Backup format version ${String(value.backupVersion)} is unsupported; this app supports version ${BACKUP_VERSION}.`,
    )
  }
  if (
    !Number.isInteger(value.schemaVersion) ||
    (value.schemaVersion as number) < 1 ||
    (value.schemaVersion as number) > DATABASE_VERSION
  ) {
    const schemaVersion = String(value.schemaVersion)
    const compatibility =
      Number(value.schemaVersion) > DATABASE_VERSION ? 'newer' : 'older'
    throw new BackupValidationError(
      `Backup database schema version ${schemaVersion} is ${compatibility} than the supported version ${DATABASE_VERSION}; no compatible restore migration is available.`,
    )
  }
  if (
    typeof value.appVersion !== 'string' ||
    value.appVersion.trim().length === 0 ||
    !isDateTime(value.exportedAt)
  ) {
    throw new BackupValidationError(
      'Backup appVersion and exportedAt metadata are required and must be valid.',
    )
  }
  const rawData = value.data
  if (!isRecord(rawData)) {
    throw new BackupValidationError('Backup data must be an object.')
  }
  if (!hasOnlyKeys(rawData, BACKUP_TABLES)) {
    throw new BackupValidationError('Backup contains unsupported data tables.')
  }
  for (const table of BACKUP_TABLES) {
    if (!Array.isArray(rawData[table])) {
      throw new BackupValidationError(`data.${table} must be an array.`)
    }
  }
  const recordCount = BACKUP_TABLES.reduce(
    (total, table) => total + (rawData[table] as unknown[]).length,
    0,
  )
  if (recordCount > MAX_BACKUP_RECORDS) {
    throw new BackupValidationError(
      `Backup exceeds the maximum of ${MAX_BACKUP_RECORDS.toLocaleString()} records.`,
    )
  }

  const data: BackupData = {
    workoutSessions: requireTable(rawData, 'workoutSessions', isWorkoutSession),
    exercises: requireTable(rawData, 'exercises', isExercise),
    workoutExercises: requireTable(rawData, 'workoutExercises', isWorkoutExercise),
    exerciseSets: requireTable(rawData, 'exerciseSets', isExerciseSet),
    savedMeals: requireTable(rawData, 'savedMeals', isSavedMeal),
    mealLogs: requireTable(rawData, 'mealLogs', isMealLog),
  }
  assertUniqueIds('workoutSessions', data.workoutSessions)
  assertUniqueIds('exercises', data.exercises)
  assertUniqueIds('workoutExercises', data.workoutExercises)
  assertUniqueIds('exerciseSets', data.exerciseSets)
  assertUniqueIds('savedMeals', data.savedMeals)
  assertUniqueIds('mealLogs', data.mealLogs)
  assertRelationships(data)

  return {
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    schemaVersion: DATABASE_VERSION,
    appVersion: value.appVersion,
    exportedAt: value.exportedAt,
    data,
  }
}

export function parseBackupText(text: string): GymTrackerBackup {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) {
    throw new BackupValidationError(
      `Backup file exceeds the ${Math.floor(MAX_BACKUP_BYTES / (1024 * 1024))} MB size limit.`,
    )
  }
  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  } catch {
    throw new BackupValidationError('Backup file is not valid JSON.')
  }
  return validateBackup(value)
}

export function serializeBackup(backup: GymTrackerBackup): string {
  return JSON.stringify(backup, null, 2)
}

export function countBackupRecords(data: BackupData): number {
  return BACKUP_TABLES.reduce((total, table) => total + data[table].length, 0)
}
