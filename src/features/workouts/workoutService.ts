import type { GymTrackerDatabase } from '../../db/database'
import { db } from '../../db/database'
import {
  addExerciseSet,
  addWorkoutExercise,
  listExerciseSets,
  listWorkoutExercises,
  softDeleteExerciseSet,
  swapWorkoutExerciseOrder,
  updateExerciseSet,
  updateWorkoutExercise,
} from '../../db/repositories/workoutDetails'
import {
  createExercise,
  listActiveExercises,
  searchExercises,
} from '../../db/repositories/exercises'
import {
  createWorkoutSession,
  getActiveWorkoutSession,
  getWorkoutSession,
  listWorkoutSessions,
  updateWorkoutSession,
} from '../../db/repositories/workoutSessions'
import { createTimestamp } from '../../lib/dateTime'
import type {
  Exercise,
  ExerciseCategory,
  ExerciseSet,
  WorkoutExercise,
  WorkoutSession,
} from './types'

export interface WorkoutExerciseDetails {
  workoutExercise: WorkoutExercise
  sets: ExerciseSet[]
}

export interface WorkoutDetails {
  session: WorkoutSession
  exercises: WorkoutExerciseDetails[]
}

export interface WorkoutSummary {
  session: WorkoutSession
  exerciseCount: number
  setCount: number
  completedSetCount: number
  durationSeconds: number | null
}

export interface PreviousPerformance {
  workout: WorkoutSession
  sets: ExerciseSet[]
}

export async function startWorkout(
  name = 'New workout',
  database: GymTrackerDatabase = db,
): Promise<WorkoutSession> {
  return database.transaction(
    'rw',
    database.workoutSessions,
    async () => {
      const active = await getActiveWorkoutSession(database)
      if (active) {
        throw new Error('An in-progress workout already exists.')
      }
      const startedAt = createTimestamp()
      return createWorkoutSession(
        {
          name,
          startedAt,
          completedAt: null,
          status: 'in_progress',
          notes: '',
        },
        database,
      )
    },
  )
}

export async function loadActiveWorkout(
  database: GymTrackerDatabase = db,
): Promise<WorkoutSession | undefined> {
  return getActiveWorkoutSession(database)
}

export async function loadWorkoutDetails(
  workoutId: string,
  database: GymTrackerDatabase = db,
): Promise<WorkoutDetails | undefined> {
  const session = await getWorkoutSession(workoutId, database)
  if (!session || session.deletedAt !== null) return undefined
  const workoutExercises = await listWorkoutExercises(workoutId, database)
  const exercises = await Promise.all(
    workoutExercises.map(async (workoutExercise) => ({
      workoutExercise,
      sets: await listExerciseSets(workoutExercise.id, database),
    })),
  )
  return { session, exercises }
}

export async function listCompletedWorkoutSummaries(
  database: GymTrackerDatabase = db,
): Promise<WorkoutSummary[]> {
  const sessions = await listWorkoutSessions(database)
  const completedSessions = sessions.filter(
    (session) => session.status === 'completed' && session.completedAt !== null,
  )
  const summaries = await Promise.all(
    completedSessions.map(async (session) => {
      const exercises = await listWorkoutExercises(session.id, database)
      const setsByExercise = await Promise.all(
        exercises.map((exercise) => listExerciseSets(exercise.id, database)),
      )
      const sets = setsByExercise.flat()
      const completedAt = session.completedAt
      return {
        session,
        exerciseCount: exercises.length,
        setCount: sets.length,
        completedSetCount: sets.filter((set) => set.completed).length,
        durationSeconds:
          completedAt === null
            ? null
            : Math.max(
                0,
                Math.floor(
                  (Date.parse(completedAt) - Date.parse(session.startedAt)) /
                    1000,
                ),
              ),
      }
    }),
  )
  return summaries.sort(
    (left, right) =>
      Date.parse(right.session.completedAt ?? right.session.startedAt) -
      Date.parse(left.session.completedAt ?? left.session.startedAt),
  )
}

export async function finishWorkout(
  workoutId: string,
  database: GymTrackerDatabase = db,
): Promise<WorkoutSession> {
  return database.transaction(
    'rw',
    database.workoutSessions,
    async () => {
      const session = await getWorkoutSession(workoutId, database)
      if (!session || session.deletedAt !== null) {
        throw new Error(`Workout "${workoutId}" was not found.`)
      }
      if (session.status !== 'in_progress' || session.completedAt !== null) {
        throw new Error('This workout has already been completed.')
      }
      const completedAt = createTimestamp()
      return updateWorkoutSession(
        workoutId,
        { status: 'completed', completedAt },
        database,
      )
    },
  )
}

export async function saveWorkoutName(
  workoutId: string,
  name: string,
  database: GymTrackerDatabase = db,
): Promise<WorkoutSession> {
  return updateWorkoutSession(workoutId, { name }, database)
}

export async function saveWorkoutNotes(
  workoutId: string,
  notes: string,
  database: GymTrackerDatabase = db,
): Promise<WorkoutSession> {
  return updateWorkoutSession(workoutId, { notes }, database)
}

export async function saveExerciseNotes(
  workoutExerciseId: string,
  notes: string,
  database: GymTrackerDatabase = db,
): Promise<WorkoutExercise> {
  return updateWorkoutExercise(workoutExerciseId, { notes }, database)
}

export async function moveWorkoutExercise(
  workoutId: string,
  workoutExerciseId: string,
  direction: -1 | 1,
  database: GymTrackerDatabase = db,
): Promise<void> {
  const exercises = await listWorkoutExercises(workoutId, database)
  const index = exercises.findIndex((item) => item.id === workoutExerciseId)
  const swapIndex = index + direction
  if (index < 0 || swapIndex < 0 || swapIndex >= exercises.length) return
  await swapWorkoutExerciseOrder(
    exercises[index].id,
    exercises[swapIndex].id,
    database,
  )
}

export async function addExerciseToWorkout(
  workoutId: string,
  exerciseId: string,
  database: GymTrackerDatabase = db,
): Promise<WorkoutExercise> {
  return addWorkoutExercise({ workoutId, exerciseId }, database)
}

export async function createCustomExercise(
  input: {
    name: string
    category: ExerciseCategory
    equipment: string | null
  },
  database: GymTrackerDatabase = db,
): Promise<Exercise> {
  return createExercise(input, database)
}

export async function createAndAddCustomExercise(
  workoutId: string,
  input: {
    name: string
    category: ExerciseCategory
    equipment: string | null
  },
  database: GymTrackerDatabase = db,
): Promise<Exercise> {
  return database.transaction(
    'rw',
    [database.workoutSessions, database.exercises, database.workoutExercises],
    async () => {
      const exercise = await createExercise(input, database)
      await addExerciseToWorkout(workoutId, exercise.id, database)
      return exercise
    },
  )
}

export async function findExercises(
  query: string,
  database: GymTrackerDatabase = db,
): Promise<Exercise[]> {
  return query.trim()
    ? searchExercises(query, database)
    : listActiveExercises(database)
}

export async function createSet(
  input: {
    workoutExerciseId: string
    setNumber: number
    weightKg: number
    reps: number
    completed: boolean
  },
  database: GymTrackerDatabase = db,
): Promise<ExerciseSet> {
  return addExerciseSet(input, database)
}

export async function saveSet(
  setId: string,
  changes: Partial<
    Pick<ExerciseSet, 'setNumber' | 'weightKg' | 'reps' | 'completed'>
  >,
  database: GymTrackerDatabase = db,
): Promise<ExerciseSet> {
  return updateExerciseSet(setId, changes, database)
}

export async function deleteWorkoutSet(
  setId: string,
  database: GymTrackerDatabase = db,
): Promise<ExerciseSet> {
  return softDeleteExerciseSet(setId, database)
}

export async function getPreviousPerformance(
  exerciseId: string,
  beforeWorkoutId?: string,
  database: GymTrackerDatabase = db,
): Promise<PreviousPerformance | undefined> {
  const beforeWorkout = beforeWorkoutId
    ? await getWorkoutSession(beforeWorkoutId, database)
    : undefined
  const relatedWorkoutExercises = await database.workoutExercises
    .where('exerciseId')
    .equals(exerciseId)
    .filter((link) => link.deletedAt === null)
    .toArray()
  const workoutIds = new Set(
    relatedWorkoutExercises
      .map((link) => link.workoutId)
      .filter((id) => id !== beforeWorkoutId),
  )
  const sessions = await Promise.all(
    [...workoutIds].map((id) => getWorkoutSession(id, database)),
  )
  const completed = sessions
    .filter(
      (session): session is WorkoutSession =>
        session !== undefined &&
        session.deletedAt === null &&
        session.status === 'completed' &&
        session.completedAt !== null &&
        (!beforeWorkout ||
          Date.parse(session.completedAt) <= Date.parse(beforeWorkout.startedAt)),
    )
    .sort(
      (left, right) =>
        Date.parse(right.completedAt ?? '') -
        Date.parse(left.completedAt ?? ''),
    )

  for (const session of completed) {
    const relationIds = relatedWorkoutExercises
      .filter((link) => link.workoutId === session.id)
      .map((link) => link.id)
    const setsByExercise = await Promise.all(
      relationIds.map((id) => listExerciseSets(id, database)),
    )
    const sets = setsByExercise.flat().filter((set) => set.completed)
    if (sets.length > 0) return { workout: session, sets }
  }
  return undefined
}
