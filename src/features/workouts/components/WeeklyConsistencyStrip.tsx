import { useMemo } from 'react'
import { Check, Flame } from 'lucide-react'
import { formatLocalDate } from '../../../lib/dateTime'
import type { WorkoutSummary } from '../workoutService'

export interface WeeklyConsistencyStripProps {
  history: WorkoutSummary[]
  referenceDate?: Date
}

interface DayData {
  dateStr: string
  dayName: string
  dayNumber: number
  isToday: boolean
  isFuture: boolean
  workouts: WorkoutSummary[]
}

function getWeekDays(ref: Date): DayData[] {
  const current = new Date(ref)
  const todayStr = formatLocalDate(current)

  // Find Monday of current week (ISO week: Monday = 1, Sunday = 7)
  const currentDayOfWeek = current.getDay() // 0 = Sunday, 1 = Monday...
  const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek

  const monday = new Date(current)
  monday.setDate(current.getDate() + distanceToMonday)
  monday.setHours(0, 0, 0, 0)

  const days: DayData[] = []
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dateStr = formatLocalDate(d)

    days.push({
      dateStr,
      dayName: dayNames[i],
      dayNumber: d.getDate(),
      isToday: dateStr === todayStr,
      isFuture: d.getTime() > current.getTime() && dateStr !== todayStr,
      workouts: [],
    })
  }

  return days
}

export function WeeklyConsistencyStrip({
  history,
  referenceDate = new Date(),
}: WeeklyConsistencyStripProps) {
  const { weekDays, thisWeekWorkouts, totalWeeklyVolumeKg, totalWeeklyMinutes } =
    useMemo(() => {
      const days = getWeekDays(referenceDate)
      const dayMap = new Map<string, DayData>()
      days.forEach((d) => dayMap.set(d.dateStr, d))

      const thisWeek: WorkoutSummary[] = []
      let totalVol = 0
      let totalSecs = 0

      history.forEach((summary) => {
        try {
          const workoutDate = formatLocalDate(new Date(summary.session.startedAt))
          const day = dayMap.get(workoutDate)
          if (day) {
            day.workouts.push(summary)
            thisWeek.push(summary)
            totalVol += summary.totalVolumeKg ?? 0
            totalSecs += summary.durationSeconds ?? 0
          }
        } catch {
          // ignore date parse issues
        }
      })

      return {
        weekDays: days,
        thisWeekWorkouts: thisWeek,
        totalWeeklyVolumeKg: Math.round(totalVol),
        totalWeeklyMinutes: Math.round(totalSecs / 60),
      }
    }, [history, referenceDate])

  const formattedHours = Math.floor(totalWeeklyMinutes / 60)
  const formattedMinutes = totalWeeklyMinutes % 60
  const timeDisplay = formattedHours
    ? `${formattedHours}h ${formattedMinutes}m`
    : `${formattedMinutes}m`

  return (
    <div className="rounded-2xl border border-line bg-panel p-4 shadow-sm shadow-ink/[0.02]">
      {/* Header */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Flame className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">This Week</h3>
            <p className="text-xs text-muted">
              {thisWeekWorkouts.length === 0
                ? 'No sessions yet this week'
                : `${thisWeekWorkouts.length} workout${thisWeekWorkouts.length > 1 ? 's' : ''} · ${timeDisplay} active`}
            </p>
          </div>
        </div>

        {totalWeeklyVolumeKg > 0 && (
          <div className="rounded-lg bg-surface px-2.5 py-1 text-right text-xs">
            <span className="text-muted">Volume: </span>
            <span className="font-semibold text-ink">
              {totalWeeklyVolumeKg.toLocaleString()} kg
            </span>
          </div>
        )}
      </div>

      {/* 7-Day Strip */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {weekDays.map((day) => {
          const hasTrained = day.workouts.length > 0
          const primaryWorkout = day.workouts[0]

          return (
            <div
              key={day.dateStr}
              className={`flex flex-col items-center justify-between rounded-xl py-2 px-1 text-center transition-all ${
                hasTrained
                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200'
                  : day.isToday
                    ? 'border border-accent bg-accent-soft text-ink font-semibold'
                    : 'border border-transparent bg-surface text-muted'
              }`}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider">
                {day.dayName}
              </span>
              <span
                className={`mt-1 text-sm font-bold ${
                  hasTrained
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : day.isToday
                      ? 'text-accent'
                      : 'text-ink'
                }`}
              >
                {day.dayNumber}
              </span>

              <div className="mt-1.5 flex h-4 items-center justify-center">
                {hasTrained ? (
                  <span
                    title={primaryWorkout?.session.name || 'Workout completed'}
                    className="flex size-4 items-center justify-center rounded-full bg-emerald-600 text-white"
                  >
                    <Check className="size-2.5 stroke-[3]" />
                  </span>
                ) : day.isToday ? (
                  <span className="size-1.5 rounded-full bg-accent" />
                ) : (
                  <span className="size-1 rounded-full bg-line" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default WeeklyConsistencyStrip
