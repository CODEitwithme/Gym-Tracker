import type { GymTrackerDatabase } from '../database'
import { db } from '../database'
import { createTimestamp, createUUID } from '../../lib/dateTime'
import { assertLocalDate, assertNonBlank } from '../../lib/validation'
import type { StepLog, SyncMetadata, UUID, WeightLog } from '../../types/records'

export type CreateWeightLogInput = Omit<WeightLog, keyof SyncMetadata> & {
  id?: UUID
}

export type CreateStepLogInput = Omit<StepLog, keyof SyncMetadata> & {
  id?: UUID
}

export type WeightLogChanges = Partial<Pick<WeightLog, 'weightKg' | 'unit' | 'notes' | 'localDate'>>

export type StepLogChanges = Partial<Pick<StepLog, 'stepCount' | 'targetSteps'>>

function validateWeightInput(input: CreateWeightLogInput): void {
  assertLocalDate(input.localDate)
  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0 || input.weightKg > 500) {
    throw new Error('Weight must be a positive number up to 500.')
  }
  if (input.unit !== 'kg' && input.unit !== 'lb') {
    throw new Error('Weight unit must be kg or lb.')
  }
}

function validateStepInput(input: CreateStepLogInput): void {
  assertLocalDate(input.localDate)
  if (!Number.isInteger(input.stepCount) || input.stepCount < 0 || input.stepCount > 200_000) {
    throw new Error('Step count must be an integer between 0 and 200,000.')
  }
  if (!Number.isInteger(input.targetSteps) || input.targetSteps <= 0 || input.targetSteps > 200_000) {
    throw new Error('Target steps must be a positive integer.')
  }
}

// -------------------------------------------------------------
// Weight Logs Repositories
// -------------------------------------------------------------

export async function logWeight(
  input: CreateWeightLogInput,
  database: GymTrackerDatabase = db,
): Promise<WeightLog> {
  validateWeightInput(input)
  return await database.transaction('rw', database.weightLogs, async () => {
    const existing = await database.weightLogs
      .where('localDate')
      .equals(input.localDate)
      .filter((item) => item.deletedAt === null)
      .first()

    const now = createTimestamp()
    if (existing) {
      const updated: WeightLog = {
        ...existing,
        weightKg: Number(input.weightKg.toFixed(2)),
        unit: input.unit,
        notes: input.notes,
        updatedAt: now,
      }
      await database.weightLogs.put(updated)
      return updated
    }

    const newLog: WeightLog = {
      id: input.id ?? createUUID(),
      localDate: input.localDate,
      weightKg: Number(input.weightKg.toFixed(2)),
      unit: input.unit,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }
    await database.weightLogs.add(newLog)
    return newLog
  })
}

export async function getWeightLogByDate(
  localDate: string,
  database: GymTrackerDatabase = db,
): Promise<WeightLog | undefined> {
  return await database.weightLogs
    .where('localDate')
    .equals(localDate)
    .filter((item) => item.deletedAt === null)
    .first()
}

export async function getLatestWeightLog(
  database: GymTrackerDatabase = db,
): Promise<WeightLog | undefined> {
  const all = await database.weightLogs
    .filter((item) => item.deletedAt === null)
    .toArray()

  if (all.length === 0) return undefined
  all.sort((a, b) => b.localDate.localeCompare(a.localDate))
  return all[0]
}

export async function listWeightLogs(
  database: GymTrackerDatabase = db,
): Promise<WeightLog[]> {
  const all = await database.weightLogs
    .filter((item) => item.deletedAt === null)
    .toArray()
  return all.sort((a, b) => a.localDate.localeCompare(b.localDate))
}

export async function listWeightLogsInRange(
  startDate: string,
  endDate: string,
  database: GymTrackerDatabase = db,
): Promise<WeightLog[]> {
  const all = await database.weightLogs
    .where('localDate')
    .between(startDate, endDate, true, true)
    .filter((item) => item.deletedAt === null)
    .toArray()
  return all.sort((a, b) => a.localDate.localeCompare(b.localDate))
}

export async function softDeleteWeightLog(
  id: string,
  database: GymTrackerDatabase = db,
): Promise<WeightLog> {
  assertNonBlank(id, 'Weight log ID')
  return await database.transaction('rw', database.weightLogs, async () => {
    const existing = await database.weightLogs.get(id)
    if (!existing || existing.deletedAt !== null) {
      throw new Error(`Weight log "${id}" was not found.`)
    }
    const updated: WeightLog = {
      ...existing,
      updatedAt: createTimestamp(),
      deletedAt: createTimestamp(),
    }
    await database.weightLogs.put(updated)
    return updated
  })
}

// -------------------------------------------------------------
// Step Logs Repositories
// -------------------------------------------------------------

export async function logSteps(
  input: CreateStepLogInput,
  database: GymTrackerDatabase = db,
): Promise<StepLog> {
  validateStepInput(input)
  return await database.transaction('rw', database.stepLogs, async () => {
    const existing = await database.stepLogs
      .where('localDate')
      .equals(input.localDate)
      .filter((item) => item.deletedAt === null)
      .first()

    const now = createTimestamp()
    if (existing) {
      const updated: StepLog = {
        ...existing,
        stepCount: Math.round(input.stepCount),
        targetSteps: Math.round(input.targetSteps),
        updatedAt: now,
      }
      await database.stepLogs.put(updated)
      return updated
    }

    const newLog: StepLog = {
      id: input.id ?? createUUID(),
      localDate: input.localDate,
      stepCount: Math.round(input.stepCount),
      targetSteps: Math.round(input.targetSteps),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }
    await database.stepLogs.add(newLog)
    return newLog
  })
}

export async function incrementSteps(
  localDate: string,
  amount: number,
  targetSteps = 10_000,
  database: GymTrackerDatabase = db,
): Promise<StepLog> {
  assertLocalDate(localDate)
  const existing = await getStepLogByDate(localDate, database)
  const currentCount = existing ? existing.stepCount : 0
  const currentTarget = existing ? existing.targetSteps : targetSteps
  return await logSteps(
    {
      localDate,
      stepCount: Math.max(0, currentCount + amount),
      targetSteps: currentTarget,
    },
    database,
  )
}

export async function getStepLogByDate(
  localDate: string,
  database: GymTrackerDatabase = db,
): Promise<StepLog | undefined> {
  return await database.stepLogs
    .where('localDate')
    .equals(localDate)
    .filter((item) => item.deletedAt === null)
    .first()
}

export async function listStepLogs(
  database: GymTrackerDatabase = db,
): Promise<StepLog[]> {
  const all = await database.stepLogs
    .filter((item) => item.deletedAt === null)
    .toArray()
  return all.sort((a, b) => a.localDate.localeCompare(b.localDate))
}

export async function listStepLogsInRange(
  startDate: string,
  endDate: string,
  database: GymTrackerDatabase = db,
): Promise<StepLog[]> {
  const all = await database.stepLogs
    .where('localDate')
    .between(startDate, endDate, true, true)
    .filter((item) => item.deletedAt === null)
    .toArray()
  return all.sort((a, b) => a.localDate.localeCompare(b.localDate))
}

export async function softDeleteStepLog(
  id: string,
  database: GymTrackerDatabase = db,
): Promise<StepLog> {
  assertNonBlank(id, 'Step log ID')
  return await database.transaction('rw', database.stepLogs, async () => {
    const existing = await database.stepLogs.get(id)
    if (!existing || existing.deletedAt !== null) {
      throw new Error(`Step log "${id}" was not found.`)
    }
    const updated: StepLog = {
      ...existing,
      updatedAt: createTimestamp(),
      deletedAt: createTimestamp(),
    }
    await database.stepLogs.put(updated)
    return updated
  })
}
