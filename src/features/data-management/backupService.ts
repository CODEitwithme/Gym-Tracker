import packageMetadata from '../../../package.json'
import type { GymTrackerDatabase } from '../../db/database'
import { db, DATABASE_VERSION } from '../../db/database'
import { createTimestamp } from '../../lib/dateTime'
import {
  BACKUP_FORMAT,
  BACKUP_TABLES,
  BACKUP_VERSION,
  MAX_BACKUP_BYTES,
  countBackupRecords,
  validateBackup,
  type BackupData,
  type GymTrackerBackup,
} from './backupFormat'

export const CURRENT_APP_VERSION = packageMetadata.version
export type ImportStrategy = 'merge' | 'replace'

export type BackupTableCounts = Record<
  (typeof BACKUP_TABLES)[number],
  { total: number; active: number; softDeleted: number }
>

export interface ImportResult {
  strategy: ImportStrategy
  inserted: Record<(typeof BACKUP_TABLES)[number], number>
  alreadyPresent: Record<(typeof BACKUP_TABLES)[number], number>
}

export interface BackupConflict {
  table: (typeof BACKUP_TABLES)[number]
  id: string
}

export class BackupConflictError extends Error {
  readonly conflicts: BackupConflict[]

  constructor(conflicts: BackupConflict[]) {
    super(
      `Import stopped without changing data: ${conflicts.length} record ID conflict${conflicts.length === 1 ? '' : 's'} found.`,
    )
    this.name = 'BackupConflictError'
    this.conflicts = conflicts
  }
}

export async function readBackupData(
  database: GymTrackerDatabase = db,
): Promise<BackupData> {
  return database.transaction(
    'r',
    [
      database.workoutSessions,
      database.exercises,
      database.workoutExercises,
      database.exerciseSets,
      database.savedMeals,
      database.mealLogs,
      database.aiWorkoutLogs,
      database.weightLogs,
      database.stepLogs,
      database.monthlyCalorieTargets,
    ],
    async () => {
      const [
        workoutSessions,
        exercises,
        workoutExercises,
        exerciseSets,
        savedMeals,
        mealLogs,
        aiWorkoutLogs,
        weightLogs,
        stepLogs,
        monthlyCalorieTargets,
      ] = await Promise.all([
        database.workoutSessions.toArray(),
        database.exercises.toArray(),
        database.workoutExercises.toArray(),
        database.exerciseSets.toArray(),
        database.savedMeals.toArray(),
        database.mealLogs.toArray(),
        database.aiWorkoutLogs.toArray(),
        database.weightLogs.toArray(),
        database.stepLogs.toArray(),
        database.monthlyCalorieTargets.toArray(),
      ])
      return {
        workoutSessions,
        exercises,
        workoutExercises,
        exerciseSets,
        savedMeals,
        mealLogs,
        aiWorkoutLogs,
        weightLogs,
        stepLogs,
        monthlyCalorieTargets,
      }
    },
  )
}

export async function createBackup(
  database: GymTrackerDatabase = db,
): Promise<GymTrackerBackup> {
  const data = await readBackupData(database)
  return {
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    schemaVersion: DATABASE_VERSION,
    appVersion: CURRENT_APP_VERSION,
    exportedAt: createTimestamp(),
    data,
  }
}

export function getBackupTableCounts(data: BackupData): BackupTableCounts {
  return Object.fromEntries(
    BACKUP_TABLES.map((table) => {
      const records = data[table] ?? []
      const softDeleted = records.filter((record) => record.deletedAt !== null).length
      return [
        table,
        {
          total: records.length,
          active: records.length - softDeleted,
          softDeleted,
        },
      ]
    }),
  ) as BackupTableCounts
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  }
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function findTableMerge<T extends { id: string }>(
  table: (typeof BACKUP_TABLES)[number],
  incoming: T[],
  existing: T[],
): {
  insert: T[]
  alreadyPresent: number
  conflicts: BackupConflict[]
} {
  const existingById = new Map(existing.map((record) => [record.id, record]))
  const insert: T[] = []
  const conflicts: BackupConflict[] = []
  let alreadyPresent = 0
  for (const record of incoming) {
    const current = existingById.get(record.id)
    if (!current) {
      insert.push(record)
    } else if (canonicalJson(current) === canonicalJson(record)) {
      alreadyPresent += 1
    } else {
      conflicts.push({ table, id: record.id })
    }
  }
  return { insert, alreadyPresent, conflicts }
}

function emptyCounts(): Record<(typeof BACKUP_TABLES)[number], number> {
  return {
    workoutSessions: 0,
    exercises: 0,
    workoutExercises: 0,
    exerciseSets: 0,
    savedMeals: 0,
    mealLogs: 0,
    aiWorkoutLogs: 0,
    weightLogs: 0,
    stepLogs: 0,
    monthlyCalorieTargets: 0,
  }
}

function assertObjectInputWithinLimit(value: unknown): void {
  let serialized: string | undefined
  try {
    serialized = JSON.stringify(value)
  } catch {
    throw new Error('Backup data cannot be serialized as JSON.')
  }
  if (
    serialized === undefined ||
    new TextEncoder().encode(serialized).byteLength > MAX_BACKUP_BYTES
  ) {
    throw new Error(
      `Backup exceeds the ${Math.floor(MAX_BACKUP_BYTES / (1024 * 1024))} MB size limit.`,
    )
  }
}

export async function importBackup(
  input: unknown,
  strategy: ImportStrategy,
  database: GymTrackerDatabase = db,
): Promise<ImportResult> {
  if (strategy !== 'merge' && strategy !== 'replace') {
    throw new Error('Choose a supported restore strategy.')
  }
  assertObjectInputWithinLimit(input)
  const backup = validateBackup(input)
  const inserted = emptyCounts()
  const alreadyPresent = emptyCounts()

  await database.transaction(
    'rw',
    [
      database.workoutSessions,
      database.exercises,
      database.workoutExercises,
      database.exerciseSets,
      database.savedMeals,
      database.mealLogs,
      database.aiWorkoutLogs,
      database.weightLogs,
      database.stepLogs,
      database.monthlyCalorieTargets,
    ],
    async () => {
      if (strategy === 'replace') {
        await database.aiWorkoutLogs.clear()
        await database.mealLogs.clear()
        await database.savedMeals.clear()
        await database.exerciseSets.clear()
        await database.workoutExercises.clear()
        await database.workoutSessions.clear()
        await database.exercises.clear()
        await database.weightLogs.clear()
        await database.stepLogs.clear()
        await database.monthlyCalorieTargets.clear()

        await addIfAny(database.workoutSessions, backup.data.workoutSessions)
        await addIfAny(database.exercises, backup.data.exercises)
        await addIfAny(database.workoutExercises, backup.data.workoutExercises)
        await addIfAny(database.exerciseSets, backup.data.exerciseSets)
        await addIfAny(database.savedMeals, backup.data.savedMeals)
        await addIfAny(database.mealLogs, backup.data.mealLogs)
        await addIfAny(database.aiWorkoutLogs, backup.data.aiWorkoutLogs ?? [])
        await addIfAny(database.weightLogs, backup.data.weightLogs ?? [])
        await addIfAny(database.stepLogs, backup.data.stepLogs ?? [])
        await addIfAny(database.monthlyCalorieTargets, backup.data.monthlyCalorieTargets ?? [])
        for (const table of BACKUP_TABLES) {
          inserted[table] = (backup.data[table] ?? []).length
        }
        return
      }

      const [
        sessionsExisting,
        exercisesExisting,
        workoutExercisesExisting,
        setsExisting,
        mealsExisting,
        logsExisting,
        aiLogsExisting,
        weightLogsExisting,
        stepLogsExisting,
        monthlyTargetsExisting,
      ] = await Promise.all([
        database.workoutSessions.toArray(),
        database.exercises.toArray(),
        database.workoutExercises.toArray(),
        database.exerciseSets.toArray(),
        database.savedMeals.toArray(),
        database.mealLogs.toArray(),
        database.aiWorkoutLogs.toArray(),
        database.weightLogs.toArray(),
        database.stepLogs.toArray(),
        database.monthlyCalorieTargets.toArray(),
      ])
      const sessions = findTableMerge(
        'workoutSessions',
        backup.data.workoutSessions,
        sessionsExisting,
      )
      const exercises = findTableMerge(
        'exercises',
        backup.data.exercises,
        exercisesExisting,
      )
      const workoutExercises = findTableMerge(
        'workoutExercises',
        backup.data.workoutExercises,
        workoutExercisesExisting,
      )
      const sets = findTableMerge(
        'exerciseSets',
        backup.data.exerciseSets,
        setsExisting,
      )
      const meals = findTableMerge(
        'savedMeals',
        backup.data.savedMeals,
        mealsExisting,
      )
      const logs = findTableMerge(
        'mealLogs',
        backup.data.mealLogs,
        logsExisting,
      )
      const aiLogs = findTableMerge(
        'aiWorkoutLogs',
        backup.data.aiWorkoutLogs ?? [],
        aiLogsExisting,
      )
      const weightLogs = findTableMerge(
        'weightLogs',
        backup.data.weightLogs ?? [],
        weightLogsExisting,
      )
      const stepLogs = findTableMerge(
        'stepLogs',
        backup.data.stepLogs ?? [],
        stepLogsExisting,
      )
      const monthlyTargets = findTableMerge(
        'monthlyCalorieTargets',
        backup.data.monthlyCalorieTargets ?? [],
        monthlyTargetsExisting,
      )
      const conflicts = [
        ...sessions.conflicts,
        ...exercises.conflicts,
        ...workoutExercises.conflicts,
        ...sets.conflicts,
        ...meals.conflicts,
        ...logs.conflicts,
        ...aiLogs.conflicts,
        ...weightLogs.conflicts,
        ...stepLogs.conflicts,
        ...monthlyTargets.conflicts,
      ]
      if (conflicts.length) throw new BackupConflictError(conflicts)

      await addIfAny(database.workoutSessions, sessions.insert)
      await addIfAny(database.exercises, exercises.insert)
      await addIfAny(database.workoutExercises, workoutExercises.insert)
      await addIfAny(database.exerciseSets, sets.insert)
      await addIfAny(database.savedMeals, meals.insert)
      await addIfAny(database.mealLogs, logs.insert)
      await addIfAny(database.aiWorkoutLogs, aiLogs.insert)
      await addIfAny(database.weightLogs, weightLogs.insert)
      await addIfAny(database.stepLogs, stepLogs.insert)
      await addIfAny(database.monthlyCalorieTargets, monthlyTargets.insert)
      inserted.workoutSessions = sessions.insert.length
      inserted.exercises = exercises.insert.length
      inserted.workoutExercises = workoutExercises.insert.length
      inserted.exerciseSets = sets.insert.length
      inserted.savedMeals = meals.insert.length
      inserted.mealLogs = logs.insert.length
      inserted.aiWorkoutLogs = aiLogs.insert.length
      inserted.weightLogs = weightLogs.insert.length
      inserted.stepLogs = stepLogs.insert.length
      inserted.monthlyCalorieTargets = monthlyTargets.insert.length
      alreadyPresent.workoutSessions = sessions.alreadyPresent
      alreadyPresent.exercises = exercises.alreadyPresent
      alreadyPresent.workoutExercises = workoutExercises.alreadyPresent
      alreadyPresent.exerciseSets = sets.alreadyPresent
      alreadyPresent.savedMeals = meals.alreadyPresent
      alreadyPresent.mealLogs = logs.alreadyPresent
      alreadyPresent.aiWorkoutLogs = aiLogs.alreadyPresent
      alreadyPresent.weightLogs = weightLogs.alreadyPresent
      alreadyPresent.stepLogs = stepLogs.alreadyPresent
      alreadyPresent.monthlyCalorieTargets = monthlyTargets.alreadyPresent
    },
  )

  return { strategy, inserted, alreadyPresent }
}

async function addIfAny<T, Key>(
  table: {
    bulkAdd(records: T[]): Promise<Key>
  },
  records: T[],
): Promise<void> {
  if (records.length) await table.bulkAdd(records)
}

export function summarizeBackup(backup: GymTrackerBackup): {
  exportedAt: string
  backupVersion: number
  schemaVersion: number
  appVersion: string
  totalRecords: number
  tableCounts: BackupTableCounts
} {
  return {
    exportedAt: backup.exportedAt,
    backupVersion: backup.backupVersion,
    schemaVersion: backup.schemaVersion,
    appVersion: backup.appVersion,
    totalRecords: countBackupRecords(backup.data),
    tableCounts: getBackupTableCounts(backup.data),
  }
}
