import type { GymTrackerDatabase } from '../../db/database'
import { db } from '../../db/database'
import { formatLocalDate } from '../../lib/dateTime'
import type { Exercise } from '../workouts/types'
import type { MealLog, DailyNutritionTotals } from '../nutrition/types'
import type { WorkoutSession } from '../workouts/types'

export type AnalyticsPeriod = 7 | 30 | 90

export interface DashboardDay {
  date: string
  workoutCount: number
  trainingVolumeKg: number
  hasMealEntries: boolean
  nutrition: DailyNutritionTotals
}

export interface AnalyticsWorkout {
  session: WorkoutSession
  durationSeconds: number | null
  exerciseCount: number
  setCount: number
  completedSetCount: number
  trainingVolumeKg: number
}

export interface DashboardActivity {
  id: string
  type: 'workout' | 'meal'
  timestamp: string
  title: string
  description: string
  workoutId?: string
}

export interface DashboardAnalytics {
  period: {
    days: AnalyticsPeriod
    startDate: string
    endDate: string
    previousStartDate: string
    previousEndDate: string
  }
  days: DashboardDay[]
  workouts: {
    count: number
    trainingDays: number
    totalDurationSeconds: number | null
    totalVolumeKg: number
    perSevenDays: number
    recent: AnalyticsWorkout[]
  }
  nutrition: {
    averagePerCalendarDay: DailyNutritionTotals
    daysWithEntries: number
    mealLogCount: number
  }
  comparison: {
    hasPreviousData: boolean
    workouts: number
    previousWorkouts: number
    trainingDays: number
    previousTrainingDays: number
    averageCalories: number
    previousAverageCalories: number
    hasPreviousNutrition: boolean
  }
  activities: DashboardActivity[]
  exercises: Array<Pick<Exercise, 'id' | 'name'>>
}

export interface ExerciseProgressEntry {
  workoutId: string
  workoutName: string
  exerciseNameSnapshot: string
  completedAt: string
  sets: Array<{
    setNumber: number
    weightKg: number
    reps: number
  }>
  bestWeightKg: number
}

export interface ExerciseProgress {
  exerciseId: string
  bestRecordedWeightKg: number | null
  entries: ExerciseProgressEntry[]
}

interface CalendarWindow {
  start: Date
  endExclusive: Date
  startDate: string
  endDate: string
}

const emptyNutrition = (): DailyNutritionTotals => ({
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
})

function localMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function shiftCalendarDate(date: Date, amount: number): Date {
  const shifted = new Date(date)
  shifted.setDate(shifted.getDate() + amount)
  return shifted
}

function makeWindow(endDate: Date, days: number): CalendarWindow {
  const end = localMidnight(endDate)
  const start = shiftCalendarDate(end, -(days - 1))
  return {
    start,
    endExclusive: shiftCalendarDate(end, 1),
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
  }
}

function validTimestamp(value: string | null): number | null {
  if (value === null) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function validNutrition(snapshot: MealLog['nutritionSnapshot']): boolean {
  return Object.values(snapshot).every(
    (value) => Number.isFinite(value) && value >= 0,
  )
}

function validSet(set: {
  weightKg: number
  reps: number
  completed: boolean
}): boolean {
  return (
    set.completed === true &&
    Number.isFinite(set.weightKg) &&
    set.weightKg >= 0 &&
    Number.isInteger(set.reps) &&
    set.reps > 0
  )
}

function isWithin(timestamp: number | null, start: Date, end: Date): boolean {
  return timestamp !== null && timestamp >= start.getTime() && timestamp < end.getTime()
}

export async function loadDashboardAnalytics(
  periodDays: AnalyticsPeriod,
  database: GymTrackerDatabase = db,
  asOf = new Date(),
): Promise<DashboardAnalytics> {
  const today = localMidnight(asOf)
  const currentWindow = makeWindow(today, periodDays)
  const previousEnd = shiftCalendarDate(currentWindow.start, -1)
  const previousWindow = makeWindow(previousEnd, periodDays)
  const queryStart = previousWindow.start
  const queryEnd = currentWindow.endExclusive

  const [sessions, mealLogs, exercises] = await Promise.all([
    database.workoutSessions
      .where('completedAt')
      .between(queryStart.toISOString(), queryEnd.toISOString(), true, false)
      .filter(
        (session) =>
          session.status === 'completed' && session.deletedAt === null,
      )
      .toArray(),
    database.mealLogs
      .where('localDate')
      .between(previousWindow.startDate, currentWindow.endDate, true, true)
      .filter((log) => log.deletedAt === null)
      .toArray(),
    database.exercises
      .filter((exercise) => exercise.deletedAt === null)
      .toArray(),
  ])

  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const workoutIds = [...sessionById.keys()]
  const workoutExercises = workoutIds.length
    ? await database.workoutExercises
        .where('workoutId')
        .anyOf(workoutIds)
        .filter((item) => item.deletedAt === null)
        .toArray()
    : []
  const activeExerciseIds = [...new Set(workoutExercises.map((item) => item.exerciseId))]
  const activeExercises = activeExerciseIds.length
    ? await database.exercises.bulkGet(activeExerciseIds)
    : []
  const activeExerciseIdSet = new Set(
    activeExercises
      .filter(
        (exercise): exercise is Exercise =>
          exercise !== undefined && exercise.deletedAt === null,
      )
      .map((exercise) => exercise.id),
  )
  const eligibleRelations = workoutExercises.filter((item) =>
    activeExerciseIdSet.has(item.exerciseId),
  )
  const relationIds = eligibleRelations.map((item) => item.id)
  const sets = relationIds.length
    ? await database.exerciseSets
        .where('workoutExerciseId')
        .anyOf(relationIds)
        .filter((set) => set.deletedAt === null)
        .toArray()
    : []

  const currentSessions = sessions.filter((session) =>
    isWithin(validTimestamp(session.completedAt), currentWindow.start, currentWindow.endExclusive),
  )
  const previousSessions = sessions.filter((session) =>
    isWithin(validTimestamp(session.completedAt), previousWindow.start, currentWindow.start),
  )
  const currentLogs = mealLogs.filter(
    (log) =>
      log.localDate >= currentWindow.startDate &&
      log.localDate <= currentWindow.endDate,
  )
  const previousLogs = mealLogs.filter(
    (log) =>
      log.localDate >= previousWindow.startDate &&
      log.localDate <= previousWindow.endDate,
  )
  const setsByRelation = new Map<string, typeof sets>()
  for (const set of sets) {
    const bucket = setsByRelation.get(set.workoutExerciseId) ?? []
    bucket.push(set)
    setsByRelation.set(set.workoutExerciseId, bucket)
  }

  const workoutMetrics = new Map<string, AnalyticsWorkout>()
  for (const session of sessions) {
    workoutMetrics.set(session.id, {
      session,
      durationSeconds: (() => {
        const started = validTimestamp(session.startedAt)
        const completed = validTimestamp(session.completedAt)
        return started !== null && completed !== null && completed >= started
          ? Math.floor((completed - started) / 1000)
          : null
      })(),
      exerciseCount: 0,
      setCount: 0,
      completedSetCount: 0,
      trainingVolumeKg: 0,
    })
  }
  for (const relation of eligibleRelations) {
    const workout = workoutMetrics.get(relation.workoutId)
    if (!workout) continue
    workout.exerciseCount += 1
    for (const set of setsByRelation.get(relation.id) ?? []) {
      workout.setCount += 1
      if (set.completed) workout.completedSetCount += 1
      if (validSet(set)) workout.trainingVolumeKg += set.weightKg * set.reps
    }
  }

  const days: DashboardDay[] = []
  for (
    let date = new Date(currentWindow.start);
    date < currentWindow.endExclusive;
    date = shiftCalendarDate(date, 1)
  ) {
    const localDate = formatLocalDate(date)
    const nutrition = emptyNutrition()
    let hasMealEntries = false
    for (const log of currentLogs) {
      if (log.localDate !== localDate) continue
      hasMealEntries = true
      if (!validNutrition(log.nutritionSnapshot)) continue
      nutrition.calories += log.nutritionSnapshot.calories
      nutrition.proteinG += log.nutritionSnapshot.proteinG
      nutrition.carbsG += log.nutritionSnapshot.carbsG
      nutrition.fatG += log.nutritionSnapshot.fatG
    }
    const dayWorkouts = currentSessions.filter((session) => {
      const completedTimestamp = validTimestamp(session.completedAt)
      return (
        completedTimestamp !== null &&
        formatLocalDate(new Date(completedTimestamp)) === localDate
      )
    })
    days.push({
      date: localDate,
      workoutCount: dayWorkouts.length,
      trainingVolumeKg: dayWorkouts.reduce(
        (total, session) =>
          total + (workoutMetrics.get(session.id)?.trainingVolumeKg ?? 0),
        0,
      ),
      hasMealEntries,
      nutrition,
    })
  }

  const trainingDayDates = (items: WorkoutSession[]) =>
    new Set(
      items
        .map((session) => validTimestamp(session.completedAt))
        .filter((timestamp): timestamp is number => timestamp !== null)
        .map((timestamp) => formatLocalDate(new Date(timestamp))),
    )
  const currentTrainingDays = trainingDayDates(currentSessions)
  const previousTrainingDays = trainingDayDates(previousSessions)
  const currentMetrics = currentSessions
    .map((session) => workoutMetrics.get(session.id))
    .filter((item): item is AnalyticsWorkout => item !== undefined)
  const validDurations = currentMetrics
    .map((item) => item.durationSeconds)
    .filter((duration): duration is number => duration !== null)
  const totalDurationSeconds = validDurations.length
    ? validDurations.reduce((sum, duration) => sum + duration, 0)
    : null
  const nutritionSums = currentLogs.reduce((sum, log) => {
    if (validNutrition(log.nutritionSnapshot)) {
      sum.calories += log.nutritionSnapshot.calories
      sum.proteinG += log.nutritionSnapshot.proteinG
      sum.carbsG += log.nutritionSnapshot.carbsG
      sum.fatG += log.nutritionSnapshot.fatG
    }
    return sum
  }, emptyNutrition())
  const previousNutritionSums = previousLogs.reduce((sum, log) => {
    if (validNutrition(log.nutritionSnapshot)) {
      sum.calories += log.nutritionSnapshot.calories
      sum.proteinG += log.nutritionSnapshot.proteinG
      sum.carbsG += log.nutritionSnapshot.carbsG
      sum.fatG += log.nutritionSnapshot.fatG
    }
    return sum
  }, emptyNutrition())
  const previousActivityCount = previousSessions.length + previousLogs.length
  const currentActivities: DashboardActivity[] = [
    ...currentMetrics.map((item) => ({
      id: item.session.id,
      type: 'workout' as const,
      timestamp: item.session.completedAt ?? item.session.startedAt,
      title: item.session.name,
      description: `${item.exerciseCount} exercise${item.exerciseCount === 1 ? '' : 's'} · ${
        item.durationSeconds === null
          ? 'duration unavailable'
          : `${Math.floor(item.durationSeconds / 60)} min`
      }`,
      workoutId: item.session.id,
    })),
    ...currentLogs.map((log) => ({
      id: log.id,
      type: 'meal' as const,
      timestamp: log.consumedAt,
      title: log.mealNameSnapshot,
      description: validNutrition(log.nutritionSnapshot)
        ? `${log.nutritionSnapshot.calories} kcal recorded`
        : 'Nutrition entry',
    })),
  ]
  const dayCount = Math.max(1, days.length)

  return {
    period: {
      days: periodDays,
      startDate: currentWindow.startDate,
      endDate: currentWindow.endDate,
      previousStartDate: previousWindow.startDate,
      previousEndDate: previousWindow.endDate,
    },
    days,
    workouts: {
      count: currentSessions.length,
      trainingDays: currentTrainingDays.size,
      totalDurationSeconds,
      totalVolumeKg: currentMetrics.reduce(
        (sum, workout) => sum + workout.trainingVolumeKg,
        0,
      ),
      perSevenDays: (currentSessions.length / dayCount) * 7,
      recent: currentMetrics
        .slice()
        .sort(
          (left, right) =>
            (validTimestamp(right.session.completedAt) ?? 0) -
            (validTimestamp(left.session.completedAt) ?? 0),
        )
        .slice(0, 5),
    },
    nutrition: {
      averagePerCalendarDay: {
        calories: nutritionSums.calories / dayCount,
        proteinG: nutritionSums.proteinG / dayCount,
        carbsG: nutritionSums.carbsG / dayCount,
        fatG: nutritionSums.fatG / dayCount,
      },
      daysWithEntries: days.filter((day) => day.hasMealEntries).length,
      mealLogCount: currentLogs.length,
    },
    comparison: {
      hasPreviousData: previousActivityCount > 0,
      workouts: currentSessions.length - previousSessions.length,
      previousWorkouts: previousSessions.length,
      trainingDays: currentTrainingDays.size - previousTrainingDays.size,
      previousTrainingDays: previousTrainingDays.size,
      averageCalories:
        nutritionSums.calories / dayCount -
        previousNutritionSums.calories / periodDays,
      previousAverageCalories: previousNutritionSums.calories / periodDays,
      hasPreviousNutrition: previousLogs.length > 0,
    },
    activities: currentActivities
      .filter((activity) => validTimestamp(activity.timestamp) !== null)
      .sort(
        (left, right) =>
          (validTimestamp(right.timestamp) ?? 0) -
          (validTimestamp(left.timestamp) ?? 0),
      )
      .slice(0, 8),
    exercises: exercises
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(({ id, name }) => ({ id, name })),
  }
}

export async function loadExerciseProgress(
  exerciseId: string,
  database: GymTrackerDatabase = db,
): Promise<ExerciseProgress> {
  const exercise = await database.exercises.get(exerciseId)
  if (!exercise || exercise.deletedAt !== null) {
    throw new Error('This exercise is no longer available.')
  }
  const [relations, completedSessions] = await Promise.all([
    database.workoutExercises
      .where('exerciseId')
      .equals(exerciseId)
      .filter((relation) => relation.deletedAt === null)
      .toArray(),
    database.workoutSessions
      .where('status')
      .equals('completed')
      .filter(
        (session) =>
          session.deletedAt === null && session.completedAt !== null,
      )
      .toArray(),
  ])
  const sessionById = new Map(
    completedSessions.map((session) => [session.id, session]),
  )
  const relevantRelations = relations.filter((relation) =>
    sessionById.has(relation.workoutId),
  )
  const relationIds = relevantRelations.map((relation) => relation.id)
  const storedSets = relationIds.length
    ? await database.exerciseSets
        .where('workoutExerciseId')
        .anyOf(relationIds)
        .filter((set) => set.deletedAt === null)
        .toArray()
    : []
  const setsByRelation = new Map<string, typeof storedSets>()
  for (const set of storedSets) {
    if (!validSet(set)) continue
    const bucket = setsByRelation.get(set.workoutExerciseId) ?? []
    bucket.push(set)
    setsByRelation.set(set.workoutExerciseId, bucket)
  }
  const entries: ExerciseProgressEntry[] = relevantRelations
    .flatMap((relation) => {
      const workout = sessionById.get(relation.workoutId)
      const sets = (setsByRelation.get(relation.id) ?? [])
        .slice()
        .sort((left, right) => left.setNumber - right.setNumber)
      const completedAt = workout?.completedAt
      if (!workout || !completedAt || validTimestamp(completedAt) === null || !sets.length) {
        return []
      }
      return [{
        workoutId: workout.id,
        workoutName: workout.name,
        exerciseNameSnapshot: relation.exerciseNameSnapshot,
        completedAt,
        sets: sets.map(({ setNumber, weightKg, reps }) => ({
          setNumber,
          weightKg,
          reps,
        })),
        bestWeightKg: Math.max(...sets.map((set) => set.weightKg)),
      }]
    })
    .sort(
      (left, right) =>
        (validTimestamp(left.completedAt) ?? 0) -
        (validTimestamp(right.completedAt) ?? 0),
    )

  return {
    exerciseId,
    bestRecordedWeightKg: entries.length
      ? Math.max(...entries.map((entry) => entry.bestWeightKg))
      : null,
    entries,
  }
}
