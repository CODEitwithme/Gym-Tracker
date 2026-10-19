import type {
  CalorieSource,
  MealLog,
  MealType,
  SavedMeal,
} from '../../features/nutrition/types'
import {
  createTimestamp,
  createUUID,
  formatLocalDate,
} from '../../lib/dateTime'
import { resolveCalories, scaleNutrition } from '../../lib/nutrition'
import {
  assertFiniteNonNegative,
  assertIsoDateTime,
  assertLocalDate,
  assertNonBlank,
} from '../../lib/validation'
import type { UUID } from '../../types/records'
import { db } from '../database'
import type { GymTrackerDatabase } from '../database'

type MealMacros = Pick<SavedMeal, 'proteinG' | 'carbsG' | 'fatG'>

export type CreateSavedMealInput = {
  name: string
  servingDescription: string
  calorieSource: CalorieSource
  id?: UUID
} & MealMacros &
  (
    | { calorieSource: 'manual'; calories: number }
    | { calorieSource: 'macro_estimate'; calories?: number }
  )

export type SavedMealChanges = Partial<
  Pick<
    SavedMeal,
    | 'name'
    | 'servingDescription'
    | 'calories'
    | 'proteinG'
    | 'carbsG'
    | 'fatG'
    | 'calorieSource'
  >
>

export interface CreateMealLogInput {
  savedMealId: string
  consumedAt: string
  mealType: MealType
  portionPercent: number
  id?: UUID
}

export type MealLogChanges = Partial<
  Pick<MealLog, 'savedMealId' | 'consumedAt' | 'mealType' | 'portionPercent'>
>

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

function validateSavedMeal(meal: Omit<SavedMeal, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): void {
  assertNonBlank(meal.name, 'Saved meal name')
  assertNonBlank(meal.servingDescription, 'Serving description')
  assertFiniteNonNegative(meal.calories, 'Calories')
  assertFiniteNonNegative(meal.proteinG, 'Protein')
  assertFiniteNonNegative(meal.carbsG, 'Carbohydrates')
  assertFiniteNonNegative(meal.fatG, 'Fat')
  if (!['manual', 'macro_estimate'].includes(meal.calorieSource)) {
    throw new Error('Calorie source must be manual or macro_estimate.')
  }
}

function validateMealLog(input: CreateMealLogInput): void {
  assertIsoDateTime(input.consumedAt, 'consumedAt')
  if (!mealTypes.includes(input.mealType)) {
    throw new Error('Meal type must be breakfast, lunch, dinner, or snack.')
  }
  if (!Number.isFinite(input.portionPercent) || input.portionPercent <= 0) {
    throw new Error('Portion percentage must be a finite number greater than zero.')
  }
  if (typeof input.savedMealId !== 'string' || input.savedMealId.length === 0) {
    throw new Error('A saved meal ID is required.')
  }
}

function savedMealValues(input: CreateSavedMealInput): Omit<
  SavedMeal,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
> {
  const name = input.name.trim()
  const servingDescription = input.servingDescription.trim()
  const calories =
    input.calorieSource === 'manual'
      ? input.calories
      : resolveCalories('macro_estimate', {
          calories: 0,
          proteinG: input.proteinG,
          carbsG: input.carbsG,
          fatG: input.fatG,
        })
  const values = { ...input, name, servingDescription, calories }
  validateSavedMeal(values)
  return values
}

export async function createSavedMeal(
  input: CreateSavedMealInput,
  database: GymTrackerDatabase = db,
): Promise<SavedMeal> {
  const now = createTimestamp()
  const meal: SavedMeal = {
    ...savedMealValues(input),
    id: input.id ?? createUUID(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  await database.savedMeals.add(meal)
  return meal
}

export async function getSavedMeal(
  id: string,
  database: GymTrackerDatabase = db,
): Promise<SavedMeal | undefined> {
  return database.savedMeals.get(id)
}

export async function listSavedMeals(
  database: GymTrackerDatabase = db,
): Promise<SavedMeal[]> {
  const meals = await database.savedMeals
    .filter((meal) => meal.deletedAt === null)
    .toArray()
  return meals.sort((left, right) => left.name.localeCompare(right.name))
}

export async function searchSavedMeals(
  query: string,
  database: GymTrackerDatabase = db,
): Promise<SavedMeal[]> {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  return database.savedMeals
    .filter(
      (meal) =>
        meal.deletedAt === null &&
        meal.name.toLocaleLowerCase().includes(normalizedQuery),
    )
    .toArray()
}

export async function updateSavedMeal(
  id: string,
  changes: SavedMealChanges,
  database: GymTrackerDatabase = db,
): Promise<SavedMeal> {
  return database.transaction('rw', database.savedMeals, async () => {
    const existing = await database.savedMeals.get(id)
    if (!existing || existing.deletedAt !== null) {
      throw new Error(`Active saved meal "${id}" was not found.`)
    }
    const normalizedChanges = { ...changes }
    if (changes.name !== undefined) {
      normalizedChanges.name = changes.name.trim()
    }
    if (changes.servingDescription !== undefined) {
      normalizedChanges.servingDescription = changes.servingDescription.trim()
    }
    const merged = { ...existing, ...normalizedChanges, updatedAt: createTimestamp() }
    const calories = resolveCalories(merged.calorieSource, merged)
    const updated = { ...merged, calories }
    validateSavedMeal(updated)
    await database.savedMeals.put(updated)
    return updated
  })
}

export async function softDeleteSavedMeal(
  id: string,
  database: GymTrackerDatabase = db,
): Promise<SavedMeal> {
  return database.transaction('rw', database.savedMeals, async () => {
    const existing = await database.savedMeals.get(id)
    if (!existing || existing.deletedAt !== null) {
      throw new Error(`Active saved meal "${id}" was not found.`)
    }
    const now = createTimestamp()
    const deleted = { ...existing, updatedAt: now, deletedAt: now }
    await database.savedMeals.put(deleted)
    return deleted
  })
}

export async function createMealLog(
  input: CreateMealLogInput,
  database: GymTrackerDatabase = db,
): Promise<MealLog> {
  validateMealLog(input)
  return database.transaction(
    'rw',
    [database.savedMeals, database.mealLogs],
    async () => {
      const savedMeal = await database.savedMeals.get(input.savedMealId)
      if (!savedMeal || savedMeal.deletedAt !== null) {
        throw new Error(`Active saved meal "${input.savedMealId}" was not found.`)
      }
      const now = createTimestamp()
      const nutritionSnapshot = scaleNutrition(
        {
          calories: savedMeal.calories,
          proteinG: savedMeal.proteinG,
          carbsG: savedMeal.carbsG,
          fatG: savedMeal.fatG,
        },
        input.portionPercent,
      )
      const mealLog: MealLog = {
        ...input,
        id: input.id ?? createUUID(),
        mealNameSnapshot: savedMeal.name,
        localDate: formatLocalDate(new Date(input.consumedAt)),
        nutritionSnapshot,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      await database.mealLogs.add(mealLog)
      return mealLog
    },
  )
}

export async function listMealLogsForDate(
  localDate: string,
  database: GymTrackerDatabase = db,
): Promise<MealLog[]> {
  assertLocalDate(localDate)
  const logs = await database.mealLogs
    .where('localDate')
    .equals(localDate)
    .filter((log) => log.deletedAt === null)
    .toArray()
  return logs.sort(
    (left, right) => Date.parse(left.consumedAt) - Date.parse(right.consumedAt),
  )
}

export async function updateMealLog(
  id: string,
  changes: MealLogChanges,
  database: GymTrackerDatabase = db,
): Promise<MealLog> {
  return database.transaction(
    'rw',
    [database.savedMeals, database.mealLogs],
    async () => {
      const existing = await database.mealLogs.get(id)
      if (!existing || existing.deletedAt !== null) {
        throw new Error(`Active meal log "${id}" was not found.`)
      }
      const updated = {
        ...existing,
        ...changes,
        updatedAt: createTimestamp(),
      }
      validateMealLog(updated)
      if (changes.consumedAt !== undefined) {
        updated.localDate = formatLocalDate(new Date(updated.consumedAt))
      }
      if (changes.savedMealId !== undefined && changes.savedMealId !== existing.savedMealId) {
        const savedMeal = await database.savedMeals.get(changes.savedMealId)
        if (!savedMeal || savedMeal.deletedAt !== null) {
          throw new Error(`Active saved meal "${changes.savedMealId}" was not found.`)
        }
        updated.mealNameSnapshot = savedMeal.name
        updated.nutritionSnapshot = scaleNutrition(
          {
            calories: savedMeal.calories,
            proteinG: savedMeal.proteinG,
            carbsG: savedMeal.carbsG,
            fatG: savedMeal.fatG,
          },
          updated.portionPercent,
        )
      } else if (changes.portionPercent !== undefined) {
        const priorFactor = existing.portionPercent / 100
        const perServing = {
          calories: existing.nutritionSnapshot.calories / priorFactor,
          proteinG: existing.nutritionSnapshot.proteinG / priorFactor,
          carbsG: existing.nutritionSnapshot.carbsG / priorFactor,
          fatG: existing.nutritionSnapshot.fatG / priorFactor,
        }
        updated.nutritionSnapshot = scaleNutrition(
          perServing,
          updated.portionPercent,
        )
      }
      await database.mealLogs.put(updated)
      return updated
    },
  )
}

export async function softDeleteMealLog(
  id: string,
  database: GymTrackerDatabase = db,
): Promise<MealLog> {
  return database.transaction('rw', database.mealLogs, async () => {
    const existing = await database.mealLogs.get(id)
    if (!existing || existing.deletedAt !== null) {
      throw new Error(`Active meal log "${id}" was not found.`)
    }
    const now = createTimestamp()
    const deleted = { ...existing, updatedAt: now, deletedAt: now }
    await database.mealLogs.put(deleted)
    return deleted
  })
}
