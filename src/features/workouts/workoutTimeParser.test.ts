import { describe, expect, it } from 'vitest'
import { extractWorkoutContext } from './workoutTimeParser'

describe('workoutTimeParser', () => {
  const refDate = new Date(2026, 9, 29, 20, 0, 0) // 2026-10-29 20:00

  it('parses "today from 5:30 to 6:45 pm" with session name', () => {
    const prompt = 'Trained today from 5:30 to 6:45 pm. Chest & Triceps: Bench press 4x10 at 80kg'
    const result = extractWorkoutContext(prompt, null, refDate)

    expect(result.date).toBe('2026-10-29')
    expect(result.startTime).toBe('17:30')
    expect(result.endTime).toBe('18:45')
    expect(result.durationMinutes).toBe(75)
    expect(result.sessionName).toBe('Chest & Triceps')
  })

  it('parses "yesterday 7 to 8 am leg day"', () => {
    const prompt = 'yesterday 7 to 8 am leg day: Squats 4x8 100kg'
    const result = extractWorkoutContext(prompt, null, refDate)

    expect(result.date).toBe('2026-10-28')
    expect(result.startTime).toBe('07:00')
    expect(result.endTime).toBe('08:00')
    expect(result.durationMinutes).toBe(60)
    expect(result.sessionName).toBe('Leg Day')
  })

  it('parses duration "for 45 mins" and split title', () => {
    const prompt = 'Pull Day for 45 mins: Deadlifts 3x5 140kg, Pullups 3x10'
    const result = extractWorkoutContext(prompt, null, refDate)

    expect(result.durationMinutes).toBe(45)
    expect(result.sessionName).toBe('Pull Day')
  })

  it('merges AI structured fields when provided', () => {
    const prompt = 'Workout done'
    const aiParsed = {
      sessionName: 'Shoulder Blast',
      startTime: '18:15',
      endTime: '19:30',
      workoutDate: 'yesterday',
    }
    const result = extractWorkoutContext(prompt, aiParsed, refDate)

    expect(result.sessionName).toBe('Shoulder Blast')
    expect(result.startTime).toBe('18:15')
    expect(result.endTime).toBe('19:30')
    expect(result.durationMinutes).toBe(75)
    expect(result.date).toBe('2026-10-28')
  })
})

