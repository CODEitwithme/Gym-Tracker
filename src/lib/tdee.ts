export type BiologicalSex = 'male' | 'female'

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'very_active'
  | 'athlete'

export type CalorieGoalType =
  | 'cut_aggressive'
  | 'cut_moderate'
  | 'maintain'
  | 'bulk_clean'
  | 'bulk_aggressive'

export interface TdeeInput {
  age: number
  sex: BiologicalSex
  weightKg: number
  heightCm: number
  activityLevel: ActivityLevel
  goalType: CalorieGoalType
}

export interface MacroSplit {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

export interface TdeeResult {
  bmr: number
  tdee: number
  targetCalories: number
  calorieDelta: number
  macros: MacroSplit
  phase: 'cut' | 'maintain' | 'bulk'
}

export const ACTIVITY_INFO: Record<
  ActivityLevel,
  { label: string; multiplier: number; description: string }
> = {
  sedentary: {
    label: 'Sedentary',
    multiplier: 1.2,
    description: 'Desk job, little to no structured workout, <5,000 steps/day',
  },
  light: {
    label: 'Lightly Active',
    multiplier: 1.375,
    description: 'Light exercise 1-3 days/week or 6,000-8,000 steps/day',
  },
  moderate: {
    label: 'Moderately Active',
    multiplier: 1.55,
    description: 'Moderate training 3-5 days/week or 8,000-11,000 steps/day',
  },
  very_active: {
    label: 'Very Active',
    multiplier: 1.725,
    description: 'Hard training 6-7 days/week or heavy physical labor',
  },
  athlete: {
    label: 'Extremely Active / Athlete',
    multiplier: 1.9,
    description: 'Twice daily training or competitive sports training',
  },
}

export const GOAL_INFO: Record<
  CalorieGoalType,
  { label: string; delta: number; phase: 'cut' | 'maintain' | 'bulk'; description: string }
> = {
  cut_aggressive: {
    label: 'Standard Cut (-500 kcal)',
    delta: -500,
    phase: 'cut',
    description: 'Targets ~0.5 kg (1 lb) fat loss per week.',
  },
  cut_moderate: {
    label: 'Mild Cut (-250 kcal)',
    delta: -250,
    phase: 'cut',
    description: 'Slow, sustainable fat loss preserving maximum strength.',
  },
  maintain: {
    label: 'Maintenance (0 kcal)',
    delta: 0,
    phase: 'maintain',
    description: 'Maintain body weight while improving body composition.',
  },
  bulk_clean: {
    label: 'Lean Bulk (+250 kcal)',
    delta: 250,
    phase: 'bulk',
    description: 'Build muscle with minimal body fat accumulation.',
  },
  bulk_aggressive: {
    label: 'Aggressive Bulk (+500 kcal)',
    delta: 500,
    phase: 'bulk',
    description: 'Maximum muscle mass and strength progression.',
  },
}

/**
 * Calculates BMR using the Mifflin-St Jeor formula.
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: BiologicalSex,
): number {
  if (weightKg <= 0 || heightCm <= 0 || age <= 0) return 0
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return Math.round(sex === 'male' ? base + 5 : base - 161)
}

/**
 * Calculates TDEE (Total Daily Energy Expenditure / Maintenance Calories).
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  const multiplier = ACTIVITY_INFO[activityLevel].multiplier
  return Math.round(bmr * multiplier)
}

/**
 * Calculates macros based on bodyweight and target calories.
 * Uses 2.0g protein/kg for cuts/bulks (or 1.8 for maintenance),
 * 25% fat calories, and remainder carbs.
 */
export function calculateMacros(
  targetCalories: number,
  weightKg: number,
  goalType: CalorieGoalType,
): MacroSplit {
  const proteinMultiplier = goalType.startsWith('cut') ? 2.2 : goalType.startsWith('bulk') ? 2.0 : 1.8
  const proteinG = Math.round(weightKg * proteinMultiplier)
  const proteinCalories = proteinG * 4

  // 25% of target calories from fat (fat = 9 kcal/g)
  const fatCalories = Math.round(targetCalories * 0.25)
  const fatG = Math.round(fatCalories / 9)

  // Remaining calories from carbohydrates (carbs = 4 kcal/g)
  const remainingCalories = Math.max(0, targetCalories - proteinCalories - fatCalories)
  const carbsG = Math.round(remainingCalories / 4)

  return {
    calories: targetCalories,
    proteinG,
    carbsG,
    fatG,
  }
}

/**
 * Full calculation pipeline from user metrics to target calories and macros.
 */
export function calculateCompleteTdee(input: TdeeInput): TdeeResult {
  const bmr = calculateBMR(input.weightKg, input.heightCm, input.age, input.sex)
  const tdee = calculateTDEE(bmr, input.activityLevel)
  const goalConfig = GOAL_INFO[input.goalType]
  const targetCalories = Math.max(1000, tdee + goalConfig.delta)
  const macros = calculateMacros(targetCalories, input.weightKg, input.goalType)

  return {
    bmr,
    tdee,
    targetCalories,
    calorieDelta: goalConfig.delta,
    macros,
    phase: goalConfig.phase,
  }
}

export function feetInchesToCm(feet: number, inches: number): number {
  const totalInches = feet * 12 + inches
  return Math.round(totalInches * 2.54)
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches % 12)
  return { feet, inches }
}
