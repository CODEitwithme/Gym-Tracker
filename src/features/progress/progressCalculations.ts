import { kilogramsToPounds } from '../../lib/units'
import { formatLocalDate } from '../../lib/dateTime'
import type {
  PersonalRecord,
  ProgressPeriod,
  WeightUnit,
  WeeklyVolumePoint,
} from './types'

/**
 * Calculates estimated 1RM using the Epley formula:
 * 1RM = weight * (1 + reps / 30) for reps > 1
 * 1RM = weight for reps = 1
 * 1RM = 0 for weight <= 0 or reps <= 0
 */
export function calculateEstimated1Rm(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0
  if (reps === 1) return Math.round(weightKg * 10) / 10
  const estimated = weightKg * (1 + reps / 30)
  return Math.round(estimated * 10) / 10
}

/**
 * Converts a weight value in kg to the specified unit (kg or lb).
 */
export function convertWeight(weightKg: number, unit: WeightUnit): number {
  if (unit === 'kg') return weightKg
  return kilogramsToPounds(Math.max(0, weightKg))
}

/**
 * Formats a weight in the chosen unit with symbol.
 */
export function formatWeight(
  weightKg: number,
  unit: WeightUnit,
  precision = 1,
): string {
  const converted = convertWeight(weightKg, unit)
  const isWhole = Number.isInteger(converted) || Math.round(converted * 10) % 10 === 0
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: isWhole ? 0 : precision,
    maximumFractionDigits: precision,
  }).format(converted)
  return `${formatted} ${unit}`
}

/**
 * Formats training volume with thousands separators and unit suffix.
 */
export function formatVolume(volumeKg: number, unit: WeightUnit): string {
  const converted = convertWeight(volumeKg, unit)
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(Math.round(converted))
  return `${formatted} ${unit}`
}

export function localMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function shiftCalendarDate(date: Date, days: number): Date {
  const shifted = new Date(date)
  shifted.setDate(shifted.getDate() + days)
  return shifted
}

export interface DateWindow {
  start: Date
  endExclusive: Date
  startDate: string
  endDate: string
  daysCount: number
}

/**
 * Calculates current and prior date windows based on the selected period.
 */
export function calculatePeriodWindows(
  period: ProgressPeriod,
  earliestWorkoutDate: string | null,
  asOf = new Date(),
): { current: DateWindow; previous: DateWindow | null } {
  const today = localMidnight(asOf)
  const endExclusive = shiftCalendarDate(today, 1)
  const endDate = formatLocalDate(today)

  if (period === 'all') {
    const start = earliestWorkoutDate
      ? localMidnight(new Date(earliestWorkoutDate))
      : shiftCalendarDate(today, -365)
    const diffDays = Math.max(1, Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    return {
      current: {
        start,
        endExclusive,
        startDate: formatLocalDate(start),
        endDate,
        daysCount: diffDays,
      },
      previous: null, // "All time" has no prior equivalent period
    }
  }

  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const start = shiftCalendarDate(today, -(days - 1))
  const prevEnd = shiftCalendarDate(start, -1)
  const prevStart = shiftCalendarDate(prevEnd, -(days - 1))

  return {
    current: {
      start,
      endExclusive,
      startDate: formatLocalDate(start),
      endDate,
      daysCount: days,
    },
    previous: {
      start: prevStart,
      endExclusive: shiftCalendarDate(prevEnd, 1),
      startDate: formatLocalDate(prevStart),
      endDate: formatLocalDate(prevEnd),
      daysCount: days,
    },
  }
}

export function isTimestampInWindow(
  timestamp: string | null | undefined,
  window: DateWindow,
): boolean {
  if (!timestamp) return false
  const time = Date.parse(timestamp)
  if (!Number.isFinite(time)) return false
  return time >= window.start.getTime() && time < window.endExclusive.getTime()
}

export interface RawCompletedSet {
  exerciseId: string
  exerciseName: string
  workoutId: string
  workoutName: string
  completedAt: string
  weightKg: number
  reps: number
}

/**
 * Pure function to detect all personal records in chronological order.
 * Strictly avoids duplicate records on repeated renders or same weights.
 */
export function detectAllPersonalRecords(
  setsChronological: RawCompletedSet[],
  periodWindow: DateWindow,
): PersonalRecord[] {
  const records: PersonalRecord[] = []

  // Track state per exercise
  interface ExercisePrState {
    maxWeightKg: number
    max1RmKg: number
    bestRepsAtWeight: Map<number, number> // weight -> max reps
  }

  const stateByExercise = new Map<string, ExercisePrState>()

  for (let i = 0; i < setsChronological.length; i++) {
    const set = setsChronological[i]
    if (set.weightKg <= 0 || set.reps <= 0) continue

    let state = stateByExercise.get(set.exerciseId)
    if (!state) {
      state = {
        maxWeightKg: 0,
        max1RmKg: 0,
        bestRepsAtWeight: new Map<number, number>(),
      }
      stateByExercise.set(set.exerciseId, state)
    }

    const est1Rm = calculateEstimated1Rm(set.weightKg, set.reps)
    const localDate = formatLocalDate(new Date(set.completedAt))
    const isNewInPeriod = isTimestampInWindow(set.completedAt, periodWindow)

    // 1. Check Heaviest Weight PR
    if (set.weightKg > state.maxWeightKg) {
      const prevWeight = state.maxWeightKg > 0 ? state.maxWeightKg : null
      const improvementKg = prevWeight !== null ? set.weightKg - prevWeight : null
      const improvementPercent =
        prevWeight !== null && prevWeight > 0
          ? Math.round(((set.weightKg - prevWeight) / prevWeight) * 1000) / 10
          : null

      records.push({
        id: `pr-heaviest-${set.exerciseId}-${set.workoutId}-${i}`,
        exerciseId: set.exerciseId,
        exerciseName: set.exerciseName,
        workoutId: set.workoutId,
        workoutName: set.workoutName,
        achievedAt: set.completedAt,
        localDate,
        type: 'heaviest',
        weightKg: set.weightKg,
        reps: set.reps,
        estimated1RmKg: est1Rm,
        previousWeightKg: prevWeight,
        previousEstimated1RmKg: state.max1RmKg > 0 ? state.max1RmKg : null,
        previousReps: null,
        improvementKg,
        improvementPercent,
        isNewInPeriod,
      })

      state.maxWeightKg = set.weightKg
    }

    // 2. Check Estimated 1RM PR (must exceed prior 1RM by at least 0.2 kg to be distinct)
    if (est1Rm > state.max1RmKg + 0.1) {
      // If this set didn't already trigger a heaviest weight PR on this exact set, or if it represents a notable 1RM leap
      const prev1Rm = state.max1RmKg > 0 ? state.max1RmKg : null
      const improvementKg = prev1Rm !== null ? Math.round((est1Rm - prev1Rm) * 10) / 10 : null
      const improvementPercent =
        prev1Rm !== null && prev1Rm > 0
          ? Math.round(((est1Rm - prev1Rm) / prev1Rm) * 1000) / 10
          : null

      records.push({
        id: `pr-1rm-${set.exerciseId}-${set.workoutId}-${i}`,
        exerciseId: set.exerciseId,
        exerciseName: set.exerciseName,
        workoutId: set.workoutId,
        workoutName: set.workoutName,
        achievedAt: set.completedAt,
        localDate,
        type: 'one_rep_max',
        weightKg: set.weightKg,
        reps: set.reps,
        estimated1RmKg: est1Rm,
        previousWeightKg: state.maxWeightKg > 0 ? state.maxWeightKg : null,
        previousEstimated1RmKg: prev1Rm,
        previousReps: null,
        improvementKg,
        improvementPercent,
        isNewInPeriod,
      })

      state.max1RmKg = est1Rm
    }

    // 3. Check Rep PR at this specific weight
    const currentBestReps = state.bestRepsAtWeight.get(set.weightKg) ?? 0
    if (set.reps > currentBestReps && currentBestReps > 0) {
      records.push({
        id: `pr-reps-${set.exerciseId}-${set.weightKg}-${set.workoutId}-${i}`,
        exerciseId: set.exerciseId,
        exerciseName: set.exerciseName,
        workoutId: set.workoutId,
        workoutName: set.workoutName,
        achievedAt: set.completedAt,
        localDate,
        type: 'rep_record',
        weightKg: set.weightKg,
        reps: set.reps,
        estimated1RmKg: est1Rm,
        previousWeightKg: set.weightKg,
        previousEstimated1RmKg: state.max1RmKg,
        previousReps: currentBestReps,
        improvementKg: null,
        improvementPercent: Math.round(((set.reps - currentBestReps) / currentBestReps) * 1000) / 10,
        isNewInPeriod,
      })
      state.bestRepsAtWeight.set(set.weightKg, set.reps)
    } else if (!state.bestRepsAtWeight.has(set.weightKg)) {
      state.bestRepsAtWeight.set(set.weightKg, set.reps)
    }
  }

  return records
}

/**
 * Groups volume by calendar week across a list of completed workouts.
 */
export function buildWeeklyVolumeBuckets(
  workouts: Array<{
    completedAt: string
    totalVolumeKg: number
  }>,
  weeksCount = 8,
  asOf = new Date(),
): WeeklyVolumePoint[] {
  const result: WeeklyVolumePoint[] = []
  const today = localMidnight(asOf)

  // Find start of current week (Monday)
  const currentDay = today.getDay()
  const distanceToMonday = (currentDay + 6) % 7
  const currentMonday = shiftCalendarDate(today, -distanceToMonday)

  for (let i = weeksCount - 1; i >= 0; i--) {
    const weekStart = shiftCalendarDate(currentMonday, -i * 7)
    const weekEnd = shiftCalendarDate(weekStart, 6)
    const weekEndExclusive = shiftCalendarDate(weekStart, 7)

    const label = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(weekStart)

    const matching = workouts.filter((w) => {
      const time = Date.parse(w.completedAt)
      return time >= weekStart.getTime() && time < weekEndExclusive.getTime()
    })

    const volumeKg = matching.reduce((sum, w) => sum + w.totalVolumeKg, 0)

    result.push({
      weekKey: formatLocalDate(weekStart),
      label,
      startDate: formatLocalDate(weekStart),
      endDate: formatLocalDate(weekEnd),
      volumeKg,
      workoutCount: matching.length,
    })
  }

  return result
}

