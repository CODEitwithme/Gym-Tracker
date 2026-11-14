import type { GymTrackerDatabase } from '../../db/database'
import { db } from '../../db/database'
import { getMonthlyCalorieTarget } from '../../db/repositories/monthlyTargets'
import type { MonthlyCalorieTarget } from '../../types/records'

export interface DailyAdherenceDay {
  date: string // YYYY-MM-DD
  dayNumber: number
  dayOfWeek: number // 0-6
  calories: number
  status: 'on_track' | 'surplus' | 'deficit' | 'empty'
}

export interface MonthlyAdherenceSummary {
  monthKey: string // YYYY-MM
  target: MonthlyCalorieTarget | null
  targetCalories: number
  days: DailyAdherenceDay[]
  daysLoggedCount: number
  totalCaloriesLogged: number
  averageDailyCalories: number
  onTrackDaysCount: number
  adherencePercent: number
  netCalorieBalance: number // sum of (calories - maintenance/target)
  estimatedWeightChangeKg: number
}

export async function loadMonthlyAdherenceSummary(
  monthKey: string,
  fallbackTargetCalories = 2000,
  database: GymTrackerDatabase = db,
): Promise<MonthlyAdherenceSummary> {
  const [yearStr, monthStr] = monthKey.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)

  const startDate = `${monthKey}-01`
  // Get last day of month
  const daysInMonth = new Date(year, month, 0).getDate()
  const endDate = `${monthKey}-${String(daysInMonth).padStart(2, '0')}`

  // 1. Fetch monthly target from DB
  const target = (await getMonthlyCalorieTarget(monthKey, database)) ?? null
  const targetCalories = target?.targetCalories ?? fallbackTargetCalories
  const tdeeEstimate = target?.tdeeEstimate ?? targetCalories

  // 2. Fetch meal logs for this month
  const mealLogs = await database.mealLogs
    .where('localDate')
    .between(startDate, endDate, true, true)
    .filter((log) => log.deletedAt === null)
    .toArray()

  // Group by date
  const caloriesByDate = new Map<string, number>()
  for (const log of mealLogs) {
    const current = caloriesByDate.get(log.localDate) ?? 0
    caloriesByDate.set(log.localDate, current + log.nutritionSnapshot.calories)
  }

  // 3. Build array for each day of the month
  const days: DailyAdherenceDay[] = []
  let daysLoggedCount = 0
  let totalCaloriesLogged = 0
  let onTrackDaysCount = 0
  let netCalorieBalance = 0

  const tolerance = 100 // +/- 100 kcal is on track

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${monthKey}-${String(day).padStart(2, '0')}`
    const dateObj = new Date(year, month - 1, day)
    const dayOfWeek = dateObj.getDay()
    const cal = caloriesByDate.get(dateStr) ?? 0

    let status: DailyAdherenceDay['status'] = 'empty'
    if (cal > 0) {
      daysLoggedCount++
      totalCaloriesLogged += cal
      netCalorieBalance += cal - tdeeEstimate

      if (Math.abs(cal - targetCalories) <= tolerance) {
        status = 'on_track'
        onTrackDaysCount++
      } else if (cal > targetCalories + tolerance) {
        status = 'surplus'
      } else {
        status = 'deficit'
      }
    }

    days.push({
      date: dateStr,
      dayNumber: day,
      dayOfWeek,
      calories: Math.round(cal),
      status,
    })
  }

  const averageDailyCalories =
    daysLoggedCount > 0 ? Math.round(totalCaloriesLogged / daysLoggedCount) : 0

  const adherencePercent =
    daysLoggedCount > 0 ? Math.round((onTrackDaysCount / daysLoggedCount) * 100) : 0

  // 7,700 kcal ~= 1 kg body fat
  const estimatedWeightChangeKg = Number((netCalorieBalance / 7700).toFixed(2))

  return {
    monthKey,
    target,
    targetCalories,
    days,
    daysLoggedCount,
    totalCaloriesLogged,
    averageDailyCalories,
    onTrackDaysCount,
    adherencePercent,
    netCalorieBalance,
    estimatedWeightChangeKg,
  }
}
