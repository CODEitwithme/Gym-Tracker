import type { GymTrackerDatabase } from '../../db/database'
import { db } from '../../db/database'
import type { ExerciseSet, WorkoutExercise, WorkoutSession } from '../workouts/types'
import { readBackupData } from './backupService'

export type CsvExportKind =
  | 'workout-history'
  | 'workout-sets'
  | 'nutrition-logs'
  | 'saved-meals'

type CsvValue = string | number | boolean | null | undefined
type CsvCell = { value: CsvValue; untrustedText?: boolean }

const value = (cell: CsvValue, untrustedText = false): CsvCell => ({
  value: cell,
  untrustedText,
})

function csvField({ value: rawValue, untrustedText = false }: CsvCell): string {
  let content = rawValue === null || rawValue === undefined ? '' : String(rawValue)
  if (untrustedText && /^\s*[=+\-@]/.test(content)) {
    content = `'${content}`
  }
  if (/[",\r\n]/.test(content)) {
    return `"${content.replaceAll('"', '""')}"`
  }
  return content
}

function csvDocument(headers: string[], rows: CsvCell[][]): string {
  return [headers.map((header) => csvField(value(header))).join(',')]
    .concat(rows.map((row) => row.map(csvField).join(',')))
    .join('\r\n')
}

function durationSeconds(session: WorkoutSession): number | null {
  if (!session.completedAt) return null
  const started = Date.parse(session.startedAt)
  const completed = Date.parse(session.completedAt)
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) {
    return null
  }
  return Math.floor((completed - started) / 1000)
}

function rowsForRelations(
  relations: WorkoutExercise[],
  sessions: Map<string, WorkoutSession>,
  setsByRelation: Map<string, ExerciseSet[]>,
): CsvCell[][] {
  const rows: CsvCell[][] = []
  for (const relation of relations) {
    const session = sessions.get(relation.workoutId)
    if (!session) continue
    const sets = (setsByRelation.get(relation.id) ?? [])
      .slice()
      .sort((left, right) => left.setNumber - right.setNumber)
    const selectedSets = sets.length ? sets : [null]
    for (const set of selectedSets) {
      rows.push([
        value(session.id),
        value(session.name, true),
        value(session.startedAt),
        value(session.completedAt),
        value(relation.exerciseId),
        value(relation.exerciseNameSnapshot, true),
        value(relation.order),
        value(relation.notes, true),
        value(set?.setNumber),
        value(set?.weightKg),
        value(set?.reps),
        value(set?.completed),
      ])
    }
  }
  return rows
}

export async function createCsvExport(
  kind: CsvExportKind,
  database: GymTrackerDatabase = db,
): Promise<string> {
  const data = await readBackupData(database)
  if (kind === 'workout-history') {
    const sessions = data.workoutSessions
      .filter(
        (session) =>
          session.deletedAt === null && session.status === 'completed',
      )
      .slice()
      .sort((left, right) =>
        (right.completedAt ?? '').localeCompare(left.completedAt ?? ''),
      )
    return csvDocument(
      [
        'Workout ID',
        'Workout name',
        'Started at',
        'Completed at',
        'Duration seconds',
        'Status',
        'Session notes',
      ],
      sessions.map((session) => [
        value(session.id),
        value(session.name, true),
        value(session.startedAt),
        value(session.completedAt),
        value(durationSeconds(session)),
        value(session.status),
        value(session.notes, true),
      ]),
    )
  }

  if (kind === 'workout-sets') {
    const sessions = new Map(
      data.workoutSessions
        .filter((session) => session.deletedAt === null)
        .map((session) => [session.id, session]),
    )
    const activeSessionIds = new Set(sessions.keys())
    const relations = data.workoutExercises
      .filter(
        (relation) =>
          relation.deletedAt === null && activeSessionIds.has(relation.workoutId),
      )
      .slice()
      .sort((left, right) => {
        const workoutOrder = left.workoutId.localeCompare(right.workoutId)
        return workoutOrder || left.order - right.order
      })
    const relationIds = new Set(relations.map((relation) => relation.id))
    const setsByRelation = new Map<string, ExerciseSet[]>()
    for (const set of data.exerciseSets) {
      if (set.deletedAt !== null || !relationIds.has(set.workoutExerciseId)) continue
      const bucket = setsByRelation.get(set.workoutExerciseId) ?? []
      bucket.push(set)
      setsByRelation.set(set.workoutExerciseId, bucket)
    }
    return csvDocument(
      [
        'Workout ID',
        'Workout name',
        'Workout started at',
        'Workout completed at',
        'Workout status',
        'Exercise ID',
        'Exercise name snapshot',
        'Exercise order',
        'Exercise notes',
        'Set number',
        'Weight kg',
        'Repetitions',
        'Set completed',
      ],
      rowsForRelations(relations, sessions, setsByRelation),
    )
  }

  if (kind === 'nutrition-logs') {
    const logs = data.mealLogs
      .filter((log) => log.deletedAt === null)
      .slice()
      .sort((left, right) =>
        left.consumedAt.localeCompare(right.consumedAt),
      )
    return csvDocument(
      [
        'Meal log ID',
        'Saved meal ID',
        'Local date',
        'Consumed at',
        'Meal type',
        'Meal name snapshot',
        'Portion percent',
        'Calories kcal',
        'Protein g',
        'Carbohydrates g',
        'Fat g',
      ],
      logs.map((log) => [
        value(log.id),
        value(log.savedMealId),
        value(log.localDate),
        value(log.consumedAt),
        value(log.mealType),
        value(log.mealNameSnapshot, true),
        value(log.portionPercent),
        value(log.nutritionSnapshot.calories),
        value(log.nutritionSnapshot.proteinG),
        value(log.nutritionSnapshot.carbsG),
        value(log.nutritionSnapshot.fatG),
      ]),
    )
  }

  if (kind === 'saved-meals') {
    const meals = data.savedMeals
      .filter((meal) => meal.deletedAt === null)
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
    return csvDocument(
      [
        'Saved meal ID',
        'Meal name',
        'Serving description',
        'Calories kcal',
        'Protein g',
        'Carbohydrates g',
        'Fat g',
        'Calorie source',
        'Created at',
        'Updated at',
      ],
      meals.map((meal) => [
        value(meal.id),
        value(meal.name, true),
        value(meal.servingDescription, true),
        value(meal.calories),
        value(meal.proteinG),
        value(meal.carbsG),
        value(meal.fatG),
        value(meal.calorieSource),
        value(meal.createdAt),
        value(meal.updatedAt),
      ]),
    )
  }

  throw new Error(`Unsupported CSV export "${String(kind)}".`)
}
