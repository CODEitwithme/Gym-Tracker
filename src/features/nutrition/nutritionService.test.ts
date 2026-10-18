import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GymTrackerDatabase } from '../../db/database'
import { createUUID, formatLocalDate } from '../../lib/dateTime'
import {
  createMeal,
  editMealLog,
  editSavedMeal,
  fetchSavedMeal,
  fetchSavedMeals,
  getSavedNutritionGoals,
  loadDailyNutrition,
  loadTodayTotals,
  logMeal,
  removeMealLog,
  removeSavedMeal,
  saveNutritionGoals,
} from './nutritionService'

let testDatabase: GymTrackerDatabase
const databaseName = () => `gym-tracker-nutrition-${createUUID()}`

beforeEach(async () => {
  testDatabase = new GymTrackerDatabase(databaseName())
  await testDatabase.open()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  testDatabase.close()
  await testDatabase.delete()
})

describe('saved meals management', () => {
  it('creates and retrieves a saved meal with macro-estimated calories', async () => {
    const meal = await createMeal(
      {
        name: 'Oatmeal & Whey',
        servingDescription: '1 bowl',
        calorieSource: 'macro_estimate',
        proteinG: 30,
        carbsG: 50,
        fatG: 5,
      },
      testDatabase,
    )

    expect(meal.name).toBe('Oatmeal & Whey')
    expect(meal.servingDescription).toBe('1 bowl')
    expect(meal.calorieSource).toBe('macro_estimate')
    // 30*4 + 50*4 + 5*9 = 120 + 200 + 45 = 365
    expect(meal.calories).toBe(365)
    expect(meal.deletedAt).toBeNull()

    const fetched = await fetchSavedMeal(meal.id, testDatabase)
    expect(fetched).toEqual(meal)
  })

  it('preserves manual calorie values without overriding them', async () => {
    const meal = await createMeal(
      {
        name: 'Protein Bar',
        servingDescription: '1 bar (60g)',
        calorieSource: 'manual',
        calories: 220,
        proteinG: 20,
        carbsG: 22,
        fatG: 8,
      },
      testDatabase,
    )

    expect(meal.calorieSource).toBe('manual')
    expect(meal.calories).toBe(220)
    // Macro formula would have been 20*4 + 22*4 + 8*9 = 240, but manual 220 is preserved.
    expect(meal.calories).not.toBe(240)
  })

  it('trims meal names and serving descriptions', async () => {
    const meal = await createMeal(
      {
        name: '   Grilled Chicken Breast   ',
        servingDescription: '   150g   ',
        calorieSource: 'macro_estimate',
        proteinG: 45,
        carbsG: 0,
        fatG: 3,
      },
      testDatabase,
    )

    expect(meal.name).toBe('Grilled Chicken Breast')
    expect(meal.servingDescription).toBe('150g')
  })

  it('rejects blank names and negative nutritional values', async () => {
    await expect(
      createMeal(
        {
          name: '   ',
          servingDescription: '1 serving',
          calorieSource: 'macro_estimate',
          proteinG: 10,
          carbsG: 10,
          fatG: 5,
        },
        testDatabase,
      ),
    ).rejects.toThrow(/must not be blank/)

    await expect(
      createMeal(
        {
          name: 'Invalid Meal',
          servingDescription: '1 serving',
          calorieSource: 'macro_estimate',
          proteinG: -5,
          carbsG: 10,
          fatG: 2,
        },
        testDatabase,
      ),
    ).rejects.toThrow(/non-negative/)
  })

  it('propagates a failed IndexedDB saved-meal write without creating a record', async () => {
    vi.spyOn(testDatabase.savedMeals, 'add').mockRejectedValueOnce(
      new Error('Injected IndexedDB write failure'),
    )

    await expect(
      createMeal(
        {
          name: 'Unpersisted meal',
          servingDescription: '1 serving',
          calorieSource: 'macro_estimate',
          proteinG: 10,
          carbsG: 20,
          fatG: 5,
        },
        testDatabase,
      ),
    ).rejects.toThrow(/Injected IndexedDB write failure/)
    expect(await testDatabase.savedMeals.count()).toBe(0)
  })

  it('updates an existing saved meal and recalculates calories when switching to macro_estimate', async () => {
    const meal = await createMeal(
      {
        name: 'Greek Yogurt',
        servingDescription: '1 cup',
        calorieSource: 'manual',
        calories: 150,
        proteinG: 15,
        carbsG: 10,
        fatG: 2,
      },
      testDatabase,
    )

    const updated = await editSavedMeal(
      meal.id,
      {
        calorieSource: 'macro_estimate',
        proteinG: 20,
      },
      testDatabase,
    )

    // 20*4 + 10*4 + 2*9 = 80 + 40 + 18 = 138
    expect(updated.proteinG).toBe(20)
    expect(updated.calories).toBe(138)
  })

  it('soft-deletes saved meals and excludes them from active listings and search', async () => {
    const meal1 = await createMeal(
      {
        name: 'Eggs & Toast',
        servingDescription: '2 eggs, 2 slices',
        calorieSource: 'macro_estimate',
        proteinG: 18,
        carbsG: 26,
        fatG: 12,
      },
      testDatabase,
    )
    const meal2 = await createMeal(
      {
        name: 'Egg Salad',
        servingDescription: '1 bowl',
        calorieSource: 'macro_estimate',
        proteinG: 14,
        carbsG: 6,
        fatG: 16,
      },
      testDatabase,
    )

    expect(await fetchSavedMeals('', testDatabase)).toHaveLength(2)
    expect(await fetchSavedMeals('egg', testDatabase)).toHaveLength(2)

    await removeSavedMeal(meal1.id, testDatabase)

    const activeMeals = await fetchSavedMeals('', testDatabase)
    expect(activeMeals).toHaveLength(1)
    expect(activeMeals[0].id).toBe(meal2.id)

    const searchResults = await fetchSavedMeals('toast', testDatabase)
    expect(searchResults).toHaveLength(0)
  })
})

describe('meal logging and historical snapshots', () => {
  it('logs a meal with 100% portion and correct snapshot', async () => {
    const savedMeal = await createMeal(
      {
        name: 'Salmon & Rice',
        servingDescription: '200g salmon, 150g rice',
        calorieSource: 'macro_estimate',
        proteinG: 40,
        carbsG: 45,
        fatG: 15,
      },
      testDatabase,
    )

    const date = '2026-05-10'
    const consumedAt = `${date}T13:00:00.000Z`

    const log = await logMeal(
      {
        savedMealId: savedMeal.id,
        mealType: 'lunch',
        consumedAt,
        portionPercent: 100,
      },
      testDatabase,
    )

    expect(log.savedMealId).toBe(savedMeal.id)
    expect(log.mealNameSnapshot).toBe('Salmon & Rice')
    expect(log.mealType).toBe('lunch')
    expect(log.portionPercent).toBe(100)
    expect(log.nutritionSnapshot).toEqual({
      calories: savedMeal.calories,
      proteinG: 40,
      carbsG: 45,
      fatG: 15,
    })
  })

  it('scales calories and all macronutrients correctly for 50% and 150% portions', async () => {
    const baseMeal = await createMeal(
      {
        name: 'Steak & Potato',
        servingDescription: '1 serving',
        calorieSource: 'manual',
        calories: 600,
        proteinG: 50,
        carbsG: 40,
        fatG: 20,
      },
      testDatabase,
    )

    const halfPortionLog = await logMeal(
      {
        savedMealId: baseMeal.id,
        mealType: 'dinner',
        consumedAt: '2026-05-10T19:00:00.000Z',
        portionPercent: 50,
      },
      testDatabase,
    )

    expect(halfPortionLog.nutritionSnapshot).toEqual({
      calories: 300,
      proteinG: 25,
      carbsG: 20,
      fatG: 10,
    })

    const largePortionLog = await logMeal(
      {
        savedMealId: baseMeal.id,
        mealType: 'dinner',
        consumedAt: '2026-05-10T20:00:00.000Z',
        portionPercent: 150,
      },
      testDatabase,
    )

    expect(largePortionLog.nutritionSnapshot).toEqual({
      calories: 900,
      proteinG: 75,
      carbsG: 60,
      fatG: 30,
    })
  })

  it('preserves historical meal log snapshots when the saved meal is modified later', async () => {
    const meal = await createMeal(
      {
        name: 'Original Smoothie',
        servingDescription: '1 glass',
        calorieSource: 'manual',
        calories: 300,
        proteinG: 20,
        carbsG: 40,
        fatG: 5,
      },
      testDatabase,
    )

    const log = await logMeal(
      {
        savedMealId: meal.id,
        mealType: 'breakfast',
        consumedAt: '2026-05-10T08:00:00.000Z',
        portionPercent: 100,
      },
      testDatabase,
    )

    // Edit saved meal later
    await editSavedMeal(
      meal.id,
      {
        name: 'Reformulated Smoothie (High Protein)',
        calories: 500,
        proteinG: 50,
        carbsG: 60,
        fatG: 10,
      },
      testDatabase,
    )

    const daily = await loadDailyNutrition(log.localDate, testDatabase)
    const fetchedLog = daily.logs.find((l) => l.id === log.id)

    expect(fetchedLog?.mealNameSnapshot).toBe('Original Smoothie')
    expect(fetchedLog?.nutritionSnapshot.calories).toBe(300)
    expect(fetchedLog?.nutritionSnapshot.proteinG).toBe(20)
  })

  it('preserves historical meal logs when the saved meal is soft-deleted', async () => {
    const meal = await createMeal(
      {
        name: 'Discontinued Protein Shake',
        servingDescription: '1 bottle',
        calorieSource: 'manual',
        calories: 250,
        proteinG: 30,
        carbsG: 15,
        fatG: 3,
      },
      testDatabase,
    )

    const log = await logMeal(
      {
        savedMealId: meal.id,
        mealType: 'snack',
        consumedAt: '2026-05-10T15:30:00.000Z',
        portionPercent: 100,
      },
      testDatabase,
    )

    await removeSavedMeal(meal.id, testDatabase)

    // Saved meal is soft-deleted
    expect(await fetchSavedMeals('', testDatabase)).toHaveLength(0)

    // But historical log still exists and daily totals still count it
    const daily = await loadDailyNutrition(log.localDate, testDatabase)
    expect(daily.logs).toHaveLength(1)
    expect(daily.logs[0].id).toBe(log.id)
    expect(daily.totals.calories).toBe(250)
  })

  it('updates an existing log portion and category without creating duplicates', async () => {
    const meal = await createMeal(
      {
        name: 'Rice & Beans',
        servingDescription: '1 plate',
        calorieSource: 'manual',
        calories: 400,
        proteinG: 16,
        carbsG: 70,
        fatG: 4,
      },
      testDatabase,
    )

    const log = await logMeal(
      {
        savedMealId: meal.id,
        mealType: 'lunch',
        consumedAt: '2026-05-10T12:00:00.000Z',
        portionPercent: 100,
      },
      testDatabase,
    )

    const updated = await editMealLog(
      log.id,
      {
        portionPercent: 125,
        mealType: 'dinner',
      },
      testDatabase,
    )

    expect(updated.id).toBe(log.id)
    expect(updated.mealType).toBe('dinner')
    expect(updated.portionPercent).toBe(125)
    expect(updated.nutritionSnapshot.calories).toBe(500) // 400 * 1.25

    const daily = await loadDailyNutrition(log.localDate, testDatabase)
    expect(daily.logs).toHaveLength(1)
    expect(daily.sections.dinner.logs).toHaveLength(1)
    expect(daily.sections.lunch.logs).toHaveLength(0)
  })

  it('moves a log to a new date and updates localDate consistently', async () => {
    const meal = await createMeal(
      {
        name: 'Late Night Snack',
        servingDescription: '1 portion',
        calorieSource: 'manual',
        calories: 180,
        proteinG: 6,
        carbsG: 20,
        fatG: 8,
      },
      testDatabase,
    )

    const initialConsumedAt = '2026-05-10T12:00:00.000Z'
    const newConsumedAt = '2026-05-12T12:00:00.000Z'
    const oldLocalDate = formatLocalDate(new Date(initialConsumedAt))
    const newLocalDate = formatLocalDate(new Date(newConsumedAt))

    const log = await logMeal(
      {
        savedMealId: meal.id,
        mealType: 'snack',
        consumedAt: initialConsumedAt,
        portionPercent: 100,
      },
      testDatabase,
    )

    await editMealLog(
      log.id,
      {
        consumedAt: newConsumedAt,
        mealType: 'breakfast',
      },
      testDatabase,
    )

    const oldDay = await loadDailyNutrition(oldLocalDate, testDatabase)
    expect(oldDay.logs.find((l) => l.id === log.id)).toBeUndefined()
    expect(oldDay.totals.calories).toBe(0)

    const newDay = await loadDailyNutrition(newLocalDate, testDatabase)
    expect(newDay.logs.find((l) => l.id === log.id)).toBeDefined()
    expect(newDay.sections.breakfast.logs).toHaveLength(1)
    expect(newDay.totals.calories).toBe(180)
  })

  it('excludes soft-deleted logs from daily totals', async () => {
    const meal = await createMeal(
      {
        name: 'Protein Shake',
        servingDescription: '1 shake',
        calorieSource: 'manual',
        calories: 200,
        proteinG: 25,
        carbsG: 10,
        fatG: 2,
      },
      testDatabase,
    )

    const log = await logMeal(
      {
        savedMealId: meal.id,
        mealType: 'breakfast',
        consumedAt: '2026-05-10T08:00:00.000Z',
        portionPercent: 100,
      },
      testDatabase,
    )

    const beforeDelete = await loadDailyNutrition(log.localDate, testDatabase)
    expect(beforeDelete.totals.calories).toBe(200)

    await removeMealLog(log.id, testDatabase)

    const afterDelete = await loadDailyNutrition(log.localDate, testDatabase)
    expect(afterDelete.logs).toHaveLength(0)
    expect(afterDelete.totals.calories).toBe(0)
  })
})

describe('daily nutrition summary calculations and totals', () => {
  it('returns zero totals and empty sections for days with no logs', async () => {
    const summary = await loadDailyNutrition('2026-01-01', testDatabase)
    expect(summary.logs).toHaveLength(0)
    expect(summary.totals).toEqual({
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    })
    expect(summary.sections.breakfast.logs).toHaveLength(0)
    expect(summary.sections.lunch.logs).toHaveLength(0)
    expect(summary.sections.dinner.logs).toHaveLength(0)
    expect(summary.sections.snack.logs).toHaveLength(0)
  })

  it('sums all four macronutrients independently across multiple meals and sections', async () => {
    const breakfast = await createMeal(
      {
        name: 'Oats & Berries',
        servingDescription: '1 bowl',
        calorieSource: 'manual',
        calories: 350,
        proteinG: 15,
        carbsG: 60,
        fatG: 5,
      },
      testDatabase,
    )

    const lunch = await createMeal(
      {
        name: 'Chicken Wrap',
        servingDescription: '1 wrap',
        calorieSource: 'manual',
        calories: 450,
        proteinG: 35,
        carbsG: 40,
        fatG: 15,
      },
      testDatabase,
    )

    const snack = await createMeal(
      {
        name: 'Almonds',
        servingDescription: '30g',
        calorieSource: 'manual',
        calories: 170,
        proteinG: 6,
        carbsG: 6,
        fatG: 14,
      },
      testDatabase,
    )

    const date = '2026-06-15'
    await logMeal(
      {
        savedMealId: breakfast.id,
        mealType: 'breakfast',
        consumedAt: `${date}T08:00:00.000Z`,
        portionPercent: 100,
      },
      testDatabase,
    )
    await logMeal(
      {
        savedMealId: lunch.id,
        mealType: 'lunch',
        consumedAt: `${date}T12:30:00.000Z`,
        portionPercent: 100,
      },
      testDatabase,
    )
    await logMeal(
      {
        savedMealId: snack.id,
        mealType: 'snack',
        consumedAt: `${date}T16:00:00.000Z`,
        portionPercent: 100,
      },
      testDatabase,
    )

    const summary = await loadDailyNutrition(date, testDatabase)

    // Calories: 350 + 450 + 170 = 970
    expect(summary.totals.calories).toBe(970)
    // Protein: 15 + 35 + 6 = 56
    expect(summary.totals.proteinG).toBe(56)
    // Carbs: 60 + 40 + 6 = 106
    expect(summary.totals.carbsG).toBe(106)
    // Fat: 5 + 15 + 14 = 34
    expect(summary.totals.fatG).toBe(34)

    // Check individual section totals
    expect(summary.sections.breakfast.totals.calories).toBe(350)
    expect(summary.sections.lunch.totals.calories).toBe(450)
    expect(summary.sections.snack.totals.calories).toBe(170)
    expect(summary.sections.dinner.totals.calories).toBe(0)
  })

  it('provides today totals for dashboard integration', async () => {
    const meal = await createMeal(
      {
        name: 'Today Protein Bar',
        servingDescription: '1 bar',
        calorieSource: 'manual',
        calories: 200,
        proteinG: 20,
        carbsG: 15,
        fatG: 5,
      },
      testDatabase,
    )

    await logMeal(
      {
        savedMealId: meal.id,
        mealType: 'snack',
        consumedAt: new Date().toISOString(),
        portionPercent: 100,
      },
      testDatabase,
    )

    const todayTotals = await loadTodayTotals(testDatabase)
    expect(todayTotals.calories).toBe(200)
    expect(todayTotals.proteinG).toBe(20)
  })
})

describe('daily nutrition goals storage', () => {
  it('saves and reads user targets safely', () => {
    const goals = {
      calories: 2400,
      proteinG: 180,
      carbsG: 250,
      fatG: 70,
    }
    const persisted = saveNutritionGoals(goals)

    const retrieved = getSavedNutritionGoals()
    expect(retrieved).toEqual(goals)
    if (typeof window === 'undefined') {
      expect(persisted).toBe(false)
    }
  })

  it('reports browser storage failures while retaining the in-session values', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('Storage unavailable')
        },
      },
    })
    const goals = {
      calories: 2100,
      proteinG: 140,
      carbsG: 230,
      fatG: 75,
    }

    expect(saveNutritionGoals(goals)).toBe(false)
    expect(getSavedNutritionGoals()).toEqual(goals)
  })
})
