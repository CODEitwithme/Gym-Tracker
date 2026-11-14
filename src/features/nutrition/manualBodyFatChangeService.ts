const MANUAL_BODY_FAT_CHANGE_KEY = 'gym-tracker-manual-body-fat-change-percent'

export function loadManualBodyFatChangePercent(): number | null {
  const raw = window.localStorage.getItem(MANUAL_BODY_FAT_CHANGE_KEY)
  if (raw === null) return null

  const value = Number(raw)
  if (!Number.isFinite(value)) {
    throw new Error('Stored body fat change is not a valid number.')
  }

  return value
}

export function saveManualBodyFatChangePercent(value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError('Body fat change percent must be a finite number.')
  }

  window.localStorage.setItem(MANUAL_BODY_FAT_CHANGE_KEY, String(value))
}
