import { assertFiniteNonNegative } from './validation'

const POUNDS_PER_KILOGRAM = 2.20462262185

export function kilogramsToPounds(kilograms: number): number {
  assertFiniteNonNegative(kilograms, 'Weight in kilograms')
  const pounds = kilograms * POUNDS_PER_KILOGRAM
  assertFiniteNonNegative(pounds, 'Converted weight in pounds')
  return pounds
}

export function poundsToKilograms(pounds: number): number {
  assertFiniteNonNegative(pounds, 'Weight in pounds')
  const kilograms = pounds / POUNDS_PER_KILOGRAM
  assertFiniteNonNegative(kilograms, 'Converted weight in kilograms')
  return kilograms
}
