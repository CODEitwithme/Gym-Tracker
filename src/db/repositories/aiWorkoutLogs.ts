import type { AiWorkoutLog } from '../../features/ai-logger/types'
import { createTimestamp, createUUID } from '../../lib/dateTime'
import { assertNonBlank } from '../../lib/validation'
import type { SyncMetadata, UUID } from '../../types/records'
import { db } from '../database'
import type { GymTrackerDatabase } from '../database'

export type CreateAiWorkoutLogInput = Omit<AiWorkoutLog, keyof SyncMetadata> & {
  id?: UUID
}

function validateAiWorkoutLog(input: CreateAiWorkoutLogInput): void {
  assertNonBlank(input.workoutSessionId, 'Workout session ID')
  assertNonBlank(input.originalMessage, 'Original message')
  assertNonBlank(input.parsedExercise, 'Parsed exercise')
  if (input.provider !== 'gemini') {
    throw new Error('Provider must be gemini.')
  }
  if (input.confidence !== 'high' && input.confidence !== 'low') {
    throw new Error('Confidence must be high or low.')
  }
}

export async function createAiWorkoutLog(
  input: CreateAiWorkoutLogInput,
  database: GymTrackerDatabase = db,
): Promise<AiWorkoutLog> {
  validateAiWorkoutLog(input)
  return await database.transaction('rw', database.aiWorkoutLogs, async () => {
    const now = createTimestamp()
    const log: AiWorkoutLog = {
      id: input.id ?? createUUID(),
      workoutSessionId: input.workoutSessionId,
      originalMessage: input.originalMessage,
      provider: input.provider,
      parsedExercise: input.parsedExercise,
      confidence: input.confidence,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }
    await database.aiWorkoutLogs.add(log)
    return log
  })
}

export async function getAiWorkoutLog(
  workoutSessionId: string,
  database: GymTrackerDatabase = db,
): Promise<AiWorkoutLog | undefined> {
  return await database.aiWorkoutLogs
    .where('workoutSessionId')
    .equals(workoutSessionId)
    .filter((log) => log.deletedAt === null)
    .first()
}

export async function listAiWorkoutLogs(
  database: GymTrackerDatabase = db,
): Promise<AiWorkoutLog[]> {
  const logs = await database.aiWorkoutLogs
    .filter((log) => log.deletedAt === null)
    .toArray()
  return logs.sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  )
}

export async function softDeleteAiWorkoutLog(
  id: string,
  database: GymTrackerDatabase = db,
): Promise<AiWorkoutLog> {
  return await database.transaction('rw', database.aiWorkoutLogs, async () => {
    const existing = await database.aiWorkoutLogs.get(id)
    if (!existing || existing.deletedAt !== null) {
      throw new Error(`Active AI workout log "${id}" was not found.`)
    }
    const now = createTimestamp()
    const deleted: AiWorkoutLog = {
      ...existing,
      updatedAt: now,
      deletedAt: now,
    }
    await database.aiWorkoutLogs.put(deleted)
    return deleted
  })
}
