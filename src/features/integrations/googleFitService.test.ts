import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GymTrackerDatabase } from '../../db/database'
import { logSteps } from '../../db/repositories/bodyMetrics'
import { createUUID, formatLocalDate } from '../../lib/dateTime'
import {
  disconnectGoogleFit,
  generateSimulationStepDays,
  getGoogleFitConfig,
  getLastGoogleFitSyncTime,
  isGoogleFitConnected,
  saveGoogleFitConfig,
  syncStepsFromGoogleFit,
} from './googleFitService'

let testDatabase: GymTrackerDatabase
const asOf = new Date(2026, 9, 19, 12, 0, 0)

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  }
}

beforeEach(async () => {
  testDatabase = new GymTrackerDatabase(`gym-tracker-test-${createUUID()}`)
  await testDatabase.open()
  vi.stubGlobal('localStorage', memoryStorage())
})

afterEach(async () => {
  testDatabase.close()
  await testDatabase.delete()
  vi.unstubAllGlobals()
})

describe('googleFitService demo sync', () => {
  it('reads and writes demo and auto-sync configuration', () => {
    expect(getGoogleFitConfig()).toEqual({
      autoSync: false,
      isSimulation: false,
    })

    saveGoogleFitConfig({ autoSync: true, isSimulation: true })

    expect(getGoogleFitConfig()).toEqual({
      autoSync: true,
      isSimulation: true,
    })
    expect(isGoogleFitConnected()).toBe(true)
  })

  it('clears credentials saved by the retired OAuth integration', () => {
    localStorage.setItem('gym-tracker-google-fit-client-id', 'old-client-id')
    localStorage.setItem(
      'gym-tracker-google-fit-token',
      JSON.stringify({ accessToken: 'old-token', expiresAt: Date.now() + 3600_000 }),
    )
    localStorage.setItem('gym-tracker-google-fit-last-sync', '2026-10-19T12:00:00.000Z')

    expect(getGoogleFitConfig().isSimulation).toBe(false)
    expect(localStorage.getItem('gym-tracker-google-fit-client-id')).toBeNull()
    expect(localStorage.getItem('gym-tracker-google-fit-token')).toBeNull()
    expect(getLastGoogleFitSyncTime()).toBeNull()
    expect(isGoogleFitConnected()).toBe(false)
  })

  it('generates one simulated step count per local calendar day', () => {
    const days = generateSimulationStepDays(7, asOf)

    expect(days).toHaveLength(7)
    expect(days[days.length - 1].date).toBe(formatLocalDate(asOf))
    expect(days.every((day) => day.steps > 0)).toBe(true)
    expect(() => generateSimulationStepDays(0, asOf)).toThrow(/between 1 and 90 days/)
  })

  it('syncs demo steps into the local database and records the last sync', async () => {
    saveGoogleFitConfig({ isSimulation: true })

    const result = await syncStepsFromGoogleFit({
      days: 7,
      database: testDatabase,
      asOf,
    })

    expect(result.syncedDays).toBe(7)
    expect(result.todaySteps).toBeGreaterThan(0)
    expect(getLastGoogleFitSyncTime()).toBe(result.lastSyncAt)

    const storedLogs = await testDatabase.stepLogs.toArray()
    expect(storedLogs).toHaveLength(7)
    expect(storedLogs.every((log) => log.stepCount > 0)).toBe(true)

    const todayLog = await testDatabase.stepLogs
      .where('localDate')
      .equals(formatLocalDate(asOf))
      .first()
    expect(todayLog?.stepCount).toBe(result.todaySteps)
  })

  it('preserves already logged steps instead of overwriting them with demo data', async () => {
    const today = formatLocalDate(asOf)
    await logSteps(
      { localDate: today, stepCount: 4321, targetSteps: 8000 },
      testDatabase,
    )
    saveGoogleFitConfig({ isSimulation: true })

    const result = await syncStepsFromGoogleFit({
      days: 7,
      database: testDatabase,
      asOf,
    })

    expect(result.syncedDays).toBe(6)
    expect(result.todaySteps).toBe(4321)
    expect(
      await testDatabase.stepLogs.where('localDate').equals(today).first(),
    ).toMatchObject({ stepCount: 4321, targetSteps: 8000 })
  })

  it('does not attempt live Google Fit sync when demo mode is off', async () => {
    await expect(
      syncStepsFromGoogleFit({ database: testDatabase, asOf }),
    ).rejects.toThrow(/Google retired the Fitness API/)
    expect(getLastGoogleFitSyncTime()).toBeNull()
    expect(await testDatabase.stepLogs.count()).toBe(0)
  })

  it('disconnects demo mode and clears the last sync time', () => {
    saveGoogleFitConfig({ isSimulation: true })
    localStorage.setItem('gym-tracker-google-fit-last-sync', '2026-10-19T12:00:00.000Z')

    disconnectGoogleFit()

    expect(isGoogleFitConnected()).toBe(false)
    expect(getLastGoogleFitSyncTime()).toBeNull()
  })
})
