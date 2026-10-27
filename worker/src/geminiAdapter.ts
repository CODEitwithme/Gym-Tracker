import type { MealType, ParsedMeal, ParsedWorkout } from './types'

export const GEMINI_SYSTEM_PROMPT = `You are a workout data extraction assistant. Extract workout data from the user's natural language message. Return ONLY valid JSON matching this schema (no markdown, no explanation):
{
  "exercise": string (exercise name, title-cased) or null,
  "weight": number or null,
  "unit": "kg" or "lbs" or null,
  "reps": positive integer or null,
  "sets": positive integer or null,
  "durationSeconds": positive integer or null,
  "notes": string or null,
  "confidence": "high" if you could extract all key details, "low" if guessing,
  "followUpQuestion": string asking for missing essential details, or null if not needed
}
Rules: treat ambiguous info as null. Do not invent numbers. Do not include any text outside the JSON.`

export const GEMINI_MEAL_SYSTEM_PROMPT = `You are a nutrition and meal data extraction assistant. Extract food, meal, and macronutrient information from the user's natural language message. Estimate realistic nutritional values if exact numbers are not given. Return ONLY valid JSON matching this schema (no markdown, no explanation):
{
  "mealName": string (e.g. "Oatmeal with Blueberries and Honey", title-cased),
  "mealType": "breakfast" | "lunch" | "dinner" | "snack",
  "servingDescription": string (e.g. "1 bowl (approx 350g)" or "2 slices"),
  "calories": non-negative integer (estimated total kcal),
  "proteinG": non-negative number (grams of protein),
  "carbsG": non-negative number (grams of carbohydrates),
  "fatG": non-negative number (grams of fat),
  "notes": string or null,
  "confidence": "high" if confident in estimation or numbers, "low" if guessing,
  "followUpQuestion": string asking for missing details if highly ambiguous, or null if not needed
}
Rules:
1. mealType must be exactly one of: "breakfast", "lunch", "dinner", "snack". Infer from meal items, context, or time of day, defaulting to "snack" if completely unspecified.
2. calories, proteinG, carbsG, fatG must be realistic non-negative numbers.
3. Do not invent unrealistic values. Do not include any text outside the JSON.`

export type GeminiErrorCode = 'INVALID_KEY' | 'QUOTA_EXCEEDED' | 'PROVIDER_ERROR'

export class GeminiApiError extends Error {
  readonly code: GeminiErrorCode
  readonly status: number

  constructor(message: string, code: GeminiErrorCode, status: number = 400) {
    super(message)
    this.name = 'GeminiApiError'
    this.code = code
    this.status = status
  }
}

export function validateParsedWorkout(raw: unknown): ParsedWorkout {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Parsed workout must be an object')
  }

  const r = raw as Record<string, unknown>

  if (typeof r.exercise !== 'string' || r.exercise.trim().length === 0) {
    throw new Error('exercise must be a non-empty string')
  }

  if (r.confidence !== 'high' && r.confidence !== 'low') {
    throw new Error('confidence must be "high" or "low"')
  }

  let weight: number | null = null
  if (r.weight !== null && r.weight !== undefined) {
    if (typeof r.weight !== 'number' || isNaN(r.weight) || r.weight < 0) {
      throw new Error('weight must be a non-negative number or null')
    }
    weight = r.weight
  }

  let unit: 'kg' | 'lbs' | null = null
  if (r.unit !== null && r.unit !== undefined) {
    if (r.unit !== 'kg' && r.unit !== 'lbs') {
      throw new Error('unit must be "kg", "lbs", or null')
    }
    unit = r.unit
  }

  let reps: number | null = null
  if (r.reps !== null && r.reps !== undefined) {
    if (typeof r.reps !== 'number' || !Number.isInteger(r.reps) || r.reps <= 0) {
      throw new Error('reps must be a positive integer or null')
    }
    reps = r.reps
  }

  let sets: number | null = null
  if (r.sets !== null && r.sets !== undefined) {
    if (typeof r.sets !== 'number' || !Number.isInteger(r.sets) || r.sets <= 0) {
      throw new Error('sets must be a positive integer or null')
    }
    sets = r.sets
  }

  let durationSeconds: number | null = null
  if (r.durationSeconds !== null && r.durationSeconds !== undefined) {
    if (typeof r.durationSeconds !== 'number' || !Number.isInteger(r.durationSeconds) || r.durationSeconds <= 0) {
      throw new Error('durationSeconds must be a positive integer or null')
    }
    durationSeconds = r.durationSeconds
  }

  let notes: string | null = null
  if (r.notes !== null && r.notes !== undefined) {
    if (typeof r.notes !== 'string') {
      throw new Error('notes must be a string or null')
    }
    notes = r.notes
  }

  let followUpQuestion: string | null = null
  if (r.followUpQuestion !== null && r.followUpQuestion !== undefined) {
    if (typeof r.followUpQuestion !== 'string') {
      throw new Error('followUpQuestion must be a string or null')
    }
    followUpQuestion = r.followUpQuestion
  }

  return {
    exercise: r.exercise.trim(),
    weight,
    unit,
    reps,
    sets,
    durationSeconds,
    notes,
    confidence: r.confidence,
    followUpQuestion,
  }
}

export function validateParsedMeal(raw: unknown): ParsedMeal {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Parsed meal must be an object')
  }

  const r = raw as Record<string, unknown>

  if (typeof r.mealName !== 'string' || r.mealName.trim().length === 0) {
    throw new Error('mealName must be a non-empty string')
  }

  const validMealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
  let mealType: MealType = 'snack'
  if (typeof r.mealType === 'string' && validMealTypes.includes(r.mealType.toLowerCase() as MealType)) {
    mealType = r.mealType.toLowerCase() as MealType
  }

  const servingDescription =
    typeof r.servingDescription === 'string' && r.servingDescription.trim().length > 0
      ? r.servingDescription.trim()
      : '1 serving'

  if (r.confidence !== 'high' && r.confidence !== 'low') {
    throw new Error('confidence must be "high" or "low"')
  }

  const calories =
    typeof r.calories === 'number' && !isNaN(r.calories) && r.calories >= 0
      ? Math.round(r.calories)
      : 0

  const proteinG =
    typeof r.proteinG === 'number' && !isNaN(r.proteinG) && r.proteinG >= 0
      ? Math.round(r.proteinG * 10) / 10
      : 0

  const carbsG =
    typeof r.carbsG === 'number' && !isNaN(r.carbsG) && r.carbsG >= 0
      ? Math.round(r.carbsG * 10) / 10
      : 0

  const fatG =
    typeof r.fatG === 'number' && !isNaN(r.fatG) && r.fatG >= 0
      ? Math.round(r.fatG * 10) / 10
      : 0

  let notes: string | null = null
  if (r.notes !== null && r.notes !== undefined) {
    if (typeof r.notes !== 'string') {
      throw new Error('notes must be a string or null')
    }
    notes = r.notes
  }

  let followUpQuestion: string | null = null
  if (r.followUpQuestion !== null && r.followUpQuestion !== undefined) {
    if (typeof r.followUpQuestion !== 'string') {
      throw new Error('followUpQuestion must be a string or null')
    }
    followUpQuestion = r.followUpQuestion
  }

  return {
    mealName: r.mealName.trim(),
    mealType,
    servingDescription,
    calories,
    proteinG,
    carbsG,
    fatG,
    notes,
    confidence: r.confidence,
    followUpQuestion,
  }
}

async function findAvailableModel(apiKey: string): Promise<{ apiVersion: 'v1' | 'v1beta'; modelName: string } | null> {
  for (const apiVersion of ['v1beta', 'v1'] as const) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/${apiVersion}/models?key=${encodeURIComponent(apiKey)}`, {
        signal: AbortSignal.timeout(6000),
      })
      if (!res.ok) continue
      const data = await res.json() as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> }
      if (!data.models || !Array.isArray(data.models)) continue

      const generatingModels = data.models.filter(m =>
        m.supportedGenerationMethods?.includes('generateContent')
      )

      // Only select Flash / Lite models that have free-tier quota (never Pro models with limit: 0)
      const flashModels = generatingModels.filter(m =>
        !m.name.toLowerCase().includes('pro') &&
        m.name.toLowerCase().includes('flash')
      )

      const preferences = [
        'gemini-flash-lite-latest',
        'gemini-3.5-flash',
        'gemini-3.1-flash-lite',
        'gemini-flash-latest',
        'gemini-2.0-flash-lite',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
      ]

      for (const pref of preferences) {
        const found = flashModels.find(m => m.name.toLowerCase().includes(pref))
        if (found) {
          return { apiVersion, modelName: found.name.replace(/^models\//, '') }
        }
      }

      // If no preferred flash found, check any non-pro model
      const nonPro = generatingModels.find(m => !m.name.toLowerCase().includes('pro'))
      if (nonPro) {
        return { apiVersion, modelName: nonPro.name.replace(/^models\//, '') }
      }
    } catch {
      // Continue to next apiVersion
    }
  }
  return null
}

export async function callGeminiRaw(
  apiKey: string,
  prompt: string,
  systemPrompt: string,
  model?: string
): Promise<unknown> {
  const tryModel = async (apiVersion: string, targetModel: string, useSystemInstruction = true): Promise<Response> => {
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey)}`
    
    const body: Record<string, unknown> = {
      contents: [
        {
          parts: [
            {
              text: useSystemInstruction
                ? prompt
                : `${systemPrompt}\n\nUser message:\n${prompt}`,
            },
          ],
        },
      ],
      generationConfig: {
        response_mime_type: 'application/json',
      },
    }

    if (useSystemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemPrompt }],
      }
    }

    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
  }

  // Prioritize Flash models confirmed working with 200 OK on user's API key
  const initialCandidates: Array<{ apiVersion: 'v1' | 'v1beta'; model: string }> = model
    ? [{ apiVersion: 'v1beta', model }, { apiVersion: 'v1', model }]
    : [
        { apiVersion: 'v1beta', model: 'gemini-flash-lite-latest' },
        { apiVersion: 'v1beta', model: 'gemini-3.5-flash' },
        { apiVersion: 'v1beta', model: 'gemini-3.1-flash-lite' },
        { apiVersion: 'v1beta', model: 'gemini-2.0-flash-lite' },
        { apiVersion: 'v1beta', model: 'gemini-flash-latest' },
        { apiVersion: 'v1beta', model: 'gemini-1.5-flash' },
      ]

  let response: Response | null = null

  for (const candidate of initialCandidates) {
    try {
      let res = await tryModel(candidate.apiVersion, candidate.model, true)
      
      // If 400 mentions systemInstruction not supported, retry without systemInstruction
      if (res.status === 400) {
        const cloned = res.clone()
        try {
          const errBody = await cloned.text()
          if (errBody.includes('system_instruction') || errBody.includes('systemInstruction')) {
            res = await tryModel(candidate.apiVersion, candidate.model, false)
          }
        } catch {
          // keep original res
        }
      }

      if (res.ok) {
        response = res
        break
      }

      // If 429 quota error has limit: 0, this specific model has no free tier quota -> continue to next candidate!
      if (res.status === 429) {
        const cloned = res.clone()
        try {
          const errBody = await cloned.text()
          if (errBody.includes('limit: 0')) {
            response = res
            continue
          }
        } catch {
          // keep original res
        }
        response = res
        break
      }

      // If 401 (invalid key), do not try other models — fail fast
      if (res.status === 401 || res.status === 403) {
        response = res
        break
      }

      response = res
    } catch {
      // try next candidate
    }
  }

  // If all initial models failed with 404 or limit: 0, dynamically discover supported flash models via ListModels
  if (!response || response.status === 404 || (response.status === 429 && response.statusText !== 'OK')) {
    const isZeroLimit = response ? await (async () => {
      try { return (await response!.clone().text()).includes('limit: 0') } catch { return false }
    })() : true

    if (isZeroLimit) {
      const discovered = await findAvailableModel(apiKey)
      if (discovered) {
        try {
          const res = await tryModel(discovered.apiVersion, discovered.modelName, true)
          if (res.ok) {
            response = res
          }
        } catch {
          // handled below
        }
      }
    }
  }

  if (!response) {
    throw new GeminiApiError('Could not connect to Gemini API', 'PROVIDER_ERROR', 502)
  }

  if (!response.ok) {
    let errorDetail = ''
    try {
      const errJson = (await response.json()) as { error?: { message?: string } }
      errorDetail = errJson?.error?.message || ''
    } catch {
      // response body might not be json
    }

    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new GeminiApiError(
        errorDetail || 'Invalid API key or unauthorized access to Gemini',
        'INVALID_KEY',
        400
      )
    } else if (response.status === 429) {
      throw new GeminiApiError(
        errorDetail || 'Gemini API quota exceeded. Please check your usage limits.',
        'QUOTA_EXCEEDED',
        429
      )
    } else if (response.status >= 500) {
      throw new GeminiApiError(
        errorDetail || 'Gemini provider server error',
        'PROVIDER_ERROR',
        502
      )
    } else {
      throw new GeminiApiError(
        errorDetail || `Gemini API returned error status ${response.status}`,
        'PROVIDER_ERROR',
        response.status
      )
    }
  }

  interface GeminiResponse {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string
        }>
      }
    }>
  }

  let data: GeminiResponse
  try {
    data = (await response.json()) as GeminiResponse
  } catch {
    throw new GeminiApiError('Failed to parse Gemini response as JSON', 'PROVIDER_ERROR', 502)
  }

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!rawText) {
    throw new GeminiApiError('Gemini returned an empty response', 'PROVIDER_ERROR', 502)
  }

  try {
    return JSON.parse(rawText)
  } catch {
    throw new GeminiApiError('Gemini response was not valid JSON', 'PROVIDER_ERROR', 502)
  }
}

export async function callGemini(apiKey: string, prompt: string, model?: string): Promise<ParsedWorkout> {
  const raw = await callGeminiRaw(apiKey, prompt, GEMINI_SYSTEM_PROMPT, model)
  try {
    return validateParsedWorkout(raw)
  } catch (valErr: unknown) {
    const message = valErr instanceof Error ? valErr.message : 'Schema validation failed'
    throw new GeminiApiError(`AI response failed schema validation: ${message}`, 'PROVIDER_ERROR', 502)
  }
}

export async function callGeminiMeal(apiKey: string, prompt: string, model?: string): Promise<ParsedMeal> {
  const raw = await callGeminiRaw(apiKey, prompt, GEMINI_MEAL_SYSTEM_PROMPT, model)
  try {
    return validateParsedMeal(raw)
  } catch (valErr: unknown) {
    const message = valErr instanceof Error ? valErr.message : 'Schema validation failed'
    throw new GeminiApiError(`AI response failed schema validation: ${message}`, 'PROVIDER_ERROR', 502)
  }
}
