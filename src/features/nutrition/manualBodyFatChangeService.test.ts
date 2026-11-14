import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  loadManualBodyFatChangePercent,
  saveManualBodyFatChangePercent,
} from './manualBodyFatChangeService'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('manual body fat change storage', () => {
  it('keeps the previous manual value until a new value is saved', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    })

    expect(loadManualBodyFatChangePercent()).toBeNull()

    saveManualBodyFatChangePercent(-0.4)
    expect(loadManualBodyFatChangePercent()).toBe(-0.4)

    saveManualBodyFatChangePercent(0.25)
    expect(loadManualBodyFatChangePercent()).toBe(0.25)
  })
})
