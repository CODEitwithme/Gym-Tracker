import type { GymTrackerDatabase } from '../database'
import { db } from '../database'
import { createTimestamp, createUUID } from '../../lib/dateTime'
import { assertNonBlank } from '../../lib/validation'
import type { MonthlyCalorieTarget, SyncMetadata, UUID } from '../../types/records'

export type SaveMonthlyCalorieTargetInput = Omit<MonthlyCalorieTarget, keyof SyncMetadata> & {
  id?: UUID
}

function validateMonthKey(monthKey: string): void {
  assertNonBlank(monthKey, 'Month key')
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) {
    throw new Error('Month key must be in YYYY-MM format.')
  }
}

export async function getMonthlyCalorieTarget(
  monthKey: string,
  database: GymTrackerDatabase = db,
): Promise<MonthlyCalorieTarget | undefined> {
  validateMonthKey(monthKey)
  return await database.monthlyCalorieTargets
    .where('monthKey')
    .equals(monthKey)
    .filter((item) => item.deletedAt === null)
    .first()
}

export async function saveMonthlyCalorieTarget(
  input: SaveMonthlyCalorieTargetInput,
  database: GymTrackerDatabase = db,
): Promise<MonthlyCalorieTarget> {
  validateMonthKey(input.monthKey)
  if (!Number.isFinite(input.targetCalories) || input.targetCalories <= 0) {
    throw new Error('Target calories must be a positive number.')
  }

  return await database.transaction('rw', database.monthlyCalorieTargets, async () => {
    const existing = await database.monthlyCalorieTargets
      .where('monthKey')
      .equals(input.monthKey)
      .filter((item) => item.deletedAt === null)
      .first()

    const now = createTimestamp()
    if (existing) {
      const updated: MonthlyCalorieTarget = {
        ...existing,
        targetCalories: Math.round(input.targetCalories),
        targetProteinG: input.targetProteinG !== undefined ? Math.round(input.targetProteinG) : existing.targetProteinG,
        targetCarbsG: input.targetCarbsG !== undefined ? Math.round(input.targetCarbsG) : existing.targetCarbsG,
        targetFatG: input.targetFatG !== undefined ? Math.round(input.targetFatG) : existing.targetFatG,
        phase: input.phase ?? existing.phase,
        tdeeEstimate: input.tdeeEstimate !== undefined ? Math.round(input.tdeeEstimate) : existing.tdeeEstimate,
        updatedAt: now,
      }
      await database.monthlyCalorieTargets.put(updated)
      return updated
    }

    const newTarget: MonthlyCalorieTarget = {
      id: input.id ?? createUUID(),
      monthKey: input.monthKey,
      targetCalories: Math.round(input.targetCalories),
      targetProteinG: input.targetProteinG !== undefined ? Math.round(input.targetProteinG) : undefined,
      targetCarbsG: input.targetCarbsG !== undefined ? Math.round(input.targetCarbsG) : undefined,
      targetFatG: input.targetFatG !== undefined ? Math.round(input.targetFatG) : undefined,
      phase: input.phase,
      tdeeEstimate: input.tdeeEstimate !== undefined ? Math.round(input.tdeeEstimate) : undefined,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }
    await database.monthlyCalorieTargets.add(newTarget)
    return newTarget
  })
}

export async function listMonthlyCalorieTargets(
  database: GymTrackerDatabase = db,
): Promise<MonthlyCalorieTarget[]> {
  const all = await database.monthlyCalorieTargets
    .filter((item) => item.deletedAt === null)
    .toArray()
  return all.sort((a, b) => a.monthKey.localeCompare(b.monthKey))
}

export async function softDeleteMonthlyCalorieTarget(
  id: string,
  database: GymTrackerDatabase = db,
): Promise<MonthlyCalorieTarget> {
  assertNonBlank(id, 'Target ID')
  return await database.transaction('rw', database.monthlyCalorieTargets, async () => {
    const existing = await database.monthlyCalorieTargets.get(id)
    if (!existing || existing.deletedAt !== null) {
      throw new Error(`Monthly calorie target "${id}" was not found.`)
    }
    const updated: MonthlyCalorieTarget = {
      ...existing,
      updatedAt: createTimestamp(),
      deletedAt: createTimestamp(),
    }
    await database.monthlyCalorieTargets.put(updated)
    return updated
  })
}
