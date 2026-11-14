import type { GymTrackerDatabase } from '../../db/database'
import { db } from '../../db/database'
import {
  getLatestWeightLog,
  getStepLogByDate,
  getWeightLogByDate,
  listStepLogsInRange,
  listWeightLogs,
  listWeightLogsInRange,
} from '../../db/repositories/bodyMetrics'
import { formatLocalDate } from '../../lib/dateTime'
import { kilogramsToPounds } from '../../lib/units'
import type { StepLog, WeightLog } from '../../types/records'

export type BodyMetricsPeriod = '7d' | '30d' | '90d' | 'all'

export interface WeightChartPoint {
  date: string
  weightKg: number
  displayWeight: number
  movingAverageKg: number
  displayMovingAverage: number
  notes?: string
}

export interface StepChartPoint {
  date: string
  label: string
  stepCount: number
  targetSteps: number
  isGoalReached: boolean
}

export interface WeightProgressionData {
  points: WeightChartPoint[]
  startWeight: number | null
  currentWeight: number | null
  deltaWeight: number | null
  weeklyRateKg: number | null
  unit: 'kg' | 'lb'
}

export interface StepProgressData {
  points: StepChartPoint[]
  totalSteps: number
  averageDailySteps: number
  daysGoalMet: number
  totalDays: number
  targetSteps: number
}

export interface TodayBodyMetrics {
  todayWeight: WeightLog | null
  todaySteps: StepLog | null
  latestWeight: WeightLog | null
  weeklyWeightDeltaKg: number | null
}

function getPeriodStartDate(period: BodyMetricsPeriod, asOf: Date): string | null {
  if (period === 'all') return null
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const start = new Date(asOf)
  start.setDate(start.getDate() - (days - 1))
  return formatLocalDate(start)
}

/**
 * Computes 7-day Simple Moving Average for weight smoothing.
 */
export function computeMovingAverages(
  logs: WeightLog[],
  windowSize = 7,
): Array<{ date: string; weightKg: number; movingAvgKg: number; notes?: string }> {
  const sorted = [...logs].sort((a, b) => a.localDate.localeCompare(b.localDate))
  return sorted.map((entry, index, array) => {
    const startIdx = Math.max(0, index - windowSize + 1)
    const window = array.slice(startIdx, index + 1)
    const avg = window.reduce((sum, item) => sum + item.weightKg, 0) / window.length
    return {
      date: entry.localDate,
      weightKg: entry.weightKg,
      movingAvgKg: Math.round(avg * 100) / 100,
      notes: entry.notes,
    }
  })
}

export async function loadTodayBodyMetrics(
  database: GymTrackerDatabase = db,
  asOf = new Date(),
): Promise<TodayBodyMetrics> {
  const todayStr = formatLocalDate(asOf)
  const sevenDaysAgoStr = formatLocalDate(
    new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate() - 7),
  )

  const [todayWeight, todaySteps, latestWeight, recentWeights] = await Promise.all([
    getWeightLogByDate(todayStr, database),
    getStepLogByDate(todayStr, database),
    getLatestWeightLog(database),
    listWeightLogsInRange(sevenDaysAgoStr, todayStr, database),
  ])

  let weeklyWeightDeltaKg: number | null = null
  if (recentWeights.length >= 2) {
    const oldest = recentWeights[0]
    const newest = recentWeights[recentWeights.length - 1]
    weeklyWeightDeltaKg = Number((newest.weightKg - oldest.weightKg).toFixed(2))
  }

  return {
    todayWeight: todayWeight ?? null,
    todaySteps: todaySteps ?? null,
    latestWeight: latestWeight ?? null,
    weeklyWeightDeltaKg,
  }
}

export async function loadWeightProgression(
  period: BodyMetricsPeriod,
  unit: 'kg' | 'lb',
  database: GymTrackerDatabase = db,
  asOf = new Date(),
): Promise<WeightProgressionData> {
  const todayStr = formatLocalDate(asOf)
  const startDate = getPeriodStartDate(period, asOf)

  const rawLogs = startDate
    ? await listWeightLogsInRange(startDate, todayStr, database)
    : await listWeightLogs(database)

  if (rawLogs.length === 0) {
    return {
      points: [],
      startWeight: null,
      currentWeight: null,
      deltaWeight: null,
      weeklyRateKg: null,
      unit,
    }
  }

  const smoothed = computeMovingAverages(rawLogs)
  const points: WeightChartPoint[] = smoothed.map((s) => {
    const displayWeight =
      unit === 'kg' ? s.weightKg : Math.round(kilogramsToPounds(s.weightKg) * 10) / 10
    const displayMovingAverage =
      unit === 'kg' ? s.movingAvgKg : Math.round(kilogramsToPounds(s.movingAvgKg) * 10) / 10

    return {
      date: s.date,
      weightKg: s.weightKg,
      displayWeight,
      movingAverageKg: s.movingAvgKg,
      displayMovingAverage,
      notes: s.notes,
    }
  })

  const startKg = points[0].weightKg
  const currentKg = points[points.length - 1].weightKg
  const deltaKg = currentKg - startKg

  // Calculate rate of change per week
  let weeklyRateKg: number | null = null
  if (points.length >= 2) {
    const d1 = new Date(points[0].date).getTime()
    const d2 = new Date(points[points.length - 1].date).getTime()
    const daysDiff = Math.max(1, (d2 - d1) / (1000 * 60 * 60 * 24))
    weeklyRateKg = Number(((deltaKg / daysDiff) * 7).toFixed(2))
  }

  const startWeight =
    unit === 'kg' ? startKg : Math.round(kilogramsToPounds(startKg) * 10) / 10
  const currentWeight =
    unit === 'kg' ? currentKg : Math.round(kilogramsToPounds(currentKg) * 10) / 10
  const deltaWeight =
    unit === 'kg' ? Number(deltaKg.toFixed(2)) : Number((currentWeight - startWeight).toFixed(2))

  return {
    points,
    startWeight,
    currentWeight,
    deltaWeight,
    weeklyRateKg,
    unit,
  }
}

export async function loadStepProgress(
  period: BodyMetricsPeriod,
  fallbackTarget = 10_000,
  database: GymTrackerDatabase = db,
  asOf = new Date(),
): Promise<StepProgressData> {
  const todayStr = formatLocalDate(asOf)
  const daysCount = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30
  const startDate = getPeriodStartDate(period, asOf) ?? getPeriodStartDate('30d', asOf)!

  const logs = await listStepLogsInRange(startDate, todayStr, database)
  const logsMap = new Map(logs.map((l) => [l.localDate, l]))

  const points: StepChartPoint[] = []
  let totalSteps = 0
  let daysGoalMet = 0

  const start = new Date(asOf)
  start.setDate(start.getDate() - (daysCount - 1))

  for (let i = 0; i < daysCount; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const dateStr = formatLocalDate(d)
    const log = logsMap.get(dateStr)

    const stepCount = log?.stepCount ?? 0
    const targetSteps = log?.targetSteps ?? fallbackTarget
    const isGoalReached = stepCount >= targetSteps

    if (stepCount > 0) {
      totalSteps += stepCount
      if (isGoalReached) daysGoalMet++
    }

    const label = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(d)

    points.push({
      date: dateStr,
      label,
      stepCount,
      targetSteps,
      isGoalReached,
    })
  }

  const loggedDays = points.filter((p) => p.stepCount > 0).length
  const averageDailySteps = loggedDays > 0 ? Math.round(totalSteps / loggedDays) : 0

  return {
    points,
    totalSteps,
    averageDailySteps,
    daysGoalMet,
    totalDays: daysCount,
    targetSteps: fallbackTarget,
  }
}
