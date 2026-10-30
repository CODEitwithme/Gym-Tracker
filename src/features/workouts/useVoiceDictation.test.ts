import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSpeechConstructor } from './useVoiceDictation'

describe('getSpeechConstructor', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    // @ts-expect-error test cleanup
    delete globalThis.window
  })

  it('returns null when window is undefined', () => {
    // @ts-expect-error test
    delete globalThis.window
    expect(getSpeechConstructor()).toBeNull()
  })

  it('returns SpeechRecognition when available on window', () => {
    class MockSR {}
    // @ts-expect-error test
    globalThis.window = { SpeechRecognition: MockSR }
    expect(getSpeechConstructor()).toBe(MockSR)
  })

  it('returns webkitSpeechRecognition as fallback', () => {
    class MockWebkitSR {}
    // @ts-expect-error test
    globalThis.window = { webkitSpeechRecognition: MockWebkitSR }
    expect(getSpeechConstructor()).toBe(MockWebkitSR)
  })
})
