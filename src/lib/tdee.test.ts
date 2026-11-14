import { describe, expect, it } from 'vitest'
import {
  calculateBMR,
  calculateCompleteTdee,
  calculateMacros,
  calculateTDEE,
  cmToFeetInches,
  feetInchesToCm,
} from './tdee'

describe('TDEE & BMR calculations', () => {
  it('calculates BMR accurately for males and females using Mifflin-St Jeor', () => {
    // Male: 25yo, 75kg, 180cm
    // 10*75 + 6.25*180 - 5*25 + 5 = 750 + 1125 - 125 + 5 = 1755
    const bmrMale = calculateBMR(75, 180, 25, 'male')
    expect(bmrMale).toBe(1755)

    // Female: 28yo, 60kg, 165cm
    // 10*60 + 6.25*165 - 5*28 - 161 = 600 + 1031.25 - 140 - 161 = 1330.25 -> 1330
    const bmrFemale = calculateBMR(60, 165, 28, 'female')
    expect(bmrFemale).toBe(1330)
  })

  it('calculates TDEE with correct activity multipliers', () => {
    const bmr = 1755
    expect(calculateTDEE(bmr, 'sedentary')).toBe(Math.round(1755 * 1.2))
    expect(calculateTDEE(bmr, 'moderate')).toBe(Math.round(1755 * 1.55))
    expect(calculateTDEE(bmr, 'very_active')).toBe(Math.round(1755 * 1.725))
  })

  it('calculates macros based on bodyweight and target calories', () => {
    const macros = calculateMacros(2200, 75, 'cut_moderate')
    expect(macros.proteinG).toBe(Math.round(75 * 2.2)) // 165g
    expect(macros.fatG).toBe(Math.round((2200 * 0.25) / 9)) // 61g
    expect(macros.carbsG).toBeGreaterThan(150)
  })

  it('computes complete TDEE pipeline', () => {
    const result = calculateCompleteTdee({
      age: 26,
      sex: 'male',
      weightKg: 78,
      heightCm: 178,
      activityLevel: 'moderate',
      goalType: 'cut_moderate',
    })

    expect(result.bmr).toBeGreaterThan(1600)
    expect(result.tdee).toBeGreaterThan(result.bmr)
    expect(result.targetCalories).toBe(result.tdee - 250)
    expect(result.phase).toBe('cut')
    expect(result.macros.proteinG).toBeGreaterThan(150)
  })

  it('converts height between cm and feet/inches', () => {
    expect(feetInchesToCm(5, 10)).toBe(178)
    const converted = cmToFeetInches(178)
    expect(converted.feet).toBe(5)
    expect(converted.inches).toBe(10)
  })
})
