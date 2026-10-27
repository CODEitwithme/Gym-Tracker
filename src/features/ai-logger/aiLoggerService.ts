import { createUUID } from '../../lib/dateTime'
import { softDeleteWorkoutSession } from '../../db/repositories/workoutSessions'
import { createAiWorkoutLog } from '../../db/repositories/aiWorkoutLogs'
import {
  addExerciseToWorkout,
  createCustomExercise,
  createSet,
  findExercises,
  finishWorkout,
  saveWorkoutNotes,
  startWorkout,
} from '../workouts/workoutService'
import type { WorkoutSession } from '../workouts/types'
import type { AiProvider, ConfirmedWorkout, ParsedWorkout } from './types'

const WORKER_URL =
  (import.meta.env.VITE_WORKER_URL as string | undefined)?.replace(/\/+$/, '') ??
  'http://localhost:8787'

const DEVICE_TOKEN_KEY = 'forge-fit-device-token'

export function isWorkerConfigured(): boolean {
  return Boolean(import.meta.env.VITE_WORKER_URL || import.meta.env.DEV)
}

export function getDeviceToken(): string {
  let token = localStorage.getItem(DEVICE_TOKEN_KEY)
  if (!token) {
    token = createUUID()
    localStorage.setItem(DEVICE_TOKEN_KEY, token)
  }
  return token
}

async function requestJson<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getDeviceToken()
  const headers: Record<string, string> = {
    'X-Device-Token': token,
    ...(options.headers as Record<string, string> | undefined),
  }

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${WORKER_URL}${endpoint}`, {
    ...options,
    headers,
  })

  let body: { ok?: boolean; data?: T; error?: string; code?: string } | null =
    null
  try {
    body = await response.json()
  } catch {
    // Non-JSON response handled below
  }

  if (!response.ok || (body && body.ok === false)) {
    const message =
      body?.error || `Request failed with status ${response.status}`
    throw new Error(message)
  }

  return (body as { data: T }).data
}

export async function getAiCredentials(): Promise<{
  provider: AiProvider | null
  hasKey: boolean
}> {
  return requestJson<{ provider: AiProvider | null; hasKey: boolean }>(
    '/api/settings/ai-credentials',
    {
      method: 'GET',
    },
  )
}

export async function saveAiCredentials(
  provider: AiProvider,
  apiKey: string,
): Promise<void> {
  await requestJson<{ provider: AiProvider; hasKey: boolean }>(
    '/api/settings/ai-credentials',
    {
      method: 'PUT',
      body: JSON.stringify({ provider, apiKey }),
    },
  )
}

export async function deleteAiCredentials(): Promise<void> {
  await requestJson<null>('/api/settings/ai-credentials', {
    method: 'DELETE',
  })
}

export async function testAiConnection(): Promise<{ message: string }> {
  return requestJson<{ message: string }>('/api/ai/test-connection', {
    method: 'POST',
  })
}

export async function parseWorkoutMessage(
  message: string,
): Promise<ParsedWorkout> {
  return requestJson<ParsedWorkout>('/api/ai/parse-workout', {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}

export async function saveAiWorkout(
  confirmed: ConfirmedWorkout,
): Promise<WorkoutSession> {
  let session: WorkoutSession | null = null
  try {
    session = await startWorkout('AI Workout')

    if (confirmed.notes) {
      await saveWorkoutNotes(session.id, confirmed.notes)
    }

    const exercises = await findExercises(confirmed.exercise)
    let exercise = exercises.find(
      (item) =>
        item.name.toLowerCase() === confirmed.exercise.toLowerCase().trim(),
    )
    if (!exercise) {
      exercise = await createCustomExercise({
        name: confirmed.exercise.trim(),
        category: 'other',
        equipment: null,
      })
    }

    const workoutExercise = await addExerciseToWorkout(session.id, exercise.id)

    const rawWeight = confirmed.weight ?? 0
    const weightKg =
      confirmed.unit === 'lbs'
        ? Math.round(rawWeight * 0.453592 * 100) / 100
        : Math.round(rawWeight * 100) / 100

    for (let setNumber = 1; setNumber <= confirmed.sets; setNumber++) {
      await createSet({
        workoutExerciseId: workoutExercise.id,
        setNumber,
        weightKg,
        reps: confirmed.reps,
        completed: true,
      })
    }

    const completedSession = await finishWorkout(session.id)

    try {
      await createAiWorkoutLog({
        workoutSessionId: completedSession.id,
        originalMessage: confirmed.notes || confirmed.exercise,
        provider: 'gemini',
        parsedExercise: confirmed.exercise,
        confidence: 'high',
      })
    } catch {
      // AI log repository write is auxiliary; do not fail workout save if table write fails
    }

    return completedSession
  } catch (error: unknown) {
    if (session) {
      try {
        await softDeleteWorkoutSession(session.id)
      } catch {
        try {
          await finishWorkout(session.id)
        } catch {
          // ignore cleanup secondary failure
        }
      }
    }
    throw error
  }
}
