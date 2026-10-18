import type { GymTrackerDatabase } from '../../db/database'
import { db } from '../../db/database'
import {
  createMealLog,
  createSavedMeal,
  getSavedMeal,
  listMealLogsForDate,
  listSavedMeals,
  searchSavedMeals,
  softDeleteMealLog,
  softDeleteSavedMeal,
  updateMealLog,
  updateSavedMeal,
  type CreateMealLogInput,
  type CreateSavedMealInput,
  type MealLogChanges,
  type SavedMealChanges,
} from '../../db/repositories/nutrition'
import { formatLocalDate } from '../../lib/dateTime'
import { sumNutritionValues } from '../../lib/nutrition'
import type {
  DailyNutritionGoals,
  DailyNutritionSummary,
  DailyNutritionTotals,
  MealLog,
  MealSectionData,
  MealType,
  SavedMeal,
} from './types'

export const MEAL_TYPES: readonly MealType[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
]

export const MEAL_TITLES: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
}

const NUTRITION_GOALS_STORAGE_KEY = 'gym-tracker-nutrition-goals'

export async function loadDailyNutrition(
  localDate: string,
  database: GymTrackerDatabase = db,
): Promise<DailyNutritionSummary> {
  const logs = await listMealLogsForDate(localDate, database)

  const emptyTotals: DailyNutritionTotals = {
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
  }

  const sections = MEAL_TYPES.reduce(
    (acc, mealType) => {
      const sectionLogs = logs.filter((log) => log.mealType === mealType)
      acc[mealType] = {
        mealType,
        title: MEAL_TITLES[mealType],
        logs: sectionLogs,
        totals: sectionLogs.length
          ? (sumNutritionValues(
              sectionLogs.map((log) => log.nutritionSnapshot),
            ) as DailyNutritionTotals)
          : { ...emptyTotals },
      }
      return acc
    },
    {} as Record<MealType, MealSectionData>,
  )

  const totals: DailyNutritionTotals = logs.length
    ? (sumNutritionValues(
        logs.map((log) => log.nutritionSnapshot),
      ) as DailyNutritionTotals)
    : { ...emptyTotals }

  return {
    localDate,
    logs,
    totals,
    sections,
  }
}

export async function loadTodayTotals(
  database: GymTrackerDatabase = db,
): Promise<DailyNutritionTotals> {
  const today = formatLocalDate(new Date())
  const summary = await loadDailyNutrition(today, database)
  return summary.totals
}

export async function logMeal(
  input: CreateMealLogInput,
  database: GymTrackerDatabase = db,
): Promise<MealLog> {
  return createMealLog(input, database)
}

export async function editMealLog(
  id: string,
  changes: MealLogChanges,
  database: GymTrackerDatabase = db,
): Promise<MealLog> {
  return updateMealLog(id, changes, database)
}

export async function removeMealLog(
  id: string,
  database: GymTrackerDatabase = db,
): Promise<MealLog> {
  return softDeleteMealLog(id, database)
}

export async function fetchSavedMeals(
  query = '',
  database: GymTrackerDatabase = db,
): Promise<SavedMeal[]> {
  const trimmed = query.trim()
  return trimmed
    ? searchSavedMeals(trimmed, database)
    : listSavedMeals(database)
}

export async function fetchSavedMeal(
  id: string,
  database: GymTrackerDatabase = db,
): Promise<SavedMeal | undefined> {
  return getSavedMeal(id, database)
}

export async function createMeal(
  input: CreateSavedMealInput,
  database: GymTrackerDatabase = db,
): Promise<SavedMeal> {
  return createSavedMeal(input, database)
}

export async function editSavedMeal(
  id: string,
  changes: SavedMealChanges,
  database: GymTrackerDatabase = db,
): Promise<SavedMeal> {
  return updateSavedMeal(id, changes, database)
}

export async function removeSavedMeal(
  id: string,
  database: GymTrackerDatabase = db,
): Promise<SavedMeal> {
  return softDeleteSavedMeal(id, database)
}

let memoryGoals: DailyNutritionGoals | null = null

export function getSavedNutritionGoals(): DailyNutritionGoals | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(NUTRITION_GOALS_STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<DailyNutritionGoals>
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        Number.isFinite(parsed.calories) &&
        (parsed.calories ?? 0) >= 0 &&
        Number.isFinite(parsed.proteinG) &&
        (parsed.proteinG ?? 0) >= 0 &&
        Number.isFinite(parsed.carbsG) &&
        (parsed.carbsG ?? 0) >= 0 &&
        Number.isFinite(parsed.fatG) &&
        (parsed.fatG ?? 0) >= 0
      ) {
        return {
          calories: Math.round(parsed.calories ?? 0),
          proteinG: Math.round(parsed.proteinG ?? 0),
          carbsG: Math.round(parsed.carbsG ?? 0),
          fatG: Math.round(parsed.fatG ?? 0),
        }
      }
      return null
    } catch {
      return null
    }
  }
  return memoryGoals
}

export function saveNutritionGoals(goals: DailyNutritionGoals): void {
  const normalized: DailyNutritionGoals = {
    calories: Math.max(0, Math.round(goals.calories)),
    proteinG: Math.max(0, Math.round(goals.proteinG)),
    carbsG: Math.max(0, Math.round(goals.carbsG)),
    fatG: Math.max(0, Math.round(goals.fatG)),
  }
  memoryGoals = normalized
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(
        NUTRITION_GOALS_STORAGE_KEY,
        JSON.stringify(normalized),
      )
    } catch {
      // Ignore quota errors
    }
  }
}
