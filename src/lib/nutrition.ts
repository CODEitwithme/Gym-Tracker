import type { NutritionValues } from '../types/records'
import type { CalorieSource } from '../features/nutrition/types'
import { assertFiniteNonNegative } from './validation'

export function estimateCaloriesFromMacros(
  nutrition: Pick<NutritionValues, 'proteinG' | 'carbsG' | 'fatG'>,
): number {
  assertFiniteNonNegative(nutrition.proteinG, 'Protein')
  assertFiniteNonNegative(nutrition.carbsG, 'Carbohydrates')
  assertFiniteNonNegative(nutrition.fatG, 'Fat')
  const calories =
    4 * nutrition.proteinG + 4 * nutrition.carbsG + 9 * nutrition.fatG
  assertFiniteNonNegative(calories, 'Estimated calories')
  return calories
}

export function resolveCalories(
  calorieSource: CalorieSource,
  nutrition: NutritionValues,
): number {
  if (calorieSource === 'macro_estimate') {
    return estimateCaloriesFromMacros(nutrition)
  }
  assertFiniteNonNegative(nutrition.calories, 'Calories')
  return nutrition.calories
}

export function scaleNutrition(
  nutrition: NutritionValues,
  portionPercent: number,
): NutritionValues {
  assertFiniteNonNegative(nutrition.calories, 'Calories')
  assertFiniteNonNegative(nutrition.proteinG, 'Protein')
  assertFiniteNonNegative(nutrition.carbsG, 'Carbohydrates')
  assertFiniteNonNegative(nutrition.fatG, 'Fat')
  if (!Number.isFinite(portionPercent) || portionPercent <= 0) {
    throw new Error('Portion percentage must be a finite number greater than zero.')
  }
  const factor = portionPercent / 100
  const scaled = {
    calories: nutrition.calories * factor,
    proteinG: nutrition.proteinG * factor,
    carbsG: nutrition.carbsG * factor,
    fatG: nutrition.fatG * factor,
  }
  assertFiniteNonNegative(scaled.calories, 'Scaled calories')
  assertFiniteNonNegative(scaled.proteinG, 'Scaled protein')
  assertFiniteNonNegative(scaled.carbsG, 'Scaled carbohydrates')
  assertFiniteNonNegative(scaled.fatG, 'Scaled fat')
  return scaled
}

export function roundCalories(value: number): number {
  return Math.round(value)
}

export function roundMacro(value: number): number {
  return Math.round(value * 10) / 10
}

export function sumNutritionValues(
  items: readonly NutritionValues[],
): NutritionValues {
  let calories = 0
  let proteinG = 0
  let carbsG = 0
  let fatG = 0

  for (const item of items) {
    calories += item.calories
    proteinG += item.proteinG
    carbsG += item.carbsG
    fatG += item.fatG
  }

  return {
    calories: roundCalories(calories),
    proteinG: roundMacro(proteinG),
    carbsG: roundMacro(carbsG),
    fatG: roundMacro(fatG),
  }
}

