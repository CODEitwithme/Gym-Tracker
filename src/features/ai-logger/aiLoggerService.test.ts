import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteAiCredentials,
  getAiCredentials,
  getDeviceToken,
  parseWorkoutMessage,
  saveAiCredentials,
  saveAiWorkout,
  testAiConnection,
} from './aiLoggerService'
import { db } from '../../db/database'
import type { ConfirmedWorkout } from './types'

describe('aiLoggerService', () => {
  let localStorageMock: Record<string, string>
  const fetchMock = vi.fn()

  beforeEach(async () => {
    vi.restoreAllMocks()
    localStorageMock = {}

    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key]
      }),
      clear: vi.fn(() => {
        localStorageMock = {}
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    // Clear Dexie database tables
    await db.workoutSessions.clear()
    await db.exercises.clear()
    await db.workoutExercises.clear()
    await db.exerciseSets.clear()
    await db.aiWorkoutLogs.clear()
  })

  // Test 1: getDeviceToken returns a UUID and reuses it across calls
  it('1. getDeviceToken returns a UUID and reuses it across calls', () => {
    const token1 = getDeviceToken()
    expect(token1).toBeDefined()
    expect(typeof token1).toBe('string')
    // UUID format check (standard 36 chars)
    expect(token1).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )

    const token2 = getDeviceToken()
    expect(token2).toBe(token1)
    expect(localStorage.getItem).toHaveBeenCalledWith('forge-fit-device-token')
  })

  // Test 2: parseWorkoutMessage throws on non-ok response with the error message from the body
  it('2. parseWorkoutMessage throws on non-ok response with the error message from the body', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          error: 'Rate limit exceeded. Please wait a minute.',
          code: 'RATE_LIMIT_EXCEEDED',
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    await expect(
      parseWorkoutMessage('3 sets of 10 bench press at 80kg'),
    ).rejects.toThrow('Rate limit exceeded. Please wait a minute.')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/ai/parse-workout')
    expect(options.method).toBe('POST')
    expect(options.headers['X-Device-Token']).toBeDefined()
  })

  // Test 3: saveAiCredentials sends the correct headers and body
  it('3. saveAiCredentials sends the correct headers and body', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            provider: 'gemini',
            hasKey: true,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    const testKey = 'AIzaSyTestApiKey123456789'
    await saveAiCredentials('gemini', testKey)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/settings/ai-credentials')
    expect(options.method).toBe('PUT')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(options.headers['X-Device-Token']).toBeDefined()
    expect(JSON.parse(options.body)).toEqual({
      provider: 'gemini',
      apiKey: testKey,
    })
  })

  // Test 4: deleteAiCredentials calls DELETE with device token
  it('4. deleteAiCredentials calls DELETE with device token', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          data: null,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    await deleteAiCredentials()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/settings/ai-credentials')
    expect(options.method).toBe('DELETE')
    expect(options.headers['X-Device-Token']).toBeDefined()
  })

  // Test 5: getAiCredentials returns hasKey false when worker says so
  it('5. getAiCredentials returns hasKey false when worker says so', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            provider: null,
            hasKey: false,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    const result = await getAiCredentials()
    expect(result).toEqual({
      provider: null,
      hasKey: false,
    })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/settings/ai-credentials')
    expect(options.method).toBe('GET')
    expect(options.headers['X-Device-Token']).toBeDefined()
  })

  // Test 6: API key is never stored or returned by getAiCredentials
  it('6. API key is never stored or returned by getAiCredentials', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            provider: 'gemini',
            hasKey: true,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    const result = await getAiCredentials()
    expect(result).toEqual({
      provider: 'gemini',
      hasKey: true,
    })
    // Verify object does not leak an apiKey field
    expect((result as Record<string, unknown>).apiKey).toBeUndefined()

    // Verify localStorage has never received any API key
    for (const key of Object.keys(localStorageMock)) {
      expect(key).toBe('forge-fit-device-token')
      expect(localStorageMock[key]).not.toContain('AIza')
    }
  })

  // Test 7: testAiConnection returns response message
  it('7. testAiConnection calls POST and returns message', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            provider: 'gemini',
            message: 'Connection successful',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    const res = await testAiConnection()
    expect(res.message).toBe('Connection successful')

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/ai/test-connection')
    expect(options.method).toBe('POST')
  })

  // Test 8: saveAiWorkout creates workout, exercises, sets, and completes session
  it('8. saveAiWorkout creates workout, exercise, sets, and completes session', async () => {
    const workoutData: ConfirmedWorkout = {
      exercise: 'Incline Dumbbell Press',
      weight: 28,
      unit: 'kg',
      reps: 10,
      sets: 3,
      durationSeconds: null,
      notes: 'Strong set',
    }

    const session = await saveAiWorkout(workoutData)
    expect(session).toBeDefined()
    expect(session.status).toBe('completed')
    expect(session.completedAt).not.toBeNull()
    expect(session.name).toBe('AI Workout')
    expect(session.notes).toBe('Strong set')

    // Verify exercises created in database
    const exercises = await db.exercises.toArray()
    const matchingExercise = exercises.find(
      (e) => e.name === 'Incline Dumbbell Press',
    )
    expect(matchingExercise).toBeDefined()
    expect(matchingExercise?.category).toBe('other')

    // Verify sets created
    const sets = await db.exerciseSets.toArray()
    expect(sets.length).toBe(3)
    for (const set of sets) {
      expect(set.weightKg).toBe(28)
      expect(set.reps).toBe(10)
      expect(set.completed).toBe(true)
    }
  })

  // Test 9: saveAiWorkout correctly converts lbs to kg (rounded to 2 decimal places)
  it('9. saveAiWorkout correctly converts lbs to kg', async () => {
    const workoutData: ConfirmedWorkout = {
      exercise: 'Barbell Squat',
      weight: 100, // 100 lbs * 0.453592 = 45.3592 -> 45.36 kg
      unit: 'lbs',
      reps: 5,
      sets: 4,
      durationSeconds: null,
      notes: '',
    }

    const session = await saveAiWorkout(workoutData)
    expect(session.status).toBe('completed')

    const sets = await db.exerciseSets.toArray()
    expect(sets.length).toBe(4)
    expect(sets[0].weightKg).toBe(45.36)
  })

  // Test 10: saveAiWorkout cleans up session if an error occurs
  it('10. saveAiWorkout cleans up session if a failure occurs', async () => {
    const badWorkoutData: ConfirmedWorkout = {
      exercise: '   ', // Blank exercise will fail validation when adding
      weight: 50,
      unit: 'kg',
      reps: 10,
      sets: 3,
      durationSeconds: null,
      notes: '',
    }

    await expect(saveAiWorkout(badWorkoutData)).rejects.toThrow()

    // No active workout should remain orphaned
    const activeSession = await db.workoutSessions
      .where('status')
      .equals('in_progress')
      .filter((s) => s.deletedAt === null)
      .first()
    expect(activeSession).toBeUndefined()
  })
})
