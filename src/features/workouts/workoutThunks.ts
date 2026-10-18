import { createAsyncThunk } from '@reduxjs/toolkit'
import {
  finishWorkout,
  loadActiveWorkout,
  startWorkout,
} from './workoutService'

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The workout operation failed.'
}

export const loadActiveWorkoutThunk = createAsyncThunk<
  string | null,
  void,
  { rejectValue: string }
>('workoutUi/loadActive', async (_, { rejectWithValue }) => {
  try {
    const workout = await loadActiveWorkout()
    return workout?.id ?? null
  } catch (error) {
    return rejectWithValue(getErrorMessage(error))
  }
})

export const startWorkoutThunk = createAsyncThunk<
  string,
  string | undefined,
  { rejectValue: string }
>('workoutUi/start', async (name, { rejectWithValue }) => {
  try {
    const workout = await startWorkout(name)
    return workout.id
  } catch (error) {
    return rejectWithValue(getErrorMessage(error))
  }
})

export const finishWorkoutThunk = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>('workoutUi/finish', async (workoutId, { rejectWithValue }) => {
  try {
    const workout = await finishWorkout(workoutId)
    return workout.id
  } catch (error) {
    return rejectWithValue(getErrorMessage(error))
  }
})
