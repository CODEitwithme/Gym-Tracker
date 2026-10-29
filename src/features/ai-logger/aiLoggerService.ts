import { createTimestamp, createUUID } from '../../lib/dateTime'
import {
  createWorkoutSession,
  softDeleteWorkoutSession,
  updateWorkoutSession,
} from '../../db/repositories/workoutSessions'
import { createAiWorkoutLog } from '../../db/repositories/aiWorkoutLogs'
import {
  addExerciseToWorkout,
  createCustomExercise,
  createSet,
  findExercises,
  finishWorkout,
  saveWorkoutNotes,
} from '../workouts/workoutService'
import type { WorkoutSession } from '../workouts/types'
import { createMeal, fetchSavedMeals, logMeal } from '../nutrition/nutritionService'
import type { MealLog } from '../nutrition/types'
import type {
  AiProvider,
  ConfirmedExerciseItem,
  ConfirmedMeal,
  ConfirmedMealItem,
  ConfirmedWorkout,
  ParsedMeal,
  ParsedWorkout,
} from './types'

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

export async function parseMealMessage(
  message: string,
): Promise<ParsedMeal> {
  return requestJson<ParsedMeal>('/api/ai/parse-meal', {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}

export async function saveAiMeal(
  confirmed: ConfirmedMeal,
): Promise<MealLog> {
  const mealItems: ConfirmedMealItem[] =
    confirmed.meals && confirmed.meals.length > 0
      ? confirmed.meals
      : confirmed.mealName
        ? [
            {
              mealName: confirmed.mealName,
              mealType: confirmed.mealType ?? 'snack',
              servingDescription: confirmed.servingDescription ?? '1 serving',
              calories: confirmed.calories ?? 0,
              proteinG: confirmed.proteinG ?? 0,
              carbsG: confirmed.carbsG ?? 0,
              fatG: confirmed.fatG ?? 0,
              portionPercent: confirmed.portionPercent ?? 100,
              consumedAt: confirmed.consumedAt,
              notes: confirmed.notes,
            },
          ]
        : []

  if (mealItems.length === 0) {
    throw new Error('No meal data provided to save.')
  }

  let firstLog: MealLog | null = null

  for (const item of mealItems) {
    const existing = await fetchSavedMeals(item.mealName)
    let savedMeal = existing.find(
      (m) => m.name.toLowerCase() === item.mealName.toLowerCase().trim(),
    )

    if (!savedMeal) {
      savedMeal = await createMeal({
        name: item.mealName.trim(),
        servingDescription: item.servingDescription.trim() || '1 serving',
        calorieSource: 'manual',
        calories: Math.max(0, Math.round(item.calories)),
        proteinG: Math.max(0, item.proteinG),
        carbsG: Math.max(0, item.carbsG),
        fatG: Math.max(0, item.fatG),
      })
    }

    const consumedAt =
      item.consumedAt || confirmed.consumedAt || new Date().toISOString()
    const portionPercent =
      item.portionPercent > 0 ? item.portionPercent : 100

    const log = await logMeal({
      savedMealId: savedMeal.id,
      consumedAt,
      mealType: item.mealType,
      portionPercent,
    })

    if (!firstLog) {
      firstLog = log
    }
  }

  return firstLog!
}

export async function saveAiWorkout(
  confirmed: ConfirmedWorkout,
): Promise<WorkoutSession> {
  const exerciseItems: ConfirmedExerciseItem[] =
    confirmed.exercises && confirmed.exercises.length > 0
      ? confirmed.exercises
      : confirmed.exercise
        ? [
            {
              exercise: confirmed.exercise,
              weight: confirmed.weight ?? null,
              unit: confirmed.unit ?? 'kg',
              reps: confirmed.reps ?? 1,
              sets: confirmed.sets ?? 1,
              durationSeconds: confirmed.durationSeconds ?? null,
              notes: confirmed.notes ?? '',
            },
          ]
        : []

  if (exerciseItems.length === 0) {
    throw new Error('No exercise data provided to save.')
  }

  let session: WorkoutSession | null = null
  try {
    const startedAt = confirmed.startedAt || createTimestamp()
    session = await createWorkoutSession({
      name: confirmed.sessionName || 'AI Workout',
      startedAt,
      completedAt: null,
      status: 'in_progress',
      notes: '',
    })

    const combinedNotes =
      confirmed.notes ||
      exerciseItems
        .map((e) => e.notes)
        .filter(Boolean)
        .join('; ')

    if (combinedNotes) {
      await saveWorkoutNotes(session.id, combinedNotes)
    }

    for (const item of exerciseItems) {
      const exercises = await findExercises(item.exercise)
      let exercise = exercises.find(
        (e) => e.name.toLowerCase() === item.exercise.toLowerCase().trim(),
      )
      if (!exercise) {
        exercise = await createCustomExercise({
          name: item.exercise.trim(),
          category: 'other',
          equipment: null,
        })
      }

      const workoutExercise = await addExerciseToWorkout(session.id, exercise.id)

      const rawWeight = item.weight ?? 0
      const weightKg =
        item.unit === 'lbs'
          ? Math.round(rawWeight * 0.453592 * 100) / 100
          : Math.round(rawWeight * 100) / 100

      const setsCount = item.sets && item.sets > 0 ? item.sets : 1
      const repsCount = item.reps && item.reps > 0 ? item.reps : 1

      for (let setNumber = 1; setNumber <= setsCount; setNumber++) {
        await createSet({
          workoutExerciseId: workoutExercise.id,
          setNumber,
          weightKg,
          reps: repsCount,
          completed: true,
        })
      }
    }

    let completedSession = await finishWorkout(session.id)
    if (confirmed.startedAt || confirmed.completedAt) {
      completedSession = await updateWorkoutSession(completedSession.id, {
        ...(confirmed.startedAt ? { startedAt: confirmed.startedAt } : {}),
        ...(confirmed.completedAt ? { completedAt: confirmed.completedAt } : {}),
      })
    }

    try {
      await createAiWorkoutLog({
        workoutSessionId: completedSession.id,
        originalMessage:
          combinedNotes ||
          exerciseItems.map((e) => e.exercise).join(', '),
        provider: 'gemini',
        parsedExercise: exerciseItems.map((e) => e.exercise).join(', '),
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
