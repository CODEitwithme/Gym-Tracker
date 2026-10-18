import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import { createExercise, updateExercise } from '../../db/repositories/exercises'
import {
  addExerciseSet,
  listExerciseSets,
  listWorkoutExercises,
  softDeleteExerciseSet,
  updateExerciseSet,
} from '../../db/repositories/workoutDetails'
import {
  createWorkoutSession,
  listWorkoutSessions,
  softDeleteWorkoutSession,
  updateWorkoutSession,
} from '../../db/repositories/workoutSessions'
import { GymTrackerDatabase } from '../../db/database'
import workoutUiReducer from './workoutUiSlice'
import {
  addExerciseToWorkout,
  createAndAddCustomExercise,
  createCustomExercise,
  finishWorkout,
  getPreviousPerformance,
  listCompletedWorkoutSummaries,
  moveWorkoutExercise,
  loadActiveWorkout,
  loadWorkoutDetails,
  startWorkout,
  saveExerciseNotes,
  saveWorkoutNotes,
} from './workoutService'
import * as workoutService from './workoutService'
import { finishWorkoutThunk, startWorkoutThunk } from './workoutThunks'
import { createUUID } from '../../lib/dateTime'

let testDatabase: GymTrackerDatabase
const databaseName = () => `gym-tracker-workouts-${createUUID()}`

beforeEach(async () => {
  testDatabase = new GymTrackerDatabase(databaseName())
  await testDatabase.open()
})

afterEach(async () => {
  vi.restoreAllMocks()
  testDatabase.close()
  await testDatabase.delete()
})

async function makeExercise(database: GymTrackerDatabase) {
  return createExercise(
    { name: 'Test exercise', category: 'legs', equipment: null },
    database,
  )
}

async function makeInProgressWorkout(
  database: GymTrackerDatabase,
  name = 'Test workout',
) {
  return createWorkoutSession(
    {
      name,
      startedAt: new Date(Date.now() - 60_000).toISOString(),
      completedAt: null,
      status: 'in_progress',
      notes: '',
    },
    database,
  )
}

describe('workout service persistence', () => {
  it('starts a workout in IndexedDB and prevents a second active workout', async () => {
    const workout = await startWorkout('Morning session', testDatabase)
    expect(await loadActiveWorkout(testDatabase)).toMatchObject({
      id: workout.id,
      status: 'in_progress',
      completedAt: null,
    })
    await expect(startWorkout('Another session', testDatabase)).rejects.toThrow(
      /already exists/,
    )
    expect(await testDatabase.workoutSessions.count()).toBe(1)
  })

  it('serializes concurrent start requests so only one active workout is created', async () => {
    const outcomes = await Promise.allSettled([
      startWorkout('First request', testDatabase),
      startWorkout('Second request', testDatabase),
    ])
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(await testDatabase.workoutSessions.count()).toBe(1)
  })

  it('persists an exercise relationship and stable name snapshot', async () => {
    const workout = await makeInProgressWorkout(testDatabase)
    const exercise = await makeExercise(testDatabase)
    const added = await addExerciseToWorkout(
      workout.id,
      exercise.id,
      testDatabase,
    )
    await testDatabase.exercises.update(exercise.id, {
      name: 'Renamed exercise',
    })
    expect(await listWorkoutExercises(workout.id, testDatabase)).toMatchObject([
      { id: added.id, exerciseId: exercise.id, exerciseNameSnapshot: 'Test exercise' },
    ])
    await expect(
      addExerciseToWorkout(workout.id, exercise.id, testDatabase),
    ).rejects.toThrow(/already part/)
  })

  it('persists exercise order and notes through the service', async () => {
    const workout = await makeInProgressWorkout(testDatabase)
    const firstExercise = await makeExercise(testDatabase)
    const secondExercise = await createExercise(
      { name: 'Second exercise', category: 'back', equipment: null },
      testDatabase,
    )
    const first = await addExerciseToWorkout(
      workout.id,
      firstExercise.id,
      testDatabase,
    )
    const second = await addExerciseToWorkout(
      workout.id,
      secondExercise.id,
      testDatabase,
    )
    await saveExerciseNotes(first.id, 'Keep a controlled tempo.', testDatabase)
    await saveWorkoutNotes(workout.id, 'Increase the load next session.', testDatabase)
    await moveWorkoutExercise(workout.id, second.id, -1, testDatabase)
    expect(await testDatabase.workoutSessions.get(workout.id)).toMatchObject({
      notes: 'Increase the load next session.',
    })
    expect(await listWorkoutExercises(workout.id, testDatabase)).toMatchObject([
      { id: second.id, order: 0 },
      { id: first.id, order: 1, notes: 'Keep a controlled tempo.' },
    ])
  })

  it('rolls back custom exercise creation if adding it to a workout fails', async () => {
    await expect(
      createAndAddCustomExercise(
        'missing-workout',
        { name: 'Orphan prevention', category: 'core', equipment: null },
        testDatabase,
      ),
    ).rejects.toThrow(/not found/)
    expect(await testDatabase.exercises.count()).toBe(0)
    expect(await testDatabase.workoutExercises.count()).toBe(0)
  })

  it('creates, updates, and completes sets while rejecting invalid values', async () => {
    const workout = await makeInProgressWorkout(testDatabase)
    const exercise = await makeExercise(testDatabase)
    const workoutExercise = await addExerciseToWorkout(
      workout.id,
      exercise.id,
      testDatabase,
    )
    await expect(
      addExerciseSet(
        {
          workoutExerciseId: workoutExercise.id,
          setNumber: 1,
          weightKg: -2,
          reps: 10,
          completed: false,
        },
        testDatabase,
      ),
    ).rejects.toThrow(/non-negative/)
    await expect(
      addExerciseSet(
        {
          workoutExerciseId: workoutExercise.id,
          setNumber: 1,
          weightKg: 20,
          reps: 10.5,
          completed: false,
        },
        testDatabase,
      ),
    ).rejects.toThrow(/positive integer/)
    const set = await addExerciseSet(
      {
        workoutExerciseId: workoutExercise.id,
        setNumber: 1,
        weightKg: 0,
        reps: 10,
        completed: false,
      },
      testDatabase,
    )
    await updateExerciseSet(
      set.id,
      { weightKg: 25, reps: 8, completed: true },
      testDatabase,
    )
    expect(await listExerciseSets(workoutExercise.id, testDatabase)).toMatchObject(
      [{ id: set.id, weightKg: 25, reps: 8, completed: true }],
    )
  })

  it('recovers an in-progress workout and its sets after reopening the database', async () => {
    const workout = await makeInProgressWorkout(testDatabase, 'Recovered session')
    const exercise = await makeExercise(testDatabase)
    const workoutExercise = await addExerciseToWorkout(
      workout.id,
      exercise.id,
      testDatabase,
    )
    const set = await addExerciseSet(
      {
        workoutExerciseId: workoutExercise.id,
        setNumber: 1,
        weightKg: 40,
        reps: 6,
        completed: true,
      },
      testDatabase,
    )
    const name = testDatabase.name
    testDatabase.close()

    const reopened = new GymTrackerDatabase(name)
    await reopened.open()
    expect(await loadActiveWorkout(reopened)).toMatchObject({ id: workout.id })
    expect(await loadWorkoutDetails(workout.id, reopened)).toMatchObject({
      session: { name: 'Recovered session', status: 'in_progress' },
      exercises: [{ sets: [{ id: set.id, weightKg: 40, completed: true }] }],
    })
    reopened.close()
    await reopened.delete()
  })

  it('finishes once with a completion timestamp and summarizes completed history', async () => {
    const older = await makeInProgressWorkout(testDatabase, 'Older session')
    const newer = await makeInProgressWorkout(testDatabase, 'Newer session')
    await finishWorkout(older.id, testDatabase)
    const finished = await finishWorkout(newer.id, testDatabase)
    expect(finished.status).toBe('completed')
    expect(finished.completedAt).not.toBeNull()
    expect(Date.parse(finished.completedAt ?? '')).toBeGreaterThanOrEqual(
      Date.parse(finished.startedAt),
    )
    await expect(finishWorkout(newer.id, testDatabase)).rejects.toThrow(
      /already been completed/,
    )
    const summaries = await listCompletedWorkoutSummaries(testDatabase)
    expect(summaries.map((summary) => summary.session.id)).toEqual([
      newer.id,
      older.id,
    ])
    await softDeleteWorkoutSession(older.id, testDatabase)
    expect(
      (await listCompletedWorkoutSummaries(testDatabase)).map(
        (summary) => summary.session.id,
      ),
    ).toEqual([newer.id])
  })

  it('uses completed sessions and completed sets only for previous performance', async () => {
    const exercise = await makeExercise(testDatabase)
    const incompleteWorkout = await makeInProgressWorkout(
      testDatabase,
      'Still in progress',
    )
    const incompleteRelation = await addExerciseToWorkout(
      incompleteWorkout.id,
      exercise.id,
      testDatabase,
    )
    await addExerciseSet(
      {
        workoutExerciseId: incompleteRelation.id,
        setNumber: 1,
        weightKg: 80,
        reps: 5,
        completed: true,
      },
      testDatabase,
    )
    expect(
      await getPreviousPerformance(exercise.id, undefined, testDatabase),
    ).toBeUndefined()

    const completedWorkout = await makeInProgressWorkout(
      testDatabase,
      'Completed workout',
    )
    const relation = await addExerciseToWorkout(
      completedWorkout.id,
      exercise.id,
      testDatabase,
    )
    await addExerciseSet(
      {
        workoutExerciseId: relation.id,
        setNumber: 1,
        weightKg: 50,
        reps: 8,
        completed: false,
      },
      testDatabase,
    )
    const completedSet = await addExerciseSet(
      {
        workoutExerciseId: relation.id,
        setNumber: 2,
        weightKg: 45,
        reps: 10,
        completed: true,
      },
      testDatabase,
    )
    const finished = await finishWorkout(completedWorkout.id, testDatabase)
    const previous = await getPreviousPerformance(
      exercise.id,
      'current-workout',
      testDatabase,
    )
    expect(previous?.workout.id).toBe(finished.id)
    expect(previous?.sets.map((set) => set.id)).toEqual([completedSet.id])
    expect(await listWorkoutSessions(testDatabase)).toHaveLength(2)
  })

  it('preserves set and workout data if related operations fail', async () => {
    const workout = await makeInProgressWorkout(testDatabase)
    await expect(
      addExerciseToWorkout(workout.id, 'missing-exercise', testDatabase),
    ).rejects.toThrow(/not found/)
    expect(await testDatabase.workoutExercises.count()).toBe(0)
    expect(await testDatabase.workoutSessions.get(workout.id)).toEqual(workout)
  })

  it('propagates a failed IndexedDB workout save without changing the record', async () => {
    const workout = await makeInProgressWorkout(testDatabase)
    vi.spyOn(testDatabase.workoutSessions, 'put').mockRejectedValueOnce(
      new Error('Injected IndexedDB write failure'),
    )

    await expect(
      saveWorkoutNotes(workout.id, 'New notes', testDatabase),
    ).rejects.toThrow(/Injected IndexedDB write failure/)
    expect(await testDatabase.workoutSessions.get(workout.id)).toEqual(workout)
  })

  it('excludes workouts completed after the target workout started from previous performance', async () => {
    const exercise = await makeExercise(testDatabase)
    const baseTime = Date.now()
    const pastWorkout = await createWorkoutSession(
      {
        name: 'Past session',
        startedAt: new Date(baseTime - 120_000).toISOString(),
        completedAt: null,
        status: 'in_progress',
        notes: '',
      },
      testDatabase,
    )
    const pastLink = await addExerciseToWorkout(
      pastWorkout.id,
      exercise.id,
      testDatabase,
    )
    const pastSet = await addExerciseSet(
      {
        workoutExerciseId: pastLink.id,
        setNumber: 1,
        weightKg: 50,
        reps: 10,
        completed: true,
      },
      testDatabase,
    )
    await updateWorkoutSession(
      pastWorkout.id,
      {
        status: 'completed',
        completedAt: new Date(baseTime - 90_000).toISOString(),
      },
      testDatabase,
    )

    const currentWorkout = await createWorkoutSession(
      {
        name: 'Current session',
        startedAt: new Date(baseTime - 60_000).toISOString(),
        completedAt: null,
        status: 'in_progress',
        notes: '',
      },
      testDatabase,
    )

    const futureWorkout = await createWorkoutSession(
      {
        name: 'Future session',
        startedAt: new Date(baseTime - 30_000).toISOString(),
        completedAt: null,
        status: 'in_progress',
        notes: '',
      },
      testDatabase,
    )
    const futureLink = await addExerciseToWorkout(
      futureWorkout.id,
      exercise.id,
      testDatabase,
    )
    await addExerciseSet(
      {
        workoutExerciseId: futureLink.id,
        setNumber: 1,
        weightKg: 60,
        reps: 10,
        completed: true,
      },
      testDatabase,
    )
    await updateWorkoutSession(
      futureWorkout.id,
      {
        status: 'completed',
        completedAt: new Date(baseTime - 10_000).toISOString(),
      },
      testDatabase,
    )

    const previousForCurrent = await getPreviousPerformance(
      exercise.id,
      currentWorkout.id,
      testDatabase,
    )
    expect(previousForCurrent?.workout.id).toBe(pastWorkout.id)
    expect(previousForCurrent?.sets[0].id).toBe(pastSet.id)

    const previousForPast = await getPreviousPerformance(
      exercise.id,
      pastWorkout.id,
      testDatabase,
    )
    expect(previousForPast).toBeUndefined()
  })

  it('excludes soft-deleted records from workout details and previous performance', async () => {
    const exercise = await makeExercise(testDatabase)
    const workout = await makeInProgressWorkout(testDatabase, 'Session for soft deletion')
    const link = await addExerciseToWorkout(workout.id, exercise.id, testDatabase)
    const firstSet = await addExerciseSet(
      {
        workoutExerciseId: link.id,
        setNumber: 1,
        weightKg: 40,
        reps: 10,
        completed: true,
      },
      testDatabase,
    )
    const secondSet = await addExerciseSet(
      {
        workoutExerciseId: link.id,
        setNumber: 2,
        weightKg: 40,
        reps: 10,
        completed: true,
      },
      testDatabase,
    )
    await softDeleteExerciseSet(firstSet.id, testDatabase)

    const details = await loadWorkoutDetails(workout.id, testDatabase)
    expect(details?.exercises[0].sets.map((s) => s.id)).toEqual([secondSet.id])

    await finishWorkout(workout.id, testDatabase)
    const previous = await getPreviousPerformance(exercise.id, undefined, testDatabase)
    expect(previous?.sets.map((s) => s.id)).toEqual([secondSet.id])

    await softDeleteWorkoutSession(workout.id, testDatabase)
    expect(await getPreviousPerformance(exercise.id, undefined, testDatabase)).toBeUndefined()
    expect(await loadWorkoutDetails(workout.id, testDatabase)).toBeUndefined()
  })

  it('prevents modifying or deleting sets on a completed workout', async () => {
    const workout = await makeInProgressWorkout(testDatabase, 'Immutable session')
    const exercise = await makeExercise(testDatabase)
    const link = await addExerciseToWorkout(workout.id, exercise.id, testDatabase)
    const set = await addExerciseSet(
      {
        workoutExerciseId: link.id,
        setNumber: 1,
        weightKg: 20,
        reps: 8,
        completed: true,
      },
      testDatabase,
    )
    await finishWorkout(workout.id, testDatabase)

    await expect(
      softDeleteExerciseSet(set.id, testDatabase),
    ).rejects.toThrow(/in-progress/)
    await expect(
      updateExerciseSet(set.id, { weightKg: 25 }, testDatabase),
    ).rejects.toThrow(/in-progress/)
    await expect(
      addExerciseSet(
        {
          workoutExerciseId: link.id,
          setNumber: 2,
          weightKg: 20,
          reps: 8,
          completed: false,
        },
        testDatabase,
      ),
    ).rejects.toThrow(/in-progress/)

    const completedSession = await testDatabase.workoutSessions.get(workout.id)
    expect(completedSession).toBeDefined()
    await expect(
      updateWorkoutSession(
        workout.id,
        { name: 'Changed after completion' },
        testDatabase,
      ),
    ).rejects.toThrow(/Completed workouts cannot be modified/)
    await expect(
      updateWorkoutSession(
        workout.id,
        { status: 'in_progress', completedAt: null },
        testDatabase,
      ),
    ).rejects.toThrow(/Completed workouts cannot be modified/)
    expect(await testDatabase.workoutSessions.get(workout.id)).toEqual(
      completedSession,
    )
  })

  it('rejects a completion timestamp earlier than the workout start', async () => {
    const workout = await createWorkoutSession(
      {
        name: 'Chronology validation',
        startedAt: '2026-01-02T10:00:00.000Z',
        completedAt: null,
        status: 'in_progress',
        notes: '',
      },
      testDatabase,
    )

    await expect(
      updateWorkoutSession(
        workout.id,
        {
          status: 'completed',
          completedAt: '2026-01-02T09:59:59.999Z',
        },
        testDatabase,
      ),
    ).rejects.toThrow(/cannot be before its start time/)
    expect(await testDatabase.workoutSessions.get(workout.id)).toEqual(workout)
  })

  it('validates invalid set repetitions and set numbers', async () => {
    const workout = await makeInProgressWorkout(testDatabase)
    const exercise = await makeExercise(testDatabase)
    const link = await addExerciseToWorkout(workout.id, exercise.id, testDatabase)
    await expect(
      addExerciseSet(
        {
          workoutExerciseId: link.id,
          setNumber: 0,
          weightKg: 10,
          reps: 10,
          completed: false,
        },
        testDatabase,
      ),
    ).rejects.toThrow(/positive integer/)
    await expect(
      addExerciseSet(
        {
          workoutExerciseId: link.id,
          setNumber: 1,
          weightKg: 10,
          reps: 0,
          completed: false,
        },
        testDatabase,
      ),
    ).rejects.toThrow(/positive integer/)
    await expect(
      addExerciseSet(
        {
          workoutExerciseId: link.id,
          setNumber: 1,
          weightKg: 10,
          reps: -5,
          completed: false,
        },
        testDatabase,
      ),
    ).rejects.toThrow(/positive integer/)
  })
})

describe('workout Redux async workflows', () => {
  it('stores an operation error and handles a successful start without copying records', async () => {
    const workflowStore = configureStore({ reducer: { workoutUi: workoutUiReducer } })
    const fakeSession = {
      id: createUUID(),
      name: 'Workflow test',
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: 'in_progress' as const,
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    }
    const startSpy = vi
      .spyOn(workoutService, 'startWorkout')
      .mockRejectedValueOnce(new Error('Workout name must not be blank.'))
      .mockResolvedValueOnce(fakeSession)
    const finishSpy = vi
      .spyOn(workoutService, 'finishWorkout')
      .mockResolvedValueOnce({
        ...fakeSession,
        status: 'completed',
        completedAt: new Date().toISOString(),
      })

    const failed = await workflowStore.dispatch(startWorkoutThunk('  '))
    expect(startWorkoutThunk.rejected.match(failed)).toBe(true)
    expect(workflowStore.getState().workoutUi.status).toBe('failed')
    expect(workflowStore.getState().workoutUi.error).toMatch(/blank/)
    expect(workflowStore.getState().workoutUi).not.toHaveProperty('workout')

    const started = await workflowStore.dispatch(startWorkoutThunk('Workflow test'))
    if (!startWorkoutThunk.fulfilled.match(started)) {
      throw new Error('Expected the workout start thunk to fulfill.')
    }
    const workoutId = started.payload
    expect(workflowStore.getState().workoutUi.activeWorkoutId).toBe(workoutId)

    const finished = await workflowStore.dispatch(finishWorkoutThunk(workoutId))
    expect(finishWorkoutThunk.fulfilled.match(finished)).toBe(true)
    expect(workflowStore.getState().workoutUi.activeWorkoutId).toBeNull()
    expect(startSpy).toHaveBeenCalledTimes(2)
    expect(finishSpy).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })
})

describe('custom exercise flow', () => {
  it('creates custom exercises through the existing typed repository', async () => {
    const exercise = await createCustomExercise(
      { name: 'Custom movement', category: 'core', equipment: null },
      testDatabase,
    )
    expect(exercise.name).toBe('Custom movement')
    expect(exercise.id).toBeTruthy()
  })

  it('rejects duplicate active exercise names and trimmed case-insensitive collisions', async () => {
    await createCustomExercise(
      { name: 'Bench Press', category: 'chest', equipment: 'Barbell' },
      testDatabase,
    )
    await expect(
      createCustomExercise(
        { name: '  bench press  ', category: 'chest', equipment: 'Dumbbells' },
        testDatabase,
      ),
    ).rejects.toThrow(/already exists/)

    const overheadPress = await createCustomExercise(
      { name: 'Overhead Press', category: 'shoulders', equipment: 'Barbell' },
      testDatabase,
    )
    await expect(
      updateExercise(overheadPress.id, { name: 'bench press' }, testDatabase),
    ).rejects.toThrow(/already exists/)
  })

  it('prevents duplicate submissions from creating duplicate exercises in a workout', async () => {
    const workout = await makeInProgressWorkout(testDatabase)
    await createAndAddCustomExercise(
      workout.id,
      { name: 'Unique movement', category: 'arms', equipment: null },
      testDatabase,
    )
    await expect(
      createAndAddCustomExercise(
        workout.id,
        { name: 'Unique movement', category: 'arms', equipment: null },
        testDatabase,
      ),
    ).rejects.toThrow(/already exists/)
    expect(
      (await testDatabase.exercises.toArray()).filter(
        (e) => e.name === 'Unique movement',
      ),
    ).toHaveLength(1)
  })
})
