import type {
  ExerciseSet,
  WorkoutExercise,
} from '../../features/workouts/types'
import { createTimestamp, createUUID } from '../../lib/dateTime'
import {
  assertFiniteNonNegative,
  assertNonNegativeInteger,
  assertPositiveInteger,
} from '../../lib/validation'
import { db } from '../database'
import type { GymTrackerDatabase } from '../database'

export interface AddWorkoutExerciseInput {
  workoutId: string
  exerciseId: string
  notes?: string
}

export type WorkoutExerciseChanges = Partial<
  Pick<WorkoutExercise, 'order' | 'notes'>
>

export type AddExerciseSetInput = Pick<
  ExerciseSet,
  'workoutExerciseId' | 'setNumber' | 'weightKg' | 'reps' | 'completed'
>

export type ExerciseSetChanges = Partial<
  Pick<ExerciseSet, 'setNumber' | 'weightKg' | 'reps' | 'completed'>
>

export async function addWorkoutExercise(
  input: AddWorkoutExerciseInput,
  database: GymTrackerDatabase = db,
): Promise<WorkoutExercise> {
  if (typeof input.workoutId !== 'string' || input.workoutId.length === 0) {
    throw new Error('A workout ID is required.')
  }
  if (typeof input.exerciseId !== 'string' || input.exerciseId.length === 0) {
    throw new Error('An exercise ID is required.')
  }
  const notes = input.notes ?? ''
  if (typeof notes !== 'string') throw new Error('Exercise notes must be a string.')

  return database.transaction(
    'rw',
    [database.workoutSessions, database.exercises, database.workoutExercises],
    async () => {
      const [workout, exercise] = await Promise.all([
        database.workoutSessions.get(input.workoutId),
        database.exercises.get(input.exerciseId),
      ])
      if (!workout || workout.deletedAt !== null) {
        throw new Error(`Active workout session "${input.workoutId}" was not found.`)
      }
      if (workout.status !== 'in_progress') {
        throw new Error('Exercises can only be added to an in-progress workout.')
      }
      if (!exercise || exercise.deletedAt !== null) {
        throw new Error(`Active exercise "${input.exerciseId}" was not found.`)
      }
      const existing = await database.workoutExercises
        .where('workoutId')
        .equals(input.workoutId)
        .toArray()
      if (
        existing.some(
          (item) =>
            item.exerciseId === input.exerciseId && item.deletedAt === null,
        )
      ) {
        throw new Error('This exercise is already part of the workout.')
      }
      const order =
        existing.reduce((maximum, item) => Math.max(maximum, item.order), -1) +
        1
      const now = createTimestamp()
      const workoutExercise: WorkoutExercise = {
        id: createUUID(),
        workoutId: workout.id,
        exerciseId: exercise.id,
        exerciseNameSnapshot: exercise.name,
        order,
        notes,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      await database.workoutExercises.add(workoutExercise)
      return workoutExercise
    },
  )
}

export async function updateWorkoutExercise(
  id: string,
  changes: WorkoutExerciseChanges,
  database: GymTrackerDatabase = db,
): Promise<WorkoutExercise> {
  return database.transaction(
    'rw',
    [database.workoutSessions, database.workoutExercises],
    async () => {
      const existing = await database.workoutExercises.get(id)
      if (!existing || existing.deletedAt !== null) {
        throw new Error(`Active workout exercise "${id}" was not found.`)
      }
      const workout = await database.workoutSessions.get(existing.workoutId)
      if (!workout || workout.deletedAt !== null) {
        throw new Error(`Active workout session "${existing.workoutId}" was not found.`)
      }
      if (workout.status !== 'in_progress') {
        throw new Error('Exercises can only be changed in an in-progress workout.')
      }
      const updated = { ...existing, ...changes, updatedAt: createTimestamp() }
      assertNonNegativeInteger(updated.order, 'Exercise order')
      if (typeof updated.notes !== 'string') {
        throw new Error('Exercise notes must be a string.')
      }
      await database.workoutExercises.put(updated)
      return updated
    },
  )
}

export async function swapWorkoutExerciseOrder(
  firstId: string,
  secondId: string,
  database: GymTrackerDatabase = db,
): Promise<void> {
  await database.transaction(
    'rw',
    [database.workoutSessions, database.workoutExercises],
    async () => {
      const [first, second] = await Promise.all([
        database.workoutExercises.get(firstId),
        database.workoutExercises.get(secondId),
      ])
      if (
        !first ||
        !second ||
        first.deletedAt !== null ||
        second.deletedAt !== null ||
        first.workoutId !== second.workoutId
      ) {
        throw new Error('The selected workout exercises can no longer be reordered.')
      }
      const workout = await database.workoutSessions.get(first.workoutId)
      if (!workout || workout.deletedAt !== null) {
        throw new Error(`Active workout session "${first.workoutId}" was not found.`)
      }
      if (workout.status !== 'in_progress') {
        throw new Error('Exercises can only be reordered in an in-progress workout.')
      }
      await Promise.all([
        database.workoutExercises.put({
          ...first,
          order: second.order,
          updatedAt: createTimestamp(),
        }),
        database.workoutExercises.put({
          ...second,
          order: first.order,
          updatedAt: createTimestamp(),
        }),
      ])
    },
  )
}

export async function listWorkoutExercises(
  workoutId: string,
  database: GymTrackerDatabase = db,
): Promise<WorkoutExercise[]> {
  const items = await database.workoutExercises
    .where('workoutId')
    .equals(workoutId)
    .filter((item) => item.deletedAt === null)
    .toArray()
  return items.sort((left, right) => left.order - right.order)
}

function validateSet(set: Pick<ExerciseSet, 'setNumber' | 'weightKg' | 'reps'>) {
  assertPositiveInteger(set.setNumber, 'Set number')
  assertFiniteNonNegative(set.weightKg, 'Weight in kilograms')
  assertPositiveInteger(set.reps, 'Reps')
}

async function assertActiveWorkoutExercise(
  workoutExerciseId: string,
  database: GymTrackerDatabase,
): Promise<void> {
  const workoutExercise =
    await database.workoutExercises.get(workoutExerciseId)
  if (!workoutExercise || workoutExercise.deletedAt !== null) {
    throw new Error(
      `Active workout exercise "${workoutExerciseId}" was not found.`,
    )
  }
  const workout = await database.workoutSessions.get(workoutExercise.workoutId)
  if (!workout || workout.deletedAt !== null) {
    throw new Error(
      `Active workout session "${workoutExercise.workoutId}" was not found.`,
    )
  }
  if (workout.status !== 'in_progress') {
    throw new Error('Sets can only be changed in an in-progress workout.')
  }
}

export async function addExerciseSet(
  input: AddExerciseSetInput,
  database: GymTrackerDatabase = db,
): Promise<ExerciseSet> {
  validateSet(input)
  if (typeof input.completed !== 'boolean') {
    throw new Error('Set completion must be a boolean.')
  }
  return database.transaction(
    'rw',
    [database.workoutSessions, database.workoutExercises, database.exerciseSets],
    async () => {
      await assertActiveWorkoutExercise(input.workoutExerciseId, database)
      const duplicate = await database.exerciseSets
        .where('[workoutExerciseId+setNumber]')
        .equals([input.workoutExerciseId, input.setNumber])
        .filter((set) => set.deletedAt === null)
        .first()
      if (duplicate) {
        throw new Error(`Set ${input.setNumber} already exists for this exercise.`)
      }
      const now = createTimestamp()
      const set: ExerciseSet = {
        ...input,
        id: createUUID(),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      await database.exerciseSets.add(set)
      return set
    },
  )
}

export async function updateExerciseSet(
  id: string,
  changes: ExerciseSetChanges,
  database: GymTrackerDatabase = db,
): Promise<ExerciseSet> {
  return database.transaction(
    'rw',
    [database.workoutSessions, database.workoutExercises, database.exerciseSets],
    async () => {
      const existing = await database.exerciseSets.get(id)
      if (!existing || existing.deletedAt !== null) {
        throw new Error(`Active exercise set "${id}" was not found.`)
      }
      await assertActiveWorkoutExercise(existing.workoutExerciseId, database)
      const updated = { ...existing, ...changes, updatedAt: createTimestamp() }
      validateSet(updated)
      if (typeof updated.completed !== 'boolean') {
        throw new Error('Set completion must be a boolean.')
      }
      if (updated.setNumber !== existing.setNumber) {
        const duplicate = await database.exerciseSets
          .where('[workoutExerciseId+setNumber]')
          .equals([existing.workoutExerciseId, updated.setNumber])
          .filter(
            (set) => set.deletedAt === null && set.id !== existing.id,
          )
          .first()
        if (duplicate) {
          throw new Error(
            `Set ${updated.setNumber} already exists for this exercise.`,
          )
        }
      }
      await database.exerciseSets.put(updated)
      return updated
    },
  )
}

export async function softDeleteExerciseSet(
  id: string,
  database: GymTrackerDatabase = db,
): Promise<ExerciseSet> {
  return database.transaction(
    'rw',
    [database.workoutSessions, database.workoutExercises, database.exerciseSets],
    async () => {
      const existing = await database.exerciseSets.get(id)
      if (!existing || existing.deletedAt !== null) {
        throw new Error(`Active exercise set "${id}" was not found.`)
      }
      await assertActiveWorkoutExercise(existing.workoutExerciseId, database)
      const now = createTimestamp()
      const deleted = { ...existing, updatedAt: now, deletedAt: now }
      await database.exerciseSets.put(deleted)
      return deleted
    },
  )
}

export async function listExerciseSets(
  workoutExerciseId: string,
  database: GymTrackerDatabase = db,
): Promise<ExerciseSet[]> {
  const sets = await database.exerciseSets
    .where('workoutExerciseId')
    .equals(workoutExerciseId)
    .filter((set) => set.deletedAt === null)
    .toArray()
  return sets.sort((left, right) => left.setNumber - right.setNumber)
}
