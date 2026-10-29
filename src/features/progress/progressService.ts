import type { GymTrackerDatabase } from '../../db/database'
import { db } from '../../db/database'
import { formatLocalDate } from '../../lib/dateTime'
import type {
  ExerciseSummary,
  ProgressDashboardData,
  ProgressOverviewMetrics,
  ProgressPeriod,
  StrengthChartPoint,
  WeightUnit,
  WorkoutHistoryItem,
} from './types'
import {
  buildWeeklyVolumeBuckets,
  calculateEstimated1Rm,
  calculatePeriodWindows,
  detectAllPersonalRecords,
  isTimestampInWindow,
  type RawCompletedSet,
} from './progressCalculations'

export async function loadProgressDashboardData(
  period: ProgressPeriod,
  unit: WeightUnit,
  selectedExerciseId?: string,
  database: GymTrackerDatabase = db,
  asOf = new Date(),
): Promise<ProgressDashboardData> {
  // 1. Fetch completed, non-deleted workout sessions
  const sessions = await database.workoutSessions
    .filter(
      (session) => session.status === 'completed' && session.deletedAt === null && session.completedAt !== null,
    )
    .toArray()

  // Sort sessions chronologically (oldest to newest)
  sessions.sort((a, b) => {
    const timeA = Date.parse(a.completedAt ?? a.startedAt)
    const timeB = Date.parse(b.completedAt ?? b.startedAt)
    return timeA - timeB
  })

  // 2. Fetch all active exercises
  const allExercises = await database.exercises
    .filter((e) => e.deletedAt === null)
    .toArray()
  allExercises.sort((a, b) => a.name.localeCompare(b.name))

  const exerciseById = new Map(allExercises.map((e) => [e.id, e]))
  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  const workoutIds = [...sessionById.keys()]

  // 3. Fetch workout-exercise relations and sets
  const workoutExercises = workoutIds.length
    ? await database.workoutExercises
        .where('workoutId')
        .anyOf(workoutIds)
        .filter((we) => we.deletedAt === null)
        .toArray()
    : []

  const relationById = new Map(workoutExercises.map((we) => [we.id, we]))
  const relationIds = [...relationById.keys()]

  const sets = relationIds.length
    ? await database.exerciseSets
        .where('workoutExerciseId')
        .anyOf(relationIds)
        .filter(
          (set) =>
            set.deletedAt === null &&
            set.completed === true &&
            Number.isFinite(set.weightKg) &&
            set.weightKg >= 0 &&
            Number.isInteger(set.reps) &&
            set.reps > 0,
        )
        .toArray()
    : []

  // Group sets by workoutExerciseId
  const setsByRelation = new Map<string, typeof sets>()
  for (const set of sets) {
    const list = setsByRelation.get(set.workoutExerciseId) ?? []
    list.push(set)
    setsByRelation.set(set.workoutExerciseId, list)
  }

  // Group relations by workoutId
  const relationsByWorkout = new Map<string, typeof workoutExercises>()
  for (const we of workoutExercises) {
    const list = relationsByWorkout.get(we.workoutId) ?? []
    list.push(we)
    relationsByWorkout.set(we.workoutId, list)
  }

  // 4. Calculate period windows
  const earliestWorkoutDate = sessions.length ? sessions[0].completedAt : null
  const { current: currentWindow, previous: previousWindow } = calculatePeriodWindows(
    period,
    earliestWorkoutDate,
    asOf,
  )

  // 5. Build raw completed sets in chronological order for PR detection
  const rawCompletedSets: RawCompletedSet[] = []
  const exerciseSetCounts = new Map<string, number>()

  for (const session of sessions) {
    const sessionRelations = relationsByWorkout.get(session.id) ?? []
    for (const rel of sessionRelations) {
      const exercise = exerciseById.get(rel.exerciseId)
      const exerciseName = exercise?.name ?? rel.exerciseNameSnapshot
      const relSets = (setsByRelation.get(rel.id) ?? []).slice().sort((a, b) => a.setNumber - b.setNumber)

      for (const set of relSets) {
        rawCompletedSets.push({
          exerciseId: rel.exerciseId,
          exerciseName,
          workoutId: session.id,
          workoutName: session.name,
          completedAt: session.completedAt!,
          weightKg: set.weightKg,
          reps: set.reps,
        })
        exerciseSetCounts.set(rel.exerciseId, (exerciseSetCounts.get(rel.exerciseId) ?? 0) + 1)
      }
    }
  }

  // 6. Detect Personal Records
  const allPersonalRecords = detectAllPersonalRecords(rawCompletedSets, currentWindow)
  // Reverse to show newest PRs first in the UI
  const personalRecords = allPersonalRecords.slice().reverse()

  // 7. Calculate Workout Histories & Session Volumes
  const workoutHistoryItems: WorkoutHistoryItem[] = sessions
    .map((session) => {
      const sessionRelations = relationsByWorkout.get(session.id) ?? []
      let totalVolumeKg = 0
      let completedSetCount = 0
      const exerciseNames: string[] = []

      for (const rel of sessionRelations) {
        const exercise = exerciseById.get(rel.exerciseId)
        exerciseNames.push(exercise?.name ?? rel.exerciseNameSnapshot)
        const relSets = setsByRelation.get(rel.id) ?? []
        for (const set of relSets) {
          totalVolumeKg += set.weightKg * set.reps
          completedSetCount += 1
        }
      }

      const startedTime = Date.parse(session.startedAt)
      const completedTime = session.completedAt ? Date.parse(session.completedAt) : null
      const durationSeconds =
        Number.isFinite(startedTime) && completedTime !== null && completedTime >= startedTime
          ? Math.floor((completedTime - startedTime) / 1000)
          : null

      return {
        id: session.id,
        name: session.name,
        completedAt: session.completedAt!,
        durationSeconds,
        exerciseCount: sessionRelations.length,
        completedSetCount,
        totalVolumeKg,
        exercises: exerciseNames,
      }
    })
    .reverse() // Newest first

  // 8. Overview Metrics for Current vs Previous Window
  const currentWorkouts = workoutHistoryItems.filter((w) =>
    isTimestampInWindow(w.completedAt, currentWindow),
  )
  const previousWorkouts = previousWindow
    ? workoutHistoryItems.filter((w) => isTimestampInWindow(w.completedAt, previousWindow))
    : []

  const currentVolume = currentWorkouts.reduce((sum, w) => sum + w.totalVolumeKg, 0)
  const previousVolume = previousWorkouts.reduce((sum, w) => sum + w.totalVolumeKg, 0)

  // PRs in current vs previous
  const currentPrs = allPersonalRecords.filter((pr) => isTimestampInWindow(pr.achievedAt, currentWindow))
  const previousPrs = previousWindow
    ? allPersonalRecords.filter((pr) => isTimestampInWindow(pr.achievedAt, previousWindow))
    : []

  // Active training days
  const currentDaysSet = new Set(
    currentWorkouts.map((w) => formatLocalDate(new Date(w.completedAt))),
  )
  const previousDaysSet = new Set(
    previousWorkouts.map((w) => formatLocalDate(new Date(w.completedAt))),
  )

  const workoutsPerWeek = currentWindow.daysCount > 0
    ? (currentWorkouts.length / currentWindow.daysCount) * 7
    : 0
  const previousWorkoutsPerWeek = previousWindow && previousWindow.daysCount > 0
    ? (previousWorkouts.length / previousWindow.daysCount) * 7
    : 0

  const validDurations = currentWorkouts
    .map((w) => w.durationSeconds)
    .filter((d): d is number => d !== null)
  const totalCompletedDurationSeconds = validDurations.length
    ? validDurations.reduce((sum, d) => sum + d, 0)
    : null

  const metrics: ProgressOverviewMetrics = {
    workoutsCount: currentWorkouts.length,
    previousWorkoutsCount: previousWorkouts.length,
    totalVolumeKg: currentVolume,
    previousTotalVolumeKg: previousVolume,
    prsCount: currentPrs.length,
    previousPrsCount: previousPrs.length,
    activeTrainingDays: currentDaysSet.size,
    previousActiveTrainingDays: previousDaysSet.size,
    workoutsPerWeek,
    previousWorkoutsPerWeek,
    totalCompletedDurationSeconds,
    hasPreviousData: previousWindow !== null && previousWorkouts.length > 0,
    periodDays: currentWindow.daysCount,
  }

  // 9. Weekly Volume Trend (always last 8 weeks for trend visualization)
  const weeklyVolume = buildWeeklyVolumeBuckets(workoutHistoryItems, 8, asOf)

  // 10. Exercise Summaries
  const exerciseSummariesMap = new Map<string, ExerciseSummary>()
  for (const session of sessions) {
    const sessionRelations = relationsByWorkout.get(session.id) ?? []
    for (const rel of sessionRelations) {
      const exercise = exerciseById.get(rel.exerciseId)
      const name = exercise?.name ?? rel.exerciseNameSnapshot
      const category = exercise?.category ?? 'other'

      let summary = exerciseSummariesMap.get(rel.exerciseId)
      if (!summary) {
        summary = {
          exerciseId: rel.exerciseId,
          exerciseName: name,
          category,
          totalSets: 0,
          totalVolumeKg: 0,
          bestWeightKg: 0,
          bestReps: 0,
          estimated1RmKg: 0,
          lastTrainedAt: null,
          workoutCount: 0,
        }
        exerciseSummariesMap.set(rel.exerciseId, summary)
      }

      const relSets = setsByRelation.get(rel.id) ?? []
      if (relSets.length > 0) {
        summary.workoutCount += 1
        summary.lastTrainedAt = session.completedAt
        for (const set of relSets) {
          summary.totalSets += 1
          summary.totalVolumeKg += set.weightKg * set.reps
          if (set.weightKg > summary.bestWeightKg) {
            summary.bestWeightKg = set.weightKg
            summary.bestReps = set.reps
          }
          const e1rm = calculateEstimated1Rm(set.weightKg, set.reps)
          if (e1rm > summary.estimated1RmKg) {
            summary.estimated1RmKg = e1rm
          }
        }
      }
    }
  }

  const exerciseSummaries = [...exerciseSummariesMap.values()].sort(
    (a, b) => b.totalVolumeKg - a.totalVolumeKg,
  )

  // 11. Determine selected exercise for strength progression
  // Priority: provided selectedExerciseId -> Bench Press -> highest volume exercise -> first exercise
  const availableExerciseIds = new Set(exerciseSummaries.map((e) => e.exerciseId))
  let activeExerciseId = selectedExerciseId ?? ''

  if (!activeExerciseId || !availableExerciseIds.has(activeExerciseId)) {
    const bench = exerciseSummaries.find((e) =>
      e.exerciseName.toLowerCase().includes('bench press'),
    )
    if (bench) {
      activeExerciseId = bench.exerciseId
    } else if (exerciseSummaries.length > 0) {
      activeExerciseId = exerciseSummaries[0].exerciseId
    } else if (allExercises.length > 0) {
      activeExerciseId = allExercises[0].id
    }
  }

  // 12. Strength Progression Points for activeExerciseId
  const strengthProgression: StrengthChartPoint[] = []

  if (activeExerciseId) {
    for (const session of sessions) {
      // Must fall in current window
      if (!isTimestampInWindow(session.completedAt, currentWindow)) continue

      const sessionRelations = (relationsByWorkout.get(session.id) ?? []).filter(
        (r) => r.exerciseId === activeExerciseId,
      )

      if (sessionRelations.length === 0) continue

      let sessionBestWeight = 0
      let sessionBestReps = 0
      let sessionBest1Rm = 0
      let totalExerciseVol = 0

      for (const rel of sessionRelations) {
        const relSets = setsByRelation.get(rel.id) ?? []
        for (const set of relSets) {
          totalExerciseVol += set.weightKg * set.reps
          if (set.weightKg > sessionBestWeight) {
            sessionBestWeight = set.weightKg
            sessionBestReps = set.reps
          }
          const e1rm = calculateEstimated1Rm(set.weightKg, set.reps)
          if (e1rm > sessionBest1Rm) {
            sessionBest1Rm = e1rm
          }
        }
      }

      if (sessionBestWeight > 0) {
        strengthProgression.push({
          workoutId: session.id,
          workoutName: session.name,
          timestamp: session.completedAt!,
          localDate: formatLocalDate(new Date(session.completedAt!)),
          bestWeightKg: sessionBestWeight,
          bestWeightReps: sessionBestReps,
          estimated1RmKg: sessionBest1Rm,
          totalExerciseVolumeKg: totalExerciseVol,
        })
      }
    }
  }

  // Format list of available exercises: sorted with active first, then by frequency
  const availableExercises = allExercises.map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    hasData: availableExerciseIds.has(e.id),
  })).sort((a, b) => {
    if (a.hasData && !b.hasData) return -1
    if (!a.hasData && b.hasData) return 1
    return a.name.localeCompare(b.name)
  })

  return {
    period,
    unit,
    selectedExerciseId: activeExerciseId,
    metrics,
    strengthProgression,
    personalRecords,
    weeklyVolume,
    recentWorkouts: workoutHistoryItems.slice(0, 10),
    exerciseSummaries,
    availableExercises,
    hasAnyWorkouts: sessions.length > 0,
  }
}

