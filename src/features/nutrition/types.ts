import type { NutritionValues, SyncMetadata } from '../../types/records'

export type CalorieSource = 'manual' | 'macro_estimate'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface SavedMeal extends SyncMetadata, NutritionValues {
  name: string
  servingDescription: string
  calorieSource: CalorieSource
}

export interface MealLog extends SyncMetadata {
  savedMealId: string
  mealNameSnapshot: string
  consumedAt: string
  localDate: string
  mealType: MealType
  portionPercent: number
  nutritionSnapshot: NutritionValues
}

export interface DailyNutritionTotals {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

export interface MealSectionData {
  mealType: MealType
  title: string
  logs: MealLog[]
  totals: DailyNutritionTotals
}

export interface DailyNutritionSummary {
  localDate: string
  logs: MealLog[]
  totals: DailyNutritionTotals
  sections: Record<MealType, MealSectionData>
}

export interface DailyNutritionGoals {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}
