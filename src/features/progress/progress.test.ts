import { describe, expect, it } from 'vitest'
import {
  calculateEstimated1Rm,
  convertWeight,
  detectAllPersonalRecords,
  formatVolume,
  formatWeight,
  calculatePeriodWindows,
  type RawCompletedSet,
} from './progressCalculations'
import { GymTrackerDatabase } from '../../db/database'
import { loadProgressDashboardData } from './progressService'
import { createExercise } from '../../db/repositories/exercises'
import { createWorkoutSession } from '../../db/repositories/workoutSessions'
import { addExerciseSet, addWorkoutExercise } from '../../db/repositories/workoutDetails'

describe('progressCalculations', () => {
  it('calculates estimated 1RM using Epley formula correctly', () => {
    // 1 rep should equal exact weight
    expect(calculateEstimated1Rm(100, 1)).toBe(100)
    // 100kg x 10 reps: 100 * (1 + 10/30) = 133.33 -> 133.3
    expect(calculateEstimated1Rm(100, 10)).toBe(133.3)
    // 80kg x 5 reps: 80 * (1 + 5/30) = 93.33 -> 93.3
    expect(calculateEstimated1Rm(80, 5)).toBe(93.3)
    // Edge cases: 0 weight or 0 reps
    expect(calculateEstimated1Rm(0, 5)).toBe(0)
    expect(calculateEstimated1Rm(100, 0)).toBe(0)
    expect(calculateEstimated1Rm(-50, 5)).toBe(0)
  })

  it('converts weights between kg and lb accurately', () => {
    expect(convertWeight(100, 'kg')).toBe(100)
    expect(convertWeight(100, 'lb')).toBeCloseTo(220.462, 2)
    expect(formatWeight(100, 'kg')).toBe('100 kg')
    expect(formatWeight(100, 'lb')).toBe('220.5 lb')
  })

  it('formats volume with unit suffixes', () => {
    expect(formatVolume(1000, 'kg')).toBe('1,000 kg')
    expect(formatVolume(1000, 'lb')).toBe('2,205 lb')
  })

  it('detects distinct PRs and avoids counting duplicates on repeated sets', () => {
    const window = calculatePeriodWindows('30d', null, new Date('2026-10-25T12:00:00Z')).current

    const sets: RawCompletedSet[] = [
      // Workout 1: 80kg x 5
      {
        exerciseId: 'ex-bench',
        exerciseName: 'Bench Press',
        workoutId: 'w1',
        workoutName: 'Chest Day 1',
        completedAt: '2026-10-10T10:00:00Z',
        weightKg: 80,
        reps: 5,
      },
      // Workout 2: exact same 80kg x 5 (should NOT create a duplicate PR!)
      {
        exerciseId: 'ex-bench',
        exerciseName: 'Bench Press',
        workoutId: 'w2',
        workoutName: 'Chest Day 2',
        completedAt: '2026-10-12T10:00:00Z',
        weightKg: 80,
        reps: 5,
      },
      // Workout 3: 80kg x 8 (Rep PR & 1RM PR, but NOT heaviest weight PR)
      {
        exerciseId: 'ex-bench',
        exerciseName: 'Bench Press',
        workoutId: 'w3',
        workoutName: 'Chest Day 3',
        completedAt: '2026-10-15T10:00:00Z',
        weightKg: 80,
        reps: 8,
      },
      // Workout 4: 90kg x 3 (Heaviest Weight PR!)
      {
        exerciseId: 'ex-bench',
        exerciseName: 'Bench Press',
        workoutId: 'w4',
        workoutName: 'Chest Day 4',
        completedAt: '2026-10-18T10:00:00Z',
        weightKg: 90,
        reps: 3,
      },
    ]

    const prs = detectAllPersonalRecords(sets, window)

    // Should have:
    // 1. Initial 80kg heaviest PR (w1)
    // 2. Initial 80kg 1RM PR (w1)
    // 3. w3 1RM PR (101.3kg vs 93.3kg)
    // 4. w3 Rep PR (8 reps vs 5 reps at 80kg)
    // 5. w4 Heaviest Weight PR (90kg vs 80kg)
    // Total 5 distinct PRs, zero duplicates from w2!
    expect(prs.filter((p) => p.workoutId === 'w2')).toHaveLength(0)

    const heaviestPrs = prs.filter((p) => p.type === 'heaviest')
    expect(heaviestPrs).toHaveLength(2)
    expect(heaviestPrs[0].weightKg).toBe(80)
    expect(heaviestPrs[1].weightKg).toBe(90)
    expect(heaviestPrs[1].improvementKg).toBe(10)
    expect(heaviestPrs[1].improvementPercent).toBe(12.5)

    const repPrs = prs.filter((p) => p.type === 'rep_record')
    expect(repPrs).toHaveLength(1)
    expect(repPrs[0].reps).toBe(8)
    expect(repPrs[0].previousReps).toBe(5)
  })
})

describe('progressService integration', () => {
  it('returns clean empty states when no workouts exist', async () => {
    const testDb = new GymTrackerDatabase(`test-progress-empty-${Date.now()}`)
    const data = await loadProgressDashboardData('30d', 'kg', undefined, testDb)

    expect(data.hasAnyWorkouts).toBe(false)
    expect(data.metrics.workoutsCount).toBe(0)
    expect(data.metrics.totalVolumeKg).toBe(0)
    expect(data.metrics.prsCount).toBe(0)
    expect(data.personalRecords).toHaveLength(0)
    expect(data.strengthProgression).toHaveLength(0)
    expect(data.recentWorkouts).toHaveLength(0)
    await testDb.delete()
  })

  it('aggregates real completed workout data, PRs, and strength progression', async () => {
    const testDb = new GymTrackerDatabase(`test-progress-real-${Date.now()}`)

    const bench = await createExercise(
      { name: 'Barbell Bench Press', category: 'chest', equipment: 'Barbell' },
      testDb,
    )
    const squat = await createExercise(
      { name: 'Barbell Squat', category: 'legs', equipment: 'Barbell' },
      testDb,
    )

    // Complete workout 1
    const w1 = await createWorkoutSession(
      {
        name: 'Push Day 1',
        startedAt: '2026-10-10T10:00:00.000Z',
        completedAt: null,
        status: 'in_progress',
        notes: '',
      },
      testDb,
    )
    const we1 = await addWorkoutExercise({ workoutId: w1.id, exerciseId: bench.id }, testDb)
    await addExerciseSet({ workoutExerciseId: we1.id, setNumber: 1, weightKg: 80, reps: 5, completed: true }, testDb)
    await addExerciseSet({ workoutExerciseId: we1.id, setNumber: 2, weightKg: 85, reps: 5, completed: true }, testDb)
    await testDb.workoutSessions.update(w1.id, {
      status: 'completed',
      completedAt: '2026-10-10T11:00:00.000Z',
    })

    // Complete workout 2
    const w2 = await createWorkoutSession(
      {
        name: 'Leg Day 1',
        startedAt: '2026-10-12T10:00:00.000Z',
        completedAt: null,
        status: 'in_progress',
        notes: '',
      },
      testDb,
    )
    const we2 = await addWorkoutExercise({ workoutId: w2.id, exerciseId: squat.id }, testDb)
    await addExerciseSet({ workoutExerciseId: we2.id, setNumber: 1, weightKg: 100, reps: 5, completed: true }, testDb)
    await testDb.workoutSessions.update(w2.id, {
      status: 'completed',
      completedAt: '2026-10-12T11:00:00.000Z',
    })

    // Complete workout 3 (Bench PR: 90kg)
    const w3 = await createWorkoutSession(
      {
        name: 'Push Day 2',
        startedAt: '2026-10-15T10:00:00.000Z',
        completedAt: null,
        status: 'in_progress',
        notes: '',
      },
      testDb,
    )
    const we3 = await addWorkoutExercise({ workoutId: w3.id, exerciseId: bench.id }, testDb)
    await addExerciseSet({ workoutExerciseId: we3.id, setNumber: 1, weightKg: 90, reps: 5, completed: true }, testDb)
    await testDb.workoutSessions.update(w3.id, {
      status: 'completed',
      completedAt: '2026-10-15T11:00:00.000Z',
    })

    const asOf = new Date('2026-10-20T12:00:00Z')
    const data = await loadProgressDashboardData('30d', 'kg', bench.id, testDb, asOf)

    expect(data.hasAnyWorkouts).toBe(true)
    expect(data.metrics.workoutsCount).toBe(3)
    // Total volume: (80*5 + 85*5) + (100*5) + (90*5) = 400 + 425 + 500 + 450 = 1775 kg
    expect(data.metrics.totalVolumeKg).toBe(1775)
    expect(data.metrics.activeTrainingDays).toBe(3)

    // Strength progression for Bench Press: 2 points (w1 and w3)
    expect(data.strengthProgression).toHaveLength(2)
    expect(data.strengthProgression[0].bestWeightKg).toBe(85)
    expect(data.strengthProgression[1].bestWeightKg).toBe(90)

    // Check PRs exist for bench and squat
    expect(data.personalRecords.length).toBeGreaterThanOrEqual(3)
    const benchPrs = data.personalRecords.filter((p) => p.exerciseId === bench.id)
    expect(benchPrs.some((p) => p.weightKg === 90 && p.type === 'heaviest')).toBe(true)

    await testDb.delete()
  })
})
