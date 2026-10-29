import type { UUID } from '../../types/records'
import type { GymTrackerDatabase } from '../database'
import { db } from '../database'
import type { WorkoutSession, WorkoutStatus } from '../../features/workouts/types'
import { createTimestamp, createUUID } from '../../lib/dateTime'
import {
  assertIsoDateTime,
  assertNonBlank,
} from '../../lib/validation'

export type CreateWorkoutSessionInput = Pick<
  WorkoutSession,
  'name' | 'startedAt' | 'completedAt' | 'status' | 'notes'
> & { id?: UUID }

export type WorkoutSessionChanges = Partial<CreateWorkoutSessionInput>

export interface ListWorkoutSessionsPageOptions {
  cursorStartedAt?: string
  limit?: number
}

function validateSession(session: CreateWorkoutSessionInput): void {
  assertNonBlank(session.name, 'Workout name')
  assertIsoDateTime(session.startedAt, 'startedAt')
  if (session.completedAt !== null) {
    assertIsoDateTime(session.completedAt, 'completedAt')
  }
  if (!['in_progress', 'completed'].includes(session.status)) {
    throw new Error('Workout status must be in_progress or completed.')
  }
  if (
    (session.status === 'in_progress' && session.completedAt !== null) ||
    (session.status === 'completed' && session.completedAt === null)
  ) {
    throw new Error(
      'In-progress workouts must have no completion time; completed workouts must have one.',
    )
  }
  if (
    session.completedAt !== null &&
    Date.parse(session.completedAt) < Date.parse(session.startedAt)
  ) {
    throw new Error('Workout completion time cannot be before its start time.')
  }
  if (typeof session.notes !== 'string') {
    throw new Error('Workout notes must be a string.')
  }
}

export async function createWorkoutSession(
  input: CreateWorkoutSessionInput,
  database: GymTrackerDatabase = db,
): Promise<WorkoutSession> {
  validateSession(input)
  const now = createTimestamp()
  const session: WorkoutSession = {
    ...input,
    id: input.id ?? createUUID(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  await database.workoutSessions.add(session)
  return session
}

export async function getWorkoutSession(
  id: string,
  database: GymTrackerDatabase = db,
): Promise<WorkoutSession | undefined> {
  return database.workoutSessions.get(id)
}

export async function getActiveWorkoutSession(
  database: GymTrackerDatabase = db,
): Promise<WorkoutSession | undefined> {
  return database.workoutSessions
    .where('status')
    .equals('in_progress')
    .filter((session) => session.deletedAt === null)
    .first()
}

export async function listWorkoutSessions(
  database: GymTrackerDatabase = db,
): Promise<WorkoutSession[]> {
  return database.workoutSessions
    .orderBy('startedAt')
    .reverse()
    .filter((session) => session.deletedAt === null)
    .toArray()
}

export async function listWorkoutSessionsPage(
  options: ListWorkoutSessionsPageOptions = {},
  database: GymTrackerDatabase = db,
): Promise<WorkoutSession[]> {
  const limit = options.limit ?? 20
  const collection = options.cursorStartedAt
    ? database.workoutSessions
        .where('startedAt')
        .below(options.cursorStartedAt)
        .reverse()
    : database.workoutSessions.orderBy('startedAt').reverse()

  return collection
    .filter((session) => session.deletedAt === null)
    .limit(limit)
    .toArray()
}

export async function updateWorkoutSession(
  id: string,
  changes: WorkoutSessionChanges,
  database: GymTrackerDatabase = db,
): Promise<WorkoutSession> {
  return database.transaction('rw', database.workoutSessions, async () => {
    const existing = await database.workoutSessions.get(id)
    if (!existing || existing.deletedAt !== null) {
      throw new Error(`Active workout session "${id}" was not found.`)
    }
    if (existing.status === 'completed') {
      throw new Error('Completed workouts cannot be modified.')
    }
    const updated = { ...existing, ...changes, updatedAt: createTimestamp() }
    validateSession(updated)
    await database.workoutSessions.put(updated)
    return updated
  })
}

export async function softDeleteWorkoutSession(
  id: string,
  database: GymTrackerDatabase = db,
): Promise<WorkoutSession> {
  return database.transaction('rw', database.workoutSessions, async () => {
    const existing = await database.workoutSessions.get(id)
    if (!existing || existing.deletedAt !== null) {
      throw new Error(`Active workout session "${id}" was not found.`)
    }
    const now = createTimestamp()
    const deleted = { ...existing, updatedAt: now, deletedAt: now }
    await database.workoutSessions.put(deleted)
    return deleted
  })
}

export function isWorkoutStatus(value: string): value is WorkoutStatus {
  return value === 'in_progress' || value === 'completed'
}
