export type WeightUnit = 'kg' | 'lb'

export interface UserPreferences {
  weightUnit: WeightUnit
  stepTarget: number
  restTimerDuration: number // in seconds, default 90
  autoStartRestTimer: boolean
}

const PREFERENCES_KEY = 'forge-fit-user-preferences'
const LEGACY_UNIT_KEY = 'gym-tracker-progress-unit'

const DEFAULT_PREFERENCES: UserPreferences = {
  weightUnit: 'kg',
  stepTarget: 10000,
  restTimerDuration: 90,
  autoStartRestTimer: true,
}

export function getUserPreferences(): UserPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCES }
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY)
    let prefs: Partial<UserPreferences> = {}
    if (raw) {
      prefs = JSON.parse(raw)
    }

    // Fallback to legacy progress unit if not yet set in new preferences
    const legacyUnit = window.localStorage.getItem(LEGACY_UNIT_KEY) as WeightUnit | null
    const weightUnit = prefs.weightUnit ?? legacyUnit ?? DEFAULT_PREFERENCES.weightUnit

    return {
      weightUnit: weightUnit === 'lb' ? 'lb' : 'kg',
      stepTarget: typeof prefs.stepTarget === 'number' && prefs.stepTarget > 0 ? prefs.stepTarget : DEFAULT_PREFERENCES.stepTarget,
      restTimerDuration: typeof prefs.restTimerDuration === 'number' && prefs.restTimerDuration > 0 ? prefs.restTimerDuration : DEFAULT_PREFERENCES.restTimerDuration,
      autoStartRestTimer: prefs.autoStartRestTimer ?? DEFAULT_PREFERENCES.autoStartRestTimer,
    }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export function saveUserPreferences(updates: Partial<UserPreferences>): UserPreferences {
  const current = getUserPreferences()
  const next: UserPreferences = {
    ...current,
    ...updates,
  }

  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next))
    if (updates.weightUnit) {
      window.localStorage.setItem(LEGACY_UNIT_KEY, updates.weightUnit)
    }
    window.dispatchEvent(new CustomEvent('forge-fit-preferences-changed', { detail: next }))
  } catch {
    // Ignore localStorage write failures
  }

  return next
}
