import type { Exercise, ExerciseCategory } from '../../features/workouts/types'
import { createTimestamp, createUUID } from '../../lib/dateTime'
import { assertNonBlank } from '../../lib/validation'
import type { UUID } from '../../types/records'
import { db } from '../database'
import type { GymTrackerDatabase } from '../database'

export type CreateExerciseInput = Pick<
  Exercise,
  'name' | 'category' | 'equipment'
> & { id?: UUID }
export type ExerciseChanges = Partial<CreateExerciseInput>

const categories: ExerciseCategory[] = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'cardio',
  'other',
]

function validateExercise(exercise: CreateExerciseInput): void {
  assertNonBlank(exercise.name, 'Exercise name')
  if (!categories.includes(exercise.category)) {
    throw new Error('Exercise category is not supported.')
  }
  if (
    exercise.equipment !== null &&
    typeof exercise.equipment !== 'string'
  ) {
    throw new Error('Equipment must be a string or null.')
  }
}

export async function createExercise(
  input: CreateExerciseInput,
  database: GymTrackerDatabase = db,
): Promise<Exercise> {
  const trimmedName = input.name.trim()
  validateExercise({ ...input, name: trimmedName })
  return database.transaction('rw', database.exercises, async () => {
    const normalizedName = trimmedName.toLocaleLowerCase()
    const existing = await database.exercises
      .filter(
        (item) =>
          item.deletedAt === null &&
          item.name.trim().toLocaleLowerCase() === normalizedName,
      )
      .first()
    if (existing) {
      throw new Error(`An exercise named "${existing.name}" already exists.`)
    }
    const now = createTimestamp()
    const exercise: Exercise = {
      ...input,
      name: trimmedName,
      id: input.id ?? createUUID(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }
    await database.exercises.add(exercise)
    return exercise
  })
}

export async function getExercise(
  id: string,
  database: GymTrackerDatabase = db,
): Promise<Exercise | undefined> {
  return database.exercises.get(id)
}

export async function searchExercises(
  query: string,
  database: GymTrackerDatabase = db,
): Promise<Exercise[]> {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  return database.exercises
    .filter(
      (exercise) =>
        exercise.deletedAt === null &&
        exercise.name.toLocaleLowerCase().includes(normalizedQuery),
    )
    .toArray()
}

export async function listActiveExercises(
  database: GymTrackerDatabase = db,
): Promise<Exercise[]> {
  const exercises = await database.exercises
    .filter((exercise) => exercise.deletedAt === null)
    .toArray()
  return exercises.sort((left, right) =>
    left.name.localeCompare(right.name),
  )
}

export async function updateExercise(
  id: string,
  changes: ExerciseChanges,
  database: GymTrackerDatabase = db,
): Promise<Exercise> {
  return database.transaction('rw', database.exercises, async () => {
    const existing = await database.exercises.get(id)
    if (!existing || existing.deletedAt !== null) {
      throw new Error(`Active exercise "${id}" was not found.`)
    }
    const normalizedChanges: ExerciseChanges = { ...changes }
    if (changes.name !== undefined) {
      normalizedChanges.name = changes.name.trim()
      const normalizedName = normalizedChanges.name.toLocaleLowerCase()
      const duplicate = await database.exercises
        .filter(
          (item) =>
            item.deletedAt === null &&
            item.id !== id &&
            item.name.trim().toLocaleLowerCase() === normalizedName,
        )
        .first()
      if (duplicate) {
        throw new Error(`An exercise named "${duplicate.name}" already exists.`)
      }
    }
    const updated = { ...existing, ...normalizedChanges, updatedAt: createTimestamp() }
    validateExercise(updated)
    await database.exercises.put(updated)
    return updated
  })
}

export async function softDeleteExercise(
  id: string,
  database: GymTrackerDatabase = db,
): Promise<Exercise> {
  return database.transaction('rw', database.exercises, async () => {
    const existing = await database.exercises.get(id)
    if (!existing || existing.deletedAt !== null) {
      throw new Error(`Active exercise "${id}" was not found.`)
    }
    const now = createTimestamp()
    const deleted = { ...existing, updatedAt: now, deletedAt: now }
    await database.exercises.put(deleted)
    return deleted
  })
}
