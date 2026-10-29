export interface Env {
  CREDENTIAL_STORE: KVNamespace
  MASTER_ENCRYPTION_KEY: string // hex-encoded 32-byte AES-256 key
  ALLOWED_ORIGIN: string
}

export type AiProvider = 'gemini'

export interface StoredCredential {
  provider: AiProvider
  iv: string // hex
  tag: string // hex
  ciphertext: string // hex
  version?: number // 1 = legacy AES-GCM; 2 = HKDF per-tenant + AAD
  deviceToken?: string
}

export interface ParsedExerciseItem {
  exercise: string
  weight: number | null
  unit: 'kg' | 'lbs' | null
  reps: number | null
  sets: number | null
  durationSeconds: number | null
  notes: string | null
}

export interface ParsedWorkout {
  exercises: ParsedExerciseItem[]
  exercise: string
  weight: number | null
  unit: 'kg' | 'lbs' | null
  reps: number | null
  sets: number | null
  durationSeconds: number | null
  notes: string | null
  confidence: 'high' | 'low'
  followUpQuestion: string | null
  sessionName?: string | null
  startTime?: string | null
  endTime?: string | null
  durationMinutes?: number | null
  workoutDate?: string | null
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface ParsedMealItem {
  mealName: string
  mealType: MealType
  servingDescription: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  notes: string | null
}

export interface ParsedMeal {
  meals: ParsedMealItem[]
  mealName: string
  mealType: MealType
  servingDescription: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  notes: string | null
  confidence: 'high' | 'low'
  followUpQuestion: string | null
}

export interface ApiResponse<T> {
  ok: true
  data: T
}

export interface ApiError {
  ok: false
  error: string
  code: string
}
