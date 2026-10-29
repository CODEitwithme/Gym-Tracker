import type { MealType, ParsedExerciseItem, ParsedMeal, ParsedMealItem, ParsedWorkout } from './types'

export const GEMINI_SYSTEM_PROMPT = `You are a workout data extraction assistant. Extract ALL exercises performed, along with any mentioned workout title (e.g. "Chest Day", "Legs", "Push"), workout date (e.g. "today", "yesterday"), and start/end times or duration (e.g. "5:30 to 6:45 PM", "1 hour") from the user's natural language message.
A message may contain ONE or MULTIPLE exercises (e.g. "Trained today 6 to 7:15 pm. Bench press 80kg 3x8, Incline DB press 24kg 3x10").

Return ONLY valid JSON matching this schema (no markdown, no explanation):
{
  "sessionName": string or null,
  "startTime": string or null,
  "endTime": string or null,
  "durationMinutes": positive integer or null,
  "workoutDate": string or null,
  "exercises": [
    {
      "exercise": string (exercise name, title-cased),
      "weight": number or null,
      "unit": "kg" or "lbs" or null,
      "reps": positive integer or null,
      "sets": positive integer or null,
      "durationSeconds": positive integer or null,
      "notes": string or null
    }
  ],
  "confidence": "high" if you could extract all key details, "low" if guessing,
  "followUpQuestion": string asking for missing essential details, or null if not needed
}

Rules:
1. Extract every distinct exercise mentioned. Do not omit any exercises.
2. If only one exercise is mentioned, return an array with that single exercise in "exercises".
3. Treat ambiguous info as null. Do not invent numbers.
4. Do not include any text outside the JSON.`

export const GEMINI_MEAL_SYSTEM_PROMPT = `You are a nutrition and meal data extraction assistant. Extract ALL food and meal items from the user's natural language message. A message may contain ONE or MULTIPLE food items under the SAME or DIFFERENT meal types (breakfast, lunch, dinner, snack).

For example:
- "Breakfast: 2 eggs and toast. Lunch: chicken and rice. Snack: protein shake." -> 3 items with their respective mealTypes.
- "For lunch I had a chicken sandwich, french fries, and a diet coke." -> 3 items with mealType "lunch".

Estimate realistic nutritional values (calories, protein, carbs, fat) for each item if exact numbers are not given.

Return ONLY valid JSON matching this schema (no markdown, no explanation):
{
  "meals": [
    {
      "mealName": string (e.g. "Scrambled Eggs with Toast", title-cased),
      "mealType": "breakfast" | "lunch" | "dinner" | "snack",
      "servingDescription": string (e.g. "2 eggs, 2 slices toast" or "200g"),
      "calories": non-negative integer (estimated kcal for this item),
      "proteinG": non-negative number (grams of protein),
      "carbsG": non-negative number (grams of carbohydrates),
      "fatG": non-negative number (grams of fat),
      "notes": string or null
    }
  ],
  "confidence": "high" if confident in estimation or numbers, "low" if guessing,
  "followUpQuestion": string asking for missing details if highly ambiguous, or null if not needed
}

Rules:
1. Extract each distinct food or meal item. Infer mealType ("breakfast", "lunch", "dinner", "snack") from the user's explicit mentions, food context, or time of day. Default to "snack" if completely unspecified.
2. calories, proteinG, carbsG, fatG must be realistic non-negative numbers for each item.
3. If only one food/meal is mentioned, return an array with that single item in "meals".
4. Do not invent unrealistic values. Do not include any text outside the JSON.`

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

function validateExerciseItem(r: unknown): ParsedExerciseItem {
  if (typeof r !== 'object' || r === null || Array.isArray(r)) {
    throw new Error('exercise item must be an object')
  }

  const item = r as Record<string, unknown>

  if (typeof item.exercise !== 'string' || item.exercise.trim().length === 0) {
    throw new Error('exercise must be a non-empty string')
  }

  let weight: number | null = null
  if (item.weight !== null && item.weight !== undefined) {
    if (typeof item.weight !== 'number' || isNaN(item.weight) || item.weight < 0) {
      throw new Error('weight must be a non-negative number or null')
    }
    weight = item.weight
  }

  let unit: 'kg' | 'lbs' | null = null
  if (item.unit !== null && item.unit !== undefined) {
    if (item.unit !== 'kg' && item.unit !== 'lbs') {
      throw new Error('unit must be "kg", "lbs", or null')
    }
    unit = item.unit
  }

  let reps: number | null = null
  if (item.reps !== null && item.reps !== undefined) {
    if (typeof item.reps !== 'number' || !Number.isInteger(item.reps) || item.reps <= 0) {
      throw new Error('reps must be a positive integer or null')
    }
    reps = item.reps
  }

  let sets: number | null = null
  if (item.sets !== null && item.sets !== undefined) {
    if (typeof item.sets !== 'number' || !Number.isInteger(item.sets) || item.sets <= 0) {
      throw new Error('sets must be a positive integer or null')
    }
    sets = item.sets
  }

  let durationSeconds: number | null = null
  if (item.durationSeconds !== null && item.durationSeconds !== undefined) {
    if (typeof item.durationSeconds !== 'number' || !Number.isInteger(item.durationSeconds) || item.durationSeconds <= 0) {
      throw new Error('durationSeconds must be a positive integer or null')
    }
    durationSeconds = item.durationSeconds
  }

  let notes: string | null = null
  if (item.notes !== null && item.notes !== undefined) {
    if (typeof item.notes !== 'string') {
      throw new Error('notes must be a string or null')
    }
    notes = item.notes
  }

  return {
    exercise: item.exercise.trim(),
    weight,
    unit,
    reps,
    sets,
    durationSeconds,
    notes,
  }
}

export function validateParsedWorkout(raw: unknown): ParsedWorkout {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Parsed workout must be an object')
  }

  const r = raw as Record<string, unknown>

  if (r.confidence !== 'high' && r.confidence !== 'low') {
    throw new Error('confidence must be "high" or "low"')
  }

  let exercises: ParsedExerciseItem[] = []

  if (Array.isArray(r.exercises)) {
    if (r.exercises.length === 0) {
      throw new Error('exercise must be a non-empty string')
    }
    exercises = r.exercises.map(validateExerciseItem)
  } else if (r.exercise !== undefined) {
    const single = validateExerciseItem(r)
    exercises = [single]
  } else {
    throw new Error('exercise must be a non-empty string')
  }

  let followUpQuestion: string | null = null
  if (r.followUpQuestion !== null && r.followUpQuestion !== undefined) {
    if (typeof r.followUpQuestion !== 'string') {
      throw new Error('followUpQuestion must be a string or null')
    }
    followUpQuestion = r.followUpQuestion
  }

  const primary = exercises[0]

  const result: ParsedWorkout = {
    exercises,
    exercise: primary.exercise,
    weight: primary.weight,
    unit: primary.unit,
    reps: primary.reps,
    sets: primary.sets,
    durationSeconds: primary.durationSeconds,
    notes: primary.notes,
    confidence: r.confidence,
    followUpQuestion,
  }

  if (typeof r.sessionName === 'string' && r.sessionName.trim()) {
    result.sessionName = r.sessionName.trim()
  }
  if (typeof r.startTime === 'string' && r.startTime.trim()) {
    result.startTime = r.startTime.trim()
  }
  if (typeof r.endTime === 'string' && r.endTime.trim()) {
    result.endTime = r.endTime.trim()
  }
  if (
    typeof r.durationMinutes === 'number' &&
    Number.isFinite(r.durationMinutes) &&
    r.durationMinutes > 0
  ) {
    result.durationMinutes = Math.round(r.durationMinutes)
  }
  if (typeof r.workoutDate === 'string' && r.workoutDate.trim()) {
    result.workoutDate = r.workoutDate.trim()
  }

  return result
}

function validateMealItem(r: unknown): ParsedMealItem {
  if (typeof r !== 'object' || r === null || Array.isArray(r)) {
    throw new Error('meal item must be an object')
  }

  const item = r as Record<string, unknown>

  if (typeof item.mealName !== 'string' || item.mealName.trim().length === 0) {
    throw new Error('mealName must be a non-empty string')
  }

  const validMealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
  let mealType: MealType = 'snack'
  if (typeof item.mealType === 'string' && validMealTypes.includes(item.mealType.toLowerCase() as MealType)) {
    mealType = item.mealType.toLowerCase() as MealType
  }

  const servingDescription =
    typeof item.servingDescription === 'string' && item.servingDescription.trim().length > 0
      ? item.servingDescription.trim()
      : '1 serving'

  const calories =
    typeof item.calories === 'number' && !isNaN(item.calories) && item.calories >= 0
      ? Math.round(item.calories)
      : 0

  const proteinG =
    typeof item.proteinG === 'number' && !isNaN(item.proteinG) && item.proteinG >= 0
      ? Math.round(item.proteinG * 10) / 10
      : 0

  const carbsG =
    typeof item.carbsG === 'number' && !isNaN(item.carbsG) && item.carbsG >= 0
      ? Math.round(item.carbsG * 10) / 10
      : 0

  const fatG =
    typeof item.fatG === 'number' && !isNaN(item.fatG) && item.fatG >= 0
      ? Math.round(item.fatG * 10) / 10
      : 0

  let notes: string | null = null
  if (item.notes !== null && item.notes !== undefined) {
    if (typeof item.notes !== 'string') {
      throw new Error('notes must be a string or null')
    }
    notes = item.notes
  }

  return {
    mealName: item.mealName.trim(),
    mealType,
    servingDescription,
    calories,
    proteinG,
    carbsG,
    fatG,
    notes,
  }
}

export function validateParsedMeal(raw: unknown): ParsedMeal {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Parsed meal must be an object')
  }

  const r = raw as Record<string, unknown>

  if (r.confidence !== 'high' && r.confidence !== 'low') {
    throw new Error('confidence must be "high" or "low"')
  }

  let meals: ParsedMealItem[] = []

  if (Array.isArray(r.meals)) {
    if (r.meals.length === 0) {
      throw new Error('mealName must be a non-empty string')
    }
    meals = r.meals.map(validateMealItem)
  } else if (r.mealName !== undefined) {
    const single = validateMealItem(r)
    meals = [single]
  } else {
    throw new Error('mealName must be a non-empty string')
  }

  let followUpQuestion: string | null = null
  if (r.followUpQuestion !== null && r.followUpQuestion !== undefined) {
    if (typeof r.followUpQuestion !== 'string') {
      throw new Error('followUpQuestion must be a string or null')
    }
    followUpQuestion = r.followUpQuestion
  }

  const primary = meals[0]
  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0)
  const totalProteinG = Math.round(meals.reduce((sum, m) => sum + m.proteinG, 0) * 10) / 10
  const totalCarbsG = Math.round(meals.reduce((sum, m) => sum + m.carbsG, 0) * 10) / 10
  const totalFatG = Math.round(meals.reduce((sum, m) => sum + m.fatG, 0) * 10) / 10

  return {
    meals,
    mealName: meals.length === 1 ? primary.mealName : `${meals.length} items logged`,
    mealType: primary.mealType,
    servingDescription: primary.servingDescription,
    calories: totalCalories,
    proteinG: totalProteinG,
    carbsG: totalCarbsG,
    fatG: totalFatG,
    notes: primary.notes,
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
        'gemini-3.1-flash-lite',
        'gemini-3-flash-preview',
        'gemini-flash-lite-latest',
        'gemini-flash-latest',
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash',
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

export const WORKOUT_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    sessionName: { type: 'STRING', nullable: true },
    startTime: { type: 'STRING', nullable: true },
    endTime: { type: 'STRING', nullable: true },
    durationMinutes: { type: 'INTEGER', nullable: true },
    workoutDate: { type: 'STRING', nullable: true },
    exercises: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          exercise: { type: 'STRING' },
          weight: { type: 'NUMBER', nullable: true },
          unit: { type: 'STRING', enum: ['kg', 'lbs'], nullable: true },
          reps: { type: 'INTEGER', nullable: true },
          sets: { type: 'INTEGER', nullable: true },
          durationSeconds: { type: 'INTEGER', nullable: true },
          notes: { type: 'STRING', nullable: true },
        },
        required: ['exercise'],
      },
    },
    confidence: { type: 'STRING', enum: ['high', 'low'] },
    followUpQuestion: { type: 'STRING', nullable: true },
  },
  required: ['exercises', 'confidence'],
}

export const MEAL_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    meals: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          mealName: { type: 'STRING' },
          mealType: { type: 'STRING', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
          servingDescription: { type: 'STRING' },
          calories: { type: 'NUMBER' },
          proteinG: { type: 'NUMBER' },
          carbsG: { type: 'NUMBER' },
          fatG: { type: 'NUMBER' },
          notes: { type: 'STRING', nullable: true },
        },
        required: ['mealName', 'mealType', 'calories', 'proteinG', 'carbsG', 'fatG'],
      },
    },
    confidence: { type: 'STRING', enum: ['high', 'low'] },
    followUpQuestion: { type: 'STRING', nullable: true },
  },
  required: ['meals', 'confidence'],
}

export async function callGeminiRaw(
  apiKey: string,
  prompt: string,
  systemPrompt: string,
  model?: string,
  schema?: Record<string, unknown>
): Promise<unknown> {
  const sanitizedPrompt = `<user_input>\n${prompt.slice(0, 2000).replace(/<\/user_input>/gi, '')}\n</user_input>`

  const tryModel = async (
    apiVersion: string,
    targetModel: string,
    useSystemInstruction = true,
    responseSchema?: Record<string, unknown>
  ): Promise<Response> => {
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey)}`

    const generationConfig: Record<string, unknown> = {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 4000,
    }

    const body: Record<string, unknown> = {
      contents: [
        {
          parts: [
            {
              text: useSystemInstruction
                ? sanitizedPrompt
                : `${systemPrompt}\n\nUser message:\n${sanitizedPrompt}`,
            },
          ],
        },
      ],
      generationConfig,
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
      signal: AbortSignal.timeout(10000),
    })
  }

  // Prioritize active, fast Gemini models (3-flash-preview, 3.1-flash-lite, etc.)
  const initialCandidates: Array<{ apiVersion: 'v1' | 'v1beta'; model: string }> = model
    ? [{ apiVersion: 'v1beta', model }, { apiVersion: 'v1', model }]
    : [
        { apiVersion: 'v1beta', model: 'gemini-3-flash-preview' },
        { apiVersion: 'v1beta', model: 'gemini-3.1-flash-lite' },
        { apiVersion: 'v1', model: 'gemini-3-flash-preview' },
        { apiVersion: 'v1', model: 'gemini-3.1-flash-lite' },
        { apiVersion: 'v1beta', model: 'gemini-2.0-flash' },
      ]

  let response: Response | null = null

  for (const candidate of initialCandidates) {
    try {
      let res = await tryModel(candidate.apiVersion, candidate.model, true, schema)

      // If 400 occurs, test if schema or systemInstruction caused the rejection
      if (res.status === 400) {
        const cloned = res.clone()
        try {
          const errBody = await cloned.text()
          if (errBody.includes('schema') || errBody.includes('response_schema')) {
            res = await tryModel(candidate.apiVersion, candidate.model, true, undefined)
          } else if (errBody.includes('system_instruction') || errBody.includes('systemInstruction')) {
            res = await tryModel(candidate.apiVersion, candidate.model, false, undefined)
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

  // If initial models failed with 404 or limit: 0, dynamically discover supported flash models via ListModels
  if (!response || response.status === 404 || (response.status === 429 && response.statusText !== 'OK')) {
    const isZeroLimit = response ? await (async () => {
      try { return (await response!.clone().text()).includes('limit: 0') } catch { return false }
    })() : true

    if (response?.status === 404 || isZeroLimit) {
      const discovered = await findAvailableModel(apiKey)
      if (discovered) {
        try {
          const res = await tryModel(discovered.apiVersion, discovered.modelName, true, schema)
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
          thought?: boolean
          thoughtSignature?: string
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

  const parts = data.candidates?.[0]?.content?.parts || []
  let rawText = ''
  for (const part of parts) {
    if (part.text && !part.thought && !part.thoughtSignature) {
      rawText = part.text
      break
    }
  }
  if (!rawText && parts.length > 0 && parts[0].text) {
    rawText = parts[0].text
  }

  if (!rawText) {
    throw new GeminiApiError('Gemini returned an empty response', 'PROVIDER_ERROR', 502)
  }

  let cleaned = rawText.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '')
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '')
  }
  cleaned = cleaned.trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    throw new GeminiApiError('Gemini response was not valid JSON', 'PROVIDER_ERROR', 502)
  }
}

export async function callGemini(apiKey: string, prompt: string, model?: string): Promise<ParsedWorkout> {
  const raw = await callGeminiRaw(apiKey, prompt, GEMINI_SYSTEM_PROMPT, model, WORKOUT_SCHEMA)
  try {
    return validateParsedWorkout(raw)
  } catch (valErr: unknown) {
    const message = valErr instanceof Error ? valErr.message : 'Schema validation failed'
    throw new GeminiApiError(`AI response failed schema validation: ${message}`, 'PROVIDER_ERROR', 502)
  }
}

export async function callGeminiMeal(apiKey: string, prompt: string, model?: string): Promise<ParsedMeal> {
  const raw = await callGeminiRaw(apiKey, prompt, GEMINI_MEAL_SYSTEM_PROMPT, model, MEAL_SCHEMA)
  try {
    return validateParsedMeal(raw)
  } catch (valErr: unknown) {
    const message = valErr instanceof Error ? valErr.message : 'Schema validation failed'
    throw new GeminiApiError(`AI response failed schema validation: ${message}`, 'PROVIDER_ERROR', 502)
  }
}
