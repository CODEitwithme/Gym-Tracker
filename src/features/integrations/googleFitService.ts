import { db, type GymTrackerDatabase } from '../../db/database'
import { logSteps } from '../../db/repositories/bodyMetrics'
import { createTimestamp, formatLocalDate } from '../../lib/dateTime'

export const GOOGLE_FIT_AUTO_SYNC_KEY = 'gym-tracker-google-fit-auto-sync'
export const GOOGLE_FIT_LAST_SYNC_KEY = 'gym-tracker-google-fit-last-sync'
export const GOOGLE_FIT_SIMULATION_KEY = 'gym-tracker-google-fit-simulation'

const LEGACY_GOOGLE_FIT_CLIENT_ID_KEY = 'gym-tracker-google-fit-client-id'
const LEGACY_GOOGLE_FIT_TOKEN_KEY = 'gym-tracker-google-fit-token'

export interface GoogleFitConfig {
  autoSync: boolean
  isSimulation: boolean
}

export interface GoogleFitDailyStep {
  date: string
  steps: number
}

export interface GoogleFitSyncResult {
  syncedDays: number
  todaySteps: number
  lastSyncAt: string
  days: GoogleFitDailyStep[]
}

function clearLegacyCredentials(): void {
  if (typeof localStorage === 'undefined') return
  const hadLegacyCredentials =
    localStorage.getItem(LEGACY_GOOGLE_FIT_CLIENT_ID_KEY) !== null ||
    localStorage.getItem(LEGACY_GOOGLE_FIT_TOKEN_KEY) !== null
  localStorage.removeItem(LEGACY_GOOGLE_FIT_CLIENT_ID_KEY)
  localStorage.removeItem(LEGACY_GOOGLE_FIT_TOKEN_KEY)
  if (hadLegacyCredentials) {
    localStorage.removeItem(GOOGLE_FIT_LAST_SYNC_KEY)
  }
}

export function getGoogleFitConfig(): GoogleFitConfig {
  if (typeof localStorage === 'undefined') {
    return { autoSync: false, isSimulation: false }
  }

  clearLegacyCredentials()
  return {
    autoSync: localStorage.getItem(GOOGLE_FIT_AUTO_SYNC_KEY) === 'true',
    isSimulation: localStorage.getItem(GOOGLE_FIT_SIMULATION_KEY) === 'true',
  }
}

export function saveGoogleFitConfig(config: Partial<GoogleFitConfig>): void {
  if (typeof localStorage === 'undefined') return
  if (config.autoSync !== undefined) {
    localStorage.setItem(GOOGLE_FIT_AUTO_SYNC_KEY, String(config.autoSync))
  }
  if (config.isSimulation !== undefined) {
    localStorage.setItem(GOOGLE_FIT_SIMULATION_KEY, String(config.isSimulation))
  }
}

export function disconnectGoogleFit(): void {
  if (typeof localStorage === 'undefined') return
  clearLegacyCredentials()
  localStorage.removeItem(GOOGLE_FIT_SIMULATION_KEY)
  localStorage.removeItem(GOOGLE_FIT_LAST_SYNC_KEY)
}

export function isGoogleFitConnected(): boolean {
  return getGoogleFitConfig().isSimulation
}

export function getLastGoogleFitSyncTime(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(GOOGLE_FIT_LAST_SYNC_KEY)
}

export function generateSimulationStepDays(
  days = 7,
  asOf = new Date(),
): GoogleFitDailyStep[] {
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    throw new Error('Demo sync supports between 1 and 90 days.')
  }

  const result: GoogleFitDailyStep[] = []
  const baseSteps = [8420, 10150, 7890, 11200, 9450, 12300, 9150]

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(asOf)
    date.setDate(date.getDate() - i)
    const patternIndex = (days - 1 - i) % baseSteps.length
    const variance = (date.getDate() * 73) % 800 - 400
    result.push({
      date: formatLocalDate(date),
      steps: Math.max(2500, baseSteps[patternIndex] + variance),
    })
  }

  return result
}

export async function syncStepsFromGoogleFit(
  options: {
    days?: number
    database?: GymTrackerDatabase
    asOf?: Date
  } = {},
): Promise<GoogleFitSyncResult> {
  const { days = 7, database = db, asOf = new Date() } = options
  if (!getGoogleFitConfig().isSimulation) {
    throw new Error(
      'Live Google Fit sync is unavailable because Google retired the Fitness API. Enable demo simulation or log steps manually.',
    )
  }

  const dailySteps = generateSimulationStepDays(days, asOf)
  const syncedDays: GoogleFitDailyStep[] = []
  const storedDays: GoogleFitDailyStep[] = []
  for (const item of dailySteps) {
    const existing = await database.stepLogs
      .where('localDate')
      .equals(item.date)
      .filter((stepLog) => stepLog.deletedAt === null)
      .first()

    if (existing) {
      storedDays.push({ date: item.date, steps: existing.stepCount })
      continue
    }

    await logSteps(
      {
        localDate: item.date,
        stepCount: item.steps,
        targetSteps: 10_000,
      },
      database,
    )
    syncedDays.push(item)
    storedDays.push(item)
  }

  const lastSyncAt = createTimestamp()
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(GOOGLE_FIT_LAST_SYNC_KEY, lastSyncAt)
  }

  const todaySteps =
    storedDays.find((item) => item.date === formatLocalDate(asOf))?.steps ?? 0

  return {
    syncedDays: syncedDays.length,
    todaySteps,
    lastSyncAt,
    days: storedDays,
  }
}
